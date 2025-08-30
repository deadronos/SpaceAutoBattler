import type { GameState, Ship, Vector3, EntityId, TurretState, Team } from '../types/index.js';
import type {
  AIIntent,
  AIBehaviorMode,
  AIPersonality,
  BehaviorConfig,
  RoamingPattern,
  FormationConfig
} from '../config/behaviorConfig.js';
import { getEffectivePersonality, selectRoamingPattern, getFormationConfig } from '../config/behaviorConfig.js';
import { getShipClassConfig } from '../config/entitiesConfig.js';
import { PhysicsConfig } from '../config/physicsConfig.js';
import { applyBoundaryPhysics } from './gameState.js';
import { lookAt, getForwardVector, angleDifference, clampTurn, magnitude, normalize, subtract } from '../utils/vector3.js';

/**
 * AI Controller - Configurable AI behaviors for ships
 */

export class AIController {
  private state: GameState;
  // Cache for separation force results per ship within the same tick to avoid
  // recomputing identical queries (helps synthetic benchmarks and repeated calls)
  private sepCache: Map<number, { x: number; y: number; z: number; sepDist: number; tick: number; res: { force: Vector3; neighborCount: number } } > = new Map();
  
  // Per-team anchor registries for roaming behavior
  private roamingAnchors: Map<Team, Vector3[]>;
  
  // Team alarm system - tracks when teams are under attack
  private teamAlarmTimes: Map<Team, number>;
  
  // Scout assignment - tracks which ship is the current scout per team
  private teamScouts: Map<Team, EntityId | null>;

  constructor(state: GameState) {
    this.state = state;
    this.roamingAnchors = new Map();
    this.roamingAnchors.set('red', []);
    this.roamingAnchors.set('blue', []);
    
    this.teamAlarmTimes = new Map();
    this.teamAlarmTimes.set('red', 0);
    this.teamAlarmTimes.set('blue', 0);
    
    this.teamScouts = new Map();
    this.teamScouts.set('red', null);
    this.teamScouts.set('blue', null);
  }

  /**
   * Update AI for all ships
   */
  updateAllShips(dt: number) {
    if (!this.state.behaviorConfig?.globalSettings.aiEnabled) {
      return;
    }

    // Check for team alarms (ships taking damage)
    this.updateTeamAlarms();
    
    // Update scout assignments
    this.updateScoutAssignments();

    for (const ship of this.state.ships) {
      if (ship.health <= 0) continue;
      this.updateShipAI(ship, dt);
    }
  }

  /**
   * Update AI for a single ship (public for legacy stepShipAI delegation)
   */
  updateShipAI(ship: Ship, dt: number) {
    const config = this.state.behaviorConfig!;
    const personality = getEffectivePersonality(config, ship.class, ship.team);

    // Check for personality mode changes and clean up accordingly
    if (ship.aiState) {
      if (personality.mode !== 'roaming') {
        this.releaseRoamingAnchor(ship);
      }
      if (personality.mode !== 'formation') {
        this.clearFormationSlot(ship);
      }
    }

    // Initialize AI state if needed
    if (!ship.aiState) {
      ship.aiState = {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: this.calculatePreferredRange(ship, personality),
        recentDamage: 0,
        lastDamageTime: 0
      };
    }

    const aiState = ship.aiState;

    // Update recent damage decay
    this.updateRecentDamage(ship, dt);

    // Force intent reevaluation if ship has taken significant damage within the time window
    const recentDamage = aiState.recentDamage || 0;
    const lastDamageTime = aiState.lastDamageTime || 0;
    const timeSinceLastDamage = this.state.time - lastDamageTime;
    const withinDamageWindow = timeSinceLastDamage <= this.state.behaviorConfig!.globalSettings.evadeRecentDamageWindowSeconds;
    const shouldForceReevaluation = recentDamage >= this.state.behaviorConfig!.globalSettings.damageEvadeThreshold && withinDamageWindow;

    // Reevaluate intent if needed (either by time or by damage)
    if (shouldForceReevaluation || this.state.time - aiState.lastIntentReevaluation >= personality.intentReevaluationRate) {
      this.reevaluateIntent(ship, personality);
      aiState.lastIntentReevaluation = this.state.time;
    }

    // Execute current intent
    this.executeIntent(ship, aiState.currentIntent, dt);

    // Update turret AI
    this.updateTurretAI(ship, dt);

    // Handle shield regeneration
    this.updateShieldRegeneration(ship, dt);
  }

  /**
   * Update recent damage decay over time
   */
  private updateRecentDamage(ship: Ship, dt: number) {
    const aiState = ship.aiState!;
    const config = this.state.behaviorConfig!;
    
    if (aiState.recentDamage && aiState.recentDamage > 0) {
      const decayAmount = config.globalSettings.damageDecayRate * dt;
      aiState.recentDamage = Math.max(0, aiState.recentDamage - decayAmount);
    }
  }

  /**
   * Check for ships taking damage and trigger team alarms
   */
  private updateTeamAlarms() {
    const config = this.state.behaviorConfig!;
    if (!config.globalSettings.enableAlarmSystem) return;

    for (const ship of this.state.ships) {
      if (ship.health <= 0 || !ship.aiState) continue;
      
      const aiState = ship.aiState;
      const timeSinceLastDamage = this.state.time - (aiState.lastDamageTime || 0);
      
      // If ship took damage recently, trigger alarm for their team
      if (timeSinceLastDamage <= config.globalSettings.alarmSystemWindowSeconds) {
        this.teamAlarmTimes.set(ship.team, this.state.time);
      }
    }
  }

  /**
   * Update scout assignments - ensure at least one ship per team is pursuing
   */
  private updateScoutAssignments() {
    const config = this.state.behaviorConfig!;
    if (!config.globalSettings.enableScoutBehavior) return;

    for (const team of ['red', 'blue'] as Team[]) {
      const teamShips = this.state.ships.filter(s => s.team === team && s.health > 0);
      if (teamShips.length === 0) continue;

      let currentScout = this.teamScouts.get(team);
      let scoutShip = currentScout ? teamShips.find(s => s.id === currentScout) : null;

      // If current scout is dead/gone or there's no scout, assign a new one
      if (!scoutShip) {
        const enemies = this.state.ships.filter(s => s.team !== team && s.health > 0);
        let bestScout = teamShips[0];
        
        if (enemies.length > 0) {
          // Pick the ship closest to any enemy as the scout
          let bestDistance = Infinity;

          for (const ship of teamShips) {
            for (const enemy of enemies) {
              const distance = this.getDistance(ship.pos, enemy.pos);
              if (distance < bestDistance) {
                bestDistance = distance;
                bestScout = ship;
              }
            }
          }
        } else {
          // No enemies visible - pick a scout for exploration
          // For now, pick the first ship, but could use other criteria
          bestScout = teamShips[0];
        }

        this.teamScouts.set(team, bestScout.id);
      }
    }
  }

  /**
   * Reevaluate what the ship should be doing
   */
  private reevaluateIntent(ship: Ship, personality: AIPersonality) {
    const aiState = ship.aiState!;
    const config = this.state.behaviorConfig!;

    // Check if ship has taken significant recent damage and should evade
    const recentDamage = aiState.recentDamage || 0;
    const lastDamageTime = aiState.lastDamageTime || 0;
    const timeSinceLastDamage = this.state.time - lastDamageTime;
    const withinDamageWindow = timeSinceLastDamage <= config.globalSettings.evadeRecentDamageWindowSeconds;
    const shouldEvadeFromDamage = recentDamage >= config.globalSettings.damageEvadeThreshold && withinDamageWindow;

    // Don't change intent if we're still committed to current one, UNLESS we need to evade due to damage
    if (this.state.time < aiState.intentEndTime && !shouldEvadeFromDamage) {
      return;
    }

    const oldIntent = aiState.currentIntent;
    let newIntent: AIIntent = 'idle';
    let intentDuration = personality.minIntentDuration;

    if (shouldEvadeFromDamage) {
      newIntent = 'evade';
      // Shorter duration for damage-based evade to allow quick reassessment
      intentDuration = Math.min(intentDuration, 3.0);
    } else {
      // Normal intent selection based on personality mode
      switch (personality.mode) {
        case 'aggressive':
          newIntent = this.chooseAggressiveIntent(ship, personality);
          break;
        case 'defensive':
          newIntent = this.chooseDefensiveIntent(ship, personality);
          break;
        case 'roaming':
          newIntent = this.chooseRoamingIntent(ship, personality);
          break;
        case 'formation':
          newIntent = this.chooseFormationIntent(ship, personality);
          break;
        case 'carrier_group':
          newIntent = this.chooseCarrierGroupIntent(ship, personality);
          break;
        case 'mixed':
          newIntent = this.chooseMixedIntent(ship, personality);
          break;
      }
    }

    // Release roaming anchor if patrol intent changes
    if (newIntent !== 'patrol' && oldIntent === 'patrol') {
      this.releaseRoamingAnchor(ship);
    }

    // Set intent duration
    const durationRange = personality.maxIntentDuration - personality.minIntentDuration;
    intentDuration += this.state.rng.next() * durationRange;

    aiState.currentIntent = newIntent;
    aiState.intentEndTime = this.state.time + intentDuration;
  }

  /**
   * Choose intent for aggressive behavior
   */
  private chooseAggressiveIntent(ship: Ship, personality: AIPersonality): AIIntent {
    const config = this.state.behaviorConfig!;
    const nearestEnemy = this.findNearestEnemy(ship);
    if (nearestEnemy) {
      const distance = this.getDistance(ship.pos, nearestEnemy.pos);
      const preferredRange = ship.aiState!.preferredRange!;

      // Check if this ship is the designated scout
      const isScout = config.globalSettings.enableScoutBehavior && 
                     this.teamScouts.get(ship.team) === ship.id;

      // Check if team is under alarm (recent friendly damage)
      const teamAlarmTime = this.teamAlarmTimes.get(ship.team) || 0;
      const timeSinceAlarm = this.state.time - teamAlarmTime;
      const teamUnderAlarm = config.globalSettings.enableAlarmSystem && 
                           timeSinceAlarm <= config.globalSettings.alarmSystemWindowSeconds;

      // Close/medium range checks use configurable multipliers
      if (distance < preferredRange * config.globalSettings.closeRangeMultiplier) {
        return 'pursue';
      }

      if (distance < preferredRange * config.globalSettings.mediumRangeMultiplier) {
        return 'pursue';
      }

      // Scout always pursues nearest enemy regardless of range
      if (isScout) {
        return 'pursue';
      }

      // During team alarm, idle/strafing ships switch to pursue
      if (teamUnderAlarm) {
        return 'pursue';
      }

      // Otherwise fall back to probabilistic behavior influenced by aggressiveness
      return this.state.rng.next() < personality.aggressiveness ? 'pursue' : 'strafe';
    }
    // No visible enemy -> scouts explore, others patrol
    const isScout = config.globalSettings.enableScoutBehavior && 
                   this.teamScouts.get(ship.team) === ship.id;
    
    return isScout && config.globalSettings.enableScoutExploration ? 'explore' : 'patrol';
  }
  /**
   * Choose intent for defensive behavior
   */
  private chooseDefensiveIntent(ship: Ship, personality: AIPersonality): AIIntent {
    const config = this.state.behaviorConfig!;
    
    // Check if this ship is the designated scout
    const isScout = config.globalSettings.enableScoutBehavior && 
                   this.teamScouts.get(ship.team) === ship.id;

    // Check if team is under alarm (recent friendly damage)
    const teamAlarmTime = this.teamAlarmTimes.get(ship.team) || 0;
    const timeSinceAlarm = this.state.time - teamAlarmTime;
    const teamUnderAlarm = config.globalSettings.enableAlarmSystem && 
                         timeSinceAlarm <= config.globalSettings.alarmSystemWindowSeconds;

    // Scout ships always pursue, or during team alarm
    if (isScout || teamUnderAlarm) {
      return this.chooseAggressiveIntent(ship, personality);
    }
    
    const threats = this.findNearbyEnemies(ship, ship.aiState!.preferredRange! * 2);
    if (threats.length > 0) {
      const nearestThreat = threats[0];
      const distance = this.getDistance(ship.pos, nearestThreat.pos);
      if (distance < ship.aiState!.preferredRange! * config.globalSettings.closeRangeMultiplier) {
        // Only evade if config allows it OR ship has recently taken damage within the time window
        if (!config.globalSettings.evadeOnlyOnDamage) {
          // Backwards compatibility: allow proximity-based evade
          return 'evade';
        } else {
          // New behavior: only evade if recently damaged within the time window
          const recentDamage = ship.aiState!.recentDamage || 0;
          const lastDamageTime = ship.aiState!.lastDamageTime || 0;
          const timeSinceLastDamage = this.state.time - lastDamageTime;
          const withinDamageWindow = timeSinceLastDamage <= config.globalSettings.evadeRecentDamageWindowSeconds;
          
          if (recentDamage >= config.globalSettings.damageEvadeThreshold && withinDamageWindow) {
            return 'evade';
          }
          // Otherwise, choose more aggressive behavior
          return this.state.rng.next() < 0.7 ? 'group' : 'patrol';
        }
      }
    }
    // No threats -> scouts explore, others follow groupCohesion
    const isTeamScout = config.globalSettings.enableScoutBehavior && 
                       this.teamScouts.get(ship.team) === ship.id;
    
    if (isTeamScout && config.globalSettings.enableScoutExploration) {
      return 'explore';
    }
    
    return this.state.rng.next() < personality.groupCohesion ? 'group' : 'patrol';
  }

  /**
   * Choose intent for roaming behavior
   */
  private chooseRoamingIntent(ship: Ship, personality: AIPersonality): AIIntent {
    const aiState = ship.aiState!;
    const config = this.state.behaviorConfig!;

    // Check if this ship is the designated scout
    const isScout = config.globalSettings.enableScoutBehavior && 
                   this.teamScouts.get(ship.team) === ship.id;

    // Check if team is under alarm (recent friendly damage)
    const teamAlarmTime = this.teamAlarmTimes.get(ship.team) || 0;
    const timeSinceAlarm = this.state.time - teamAlarmTime;
    const teamUnderAlarm = config.globalSettings.enableAlarmSystem && 
                         timeSinceAlarm <= config.globalSettings.alarmSystemWindowSeconds;

    // Scout ships always pursue, or during team alarm
    if (isScout || teamUnderAlarm) {
      return this.chooseAggressiveIntent(ship, personality);
    }

    // Assign roaming anchor if not already assigned
    if (!aiState.roamingAnchor) {
      aiState.roamingAnchor = this.assignRoamingAnchor(ship);
    }

    // Start or continue roaming pattern
    if (!aiState.roamingPattern || this.state.time > (aiState.roamingStartTime || 0) + (aiState.roamingPattern.duration)) {
      aiState.roamingPattern = selectRoamingPattern(this.state.behaviorConfig!);
      aiState.roamingStartTime = this.state.time;
    }

    // Occasionally check for enemies
    if (this.state.rng.next() < personality.aggressiveness * 0.3) {
      const nearestEnemy = this.findNearestEnemy(ship);
      if (nearestEnemy && this.getDistance(ship.pos, nearestEnemy.pos) < ship.aiState!.preferredRange!) {
        return 'pursue';
      }
    }

    // If no enemies found, scouts should explore
    if (isScout && config.globalSettings.enableScoutExploration) {
      return 'explore';
    }

    return 'patrol';
  }

  /**
   * Choose intent for formation behavior
   */
  private chooseFormationIntent(ship: Ship, personality: AIPersonality): AIIntent {
    // Look for formation opportunities
    const formation = this.findBestFormation(ship);
    if (formation) {
      // Find formation center (could be a leader ship or group center)
      const center = this.getFormationCenter(ship, formation.name);
      if (center) {
        ship.aiState!.formationId = formation.name;
        // Assign a unique slot in the formation
        this.assignFormationSlot(ship, formation.name, formation.config, center);
        return 'group';
      }
    }

    // Fallback to other behaviors
    return this.chooseMixedIntent(ship, personality);
  }

  /**
   * Choose intent for carrier group behavior
   */
  private chooseCarrierGroupIntent(ship: Ship, personality: AIPersonality): AIIntent {
    if (ship.class === 'carrier') {
      // Carriers try to maintain escorts
      return 'group';
    } else if (ship.parentCarrierId) {
      // Fighters/carriers escort their carrier
      return 'group';
    }

    // Other ships in carrier groups act defensively
    return this.chooseDefensiveIntent(ship, personality);
  }

  /**
   * Choose intent for mixed behavior (dynamic)
   */
  private chooseMixedIntent(ship: Ship, personality: AIPersonality): AIIntent {
    const config = this.state.behaviorConfig!;

    // Check if this ship is the designated scout
    const isScout = config.globalSettings.enableScoutBehavior && 
                   this.teamScouts.get(ship.team) === ship.id;

    // Check if team is under alarm (recent friendly damage)
    const teamAlarmTime = this.teamAlarmTimes.get(ship.team) || 0;
    const timeSinceAlarm = this.state.time - teamAlarmTime;
    const teamUnderAlarm = config.globalSettings.enableAlarmSystem && 
                         timeSinceAlarm <= config.globalSettings.alarmSystemWindowSeconds;

    // Scout ships always use aggressive behavior to pursue enemies
    if (isScout || teamUnderAlarm) {
      return this.chooseAggressiveIntent(ship, personality);
    }

    const rand = this.state.rng.next();

    // Bias towards personality traits
    if (rand < personality.aggressiveness) {
      return this.chooseAggressiveIntent(ship, personality);
    } else if (rand < personality.aggressiveness + personality.caution) {
      return this.chooseDefensiveIntent(ship, personality);
    } else if (rand < personality.aggressiveness + personality.caution + personality.groupCohesion) {
      return 'group';
    } else {
      return 'patrol';
    }
  }

  /**
   * Execute the current intent
   */
  private executeIntent(ship: Ship, intent: AIIntent, dt: number) {
    switch (intent) {
      case 'idle':
        this.executeIdle(ship, dt);
        break;
      case 'pursue':
        this.executePursue(ship, dt);
        break;
      case 'evade':
        this.executeEvade(ship, dt);
        break;
      case 'strafe':
        this.executeStrafe(ship, dt);
        break;
      case 'group':
        this.executeGroup(ship, dt);
        break;
      case 'patrol':
        this.executePatrol(ship, dt);
        break;
      case 'explore':
        this.executeScoutExploration(ship, dt);
        break;
      case 'retreat':
        this.executeRetreat(ship, dt);
        break;
    }
  }

  /**
   * Execute idle behavior - minimal movement
   */
  private executeIdle(ship: Ship, dt: number) {
    // Slow drift
    ship.vel.x *= 0.95;
    ship.vel.y *= 0.95;
    ship.vel.z *= 0.95;

    // Apply a mild separation force even while idle so clustered ships gently spread out.
    // This helps scenarios where ships start tightly clustered but don't have an active movement intent yet.
    const config = this.state.behaviorConfig!;
    if (config && config.globalSettings.separationWeight > 0) {
      // Use separation force and also know how many close neighbors exist so we can
      // amplify the idle separation when ships are tightly clustered.
      const sepWithCount = this.calculateSeparationForceWithCount(ship);
      const sep = sepWithCount.force;
      const neighborCount = sepWithCount.neighborCount;

      // Base reduced effect while idle
      let weight = config.globalSettings.separationWeight * 0.5;

      // If ship has many close neighbors, increase the idle separation strength
      // Use graduated scaling so extreme clusters receive a stronger nudge.
      if (neighborCount >= config.globalSettings.separationVeryTightCluster) {
        // Very tight cluster: apply a strong nudge
        weight = config.globalSettings.separationWeight * config.globalSettings.separationVeryTightWeight;
      } else if (neighborCount >= config.globalSettings.separationModerateCluster) {
        // Moderate cluster
        weight = config.globalSettings.separationWeight * config.globalSettings.separationModerateWeight;
      } else if (neighborCount >= config.globalSettings.separationMildCluster) {
        // Mild increase for small clusters
        weight = config.globalSettings.separationWeight * config.globalSettings.separationMildWeight;
      }

      const speedFactor = Math.max(1, ship.speed * 0.2);
      ship.vel.x += sep.x * weight * speedFactor * dt;
      ship.vel.y += sep.y * weight * speedFactor * dt;
      ship.vel.z += sep.z * weight * speedFactor * dt;

      // Additionally, when tightly clustered, apply a small direct positional nudge
      // to break symmetry quickly in tests / initial spawn scenarios. This is
      // intentionally conservative and scales with neighborCount so it only
      // becomes noticeable for dense clusters.
      if (neighborCount >= config.globalSettings.separationMildCluster) {
        const separationDistance = config.globalSettings.separationDistance;
        // displacement per second (units/sec) - small fraction of separationDistance
        const displacementPerSecond = (separationDistance * 0.05) * (neighborCount / 5);
        ship.pos.x += sep.x * displacementPerSecond * dt;
        ship.pos.y += sep.y * displacementPerSecond * dt;
        ship.pos.z += sep.z * displacementPerSecond * dt;
      }
    }
  }

  /**
   * Execute pursue behavior - move towards target
   */
  private executePursue(ship: Ship, dt: number) {
    const target = ship.targetId ? this.state.ships.find(s => s.id === ship.targetId) : null;
    if (!target) return;

    this.moveTowards(ship, target.pos, dt);
  }

  /**
   * Execute evade behavior - intelligently sample escape directions and select safest
   */
  private executeEvade(ship: Ship, dt: number) {
    const config = this.state.behaviorConfig!;
    const threats = this.findNearbyEnemies(ship, ship.aiState!.preferredRange! * 1.5);
    if (threats.length === 0) return;

    const samplingCount = config.globalSettings.evadeSamplingCount;
    const evadeDistance = config.globalSettings.evadeDistance;

    // Generate candidate escape directions
    const candidates: Array<{pos: Vector3, score: number}> = [];

    // Always include the naive "direct away" candidate for comparison
    const nearestThreat = threats[0];
    const awayDir = this.normalizeVector({
      x: ship.pos.x - nearestThreat.pos.x,
      y: ship.pos.y - nearestThreat.pos.y,
      z: ship.pos.z - nearestThreat.pos.z
    });

    const naiveTarget = {
      x: ship.pos.x + awayDir.x * evadeDistance,
      y: ship.pos.y + awayDir.y * evadeDistance,
      z: ship.pos.z + awayDir.z * evadeDistance
    };
    candidates.push({pos: naiveTarget, score: this.calculateEscapeScore(ship, naiveTarget, threats)});

    // Sample additional random directions around the ship
    for (let i = 1; i < samplingCount; i++) {
      const randomAngle = this.state.rng.next() * Math.PI * 2;
      const randomPitch = (this.state.rng.next() - 0.5) * config.globalSettings.evadeMaxPitch;
      
      const candidate = {
        x: ship.pos.x + Math.cos(randomAngle) * Math.cos(randomPitch) * evadeDistance,
        y: ship.pos.y + Math.sin(randomAngle) * Math.cos(randomPitch) * evadeDistance,
        z: ship.pos.z + Math.sin(randomPitch) * evadeDistance
      };
      
      candidates.push({pos: candidate, score: this.calculateEscapeScore(ship, candidate, threats)});
    }

    // Select the best candidate
    const bestCandidate = candidates.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    this.moveTowards(ship, bestCandidate.pos, dt);
  }

  /**
   * Calculate safety score for an escape position
   * Higher score = safer position
   */
  private calculateEscapeScore(ship: Ship, targetPos: Vector3, threats: Ship[]): number {
    const bounds = this.state.simConfig.simBounds;
    const config = this.state.behaviorConfig!;
    let score = config.globalSettings.evadeBaseScore; // Base score

    // Penalty for proximity to threats
    for (const threat of threats) {
      const distance = this.getDistance(targetPos, threat.pos);
      const threatPenalty = Math.max(0, 200 - distance) * config.globalSettings.evadeThreatPenaltyWeight;
      score -= threatPenalty;
    }

    // Penalty for being near boundaries
    const boundaryMargin = config.globalSettings.boundarySafetyMargin;
    if (targetPos.x < boundaryMargin) score -= (boundaryMargin - targetPos.x) * config.globalSettings.evadeBoundaryPenaltyWeight;
    if (targetPos.x > bounds.width - boundaryMargin) score -= (targetPos.x - (bounds.width - boundaryMargin)) * config.globalSettings.evadeBoundaryPenaltyWeight;
    if (targetPos.y < boundaryMargin) score -= (boundaryMargin - targetPos.y) * config.globalSettings.evadeBoundaryPenaltyWeight;
    if (targetPos.y > bounds.height - boundaryMargin) score -= (targetPos.y - (bounds.height - boundaryMargin)) * config.globalSettings.evadeBoundaryPenaltyWeight;
    if (targetPos.z < boundaryMargin) score -= (boundaryMargin - targetPos.z) * config.globalSettings.evadeBoundaryPenaltyWeight;
    if (targetPos.z > bounds.depth - boundaryMargin) score -= (targetPos.z - (bounds.depth - boundaryMargin)) * config.globalSettings.evadeBoundaryPenaltyWeight;

    // Bonus for increasing distance from nearest threat
    const currentDistance = this.getDistance(ship.pos, threats[0].pos);
    const newDistance = this.getDistance(targetPos, threats[0].pos);
    if (newDistance > currentDistance) {
      score += (newDistance - currentDistance) * config.globalSettings.evadeDistanceImprovementWeight;
    }

    // Penalty for getting too close to friendly ships
    for (const friendly of this.state.ships) {
      if (friendly.team === ship.team && friendly.id !== ship.id && friendly.health > 0) {
        const distance = this.getDistance(targetPos, friendly.pos);
        if (distance < config.globalSettings.friendlyAvoidanceDistance) {
          score -= (config.globalSettings.friendlyAvoidanceDistance - distance) * config.globalSettings.evadeFriendlyPenaltyWeight;
        }
      }
    }

    return score;
  }

  /**
   * Normalize a vector to unit length
   */
  private normalizeVector(vec: Vector3): Vector3 {
    const length = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
    if (length === 0) return {x: 1, y: 0, z: 0}; // Default direction
    return {
      x: vec.x / length,
      y: vec.y / length,
      z: vec.z / length
    };
  }

  /**
   * Execute strafe behavior - circle around target
   */
  private executeStrafe(ship: Ship, dt: number) {
    const target = ship.targetId ? this.state.ships.find(s => s.id === ship.targetId) : null;
    if (!target) return;

    // Circle around target
    const angle = Math.atan2(ship.pos.y - target.pos.y, ship.pos.x - target.pos.x) + dt;
    const radius = 150;
    const strafePos = {
      x: target.pos.x + Math.cos(angle) * radius,
      y: target.pos.y + Math.sin(angle) * radius,
      z: target.pos.z
    };

    this.moveTowards(ship, strafePos, dt);
  }

  /**
   * Execute group behavior - move towards formation position
   */
  private executeGroup(ship: Ship, dt: number) {
    const aiState = ship.aiState!;
    let targetPos: Vector3;

    if (aiState.formationPosition) {
      targetPos = aiState.formationPosition;
    } else {
      // Find friendly ships to group with
      const friends = this.findNearbyFriends(ship, 300);
      if (friends.length > 0) {
        // Move towards center of friend group
        targetPos = this.calculateGroupCenter(friends);
      } else {
        // No friends nearby, patrol
        return this.executePatrol(ship, dt);
      }
    }

    this.moveTowardsWithSeparation(ship, targetPos, dt);
  }

  /**
   * Execute patrol behavior - follow roaming pattern
   */
  private executePatrol(ship: Ship, dt: number) {
    const aiState = ship.aiState!;
    const pattern = aiState.roamingPattern;

    if (!pattern) {
      return this.executeIdle(ship, dt);
    }

    // Use roaming anchor as center, fallback to ship position if no anchor
    const center = aiState.roamingAnchor || ship.pos;
    let targetPos: Vector3;

    switch (pattern.type) {
      case 'random':
        if (!aiState.roamingStartTime || this.state.time > aiState.roamingStartTime + 5) {
          const angle = this.state.rng.next() * Math.PI * 2;
          const distance = this.state.rng.next() * pattern.radius;
          targetPos = {
            x: center.x + Math.cos(angle) * distance,
            y: center.y + Math.sin(angle) * distance,
            z: center.z + (this.state.rng.next() - 0.5) * pattern.radius * 0.5
          };
          aiState.roamingStartTime = this.state.time;
        } else {
          return; // Continue to current target
        }
        break;

      case 'circular':
        const time = this.state.time - (aiState.roamingStartTime || 0);
        const angle = (time / pattern.duration) * Math.PI * 2;
        targetPos = {
          x: center.x + Math.cos(angle) * pattern.radius,
          y: center.y + Math.sin(angle) * pattern.radius,
          z: center.z
        };
        break;

      case 'figure_eight':
        const t = this.state.time - (aiState.roamingStartTime || 0);
        const figureAngle = (t / pattern.duration) * Math.PI * 2;
        targetPos = {
          x: center.x + Math.sin(figureAngle) * pattern.radius,
          y: center.y + Math.sin(figureAngle * 2) * pattern.radius * 0.5,
          z: center.z
        };
        break;

      default:
        return this.executeIdle(ship, dt);
    }

    this.moveTowards(ship, targetPos, dt, pattern.speed);
  }

  /**
   * Execute retreat behavior - move to safe position
   */
  private executeRetreat(ship: Ship, dt: number) {
    // Move towards friendly territory or safe zone
    const bounds = this.state.simConfig.simBounds;
    let safePos: Vector3;

    if (ship.team === 'red') {
      safePos = { x: 100, y: bounds.height / 2, z: bounds.depth / 2 };
    } else {
      safePos = { x: bounds.width - 100, y: bounds.height / 2, z: bounds.depth / 2 };
    }

    this.moveTowards(ship, safePos, dt);
  }

  /**
   * Execute scout exploration behavior when no enemies are visible
   */
  private executeScoutExploration(ship: Ship, dt: number) {
    const config = this.state.behaviorConfig!;
    if (!config.globalSettings.enableScoutExploration) {
      return this.executePatrol(ship, dt);
    }

    const aiState = ship.aiState!;
    const bounds = this.state.simConfig.simBounds;
    
    // Create exploration zones in a grid pattern
    const zoneCount = config.globalSettings.explorationZoneCount;
    const zoneDuration = config.globalSettings.explorationZoneDuration;
    
    // Determine grid dimensions (try to make it roughly square)
    const gridSize = Math.ceil(Math.sqrt(zoneCount));
    const zoneWidth = bounds.width / gridSize;
    const zoneHeight = bounds.height / gridSize;
    
    // Cycle through zones based on time
    const currentTime = this.state.time;
    const totalCycleDuration = zoneCount * zoneDuration;
    const cycleTime = currentTime % totalCycleDuration;
    const currentZoneIndex = Math.floor(cycleTime / zoneDuration);
    
    // Calculate target zone center
    const zoneRow = Math.floor(currentZoneIndex / gridSize);
    const zoneCol = currentZoneIndex % gridSize;
    const targetPos: Vector3 = {
      x: (zoneCol + 0.5) * zoneWidth,
      y: (zoneRow + 0.5) * zoneHeight,
      z: bounds.depth / 2
    };
    
    // Move towards the current exploration zone
    this.moveTowards(ship, targetPos, dt);
  }

  /**
   * Move ship towards a target position using 3D steering
   */
  private moveTowards(ship: Ship, targetPos: Vector3, dt: number, speed?: number) {
    const moveSpeed = speed || ship.speed;
    const config = this.state.behaviorConfig!;

    // Calculate desired direction
    const dx = targetPos.x - ship.pos.x;
    const dy = targetPos.y - ship.pos.y;
    const dz = targetPos.z - ship.pos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < config.globalSettings.movementCloseEnoughThreshold) return; // Close enough

    // Calculate desired 3D orientation to look at target
    const targetOrientation = lookAt(ship.pos, targetPos);
    
    // Calculate angular differences for pitch and yaw
    const pitchDiff = angleDifference(ship.orientation.pitch, targetOrientation.pitch);
    const yawDiff = angleDifference(ship.orientation.yaw, targetOrientation.yaw);
    
    // Apply turn rate limits to both pitch and yaw
    const pitchTurn = clampTurn(pitchDiff, ship.turnRate * dt);
    const yawTurn = clampTurn(yawDiff, ship.turnRate * dt);
    
    // Update 3D orientation
    ship.orientation.pitch += pitchTurn;
    ship.orientation.yaw += yawTurn;
    
    // Keep legacy dir field in sync with yaw for backward compatibility
    ship.dir = ship.orientation.yaw;

    // Move forward using 3D forward vector
    const forward = getForwardVector(ship.orientation.pitch, ship.orientation.yaw);
    const accel = moveSpeed * PhysicsConfig.acceleration.forwardMultiplier;
    
    ship.vel.x += forward.x * accel * dt;
    ship.vel.y += forward.y * accel * dt;
    ship.vel.z += forward.z * accel * dt;

    // Damp and clamp speed using PhysicsConfig
    ship.vel.x *= PhysicsConfig.speed.dampingFactor;
    ship.vel.y *= PhysicsConfig.speed.dampingFactor;
    ship.vel.z *= PhysicsConfig.speed.dampingFactor;

    const maxV = moveSpeed * PhysicsConfig.speed.maxSpeedMultiplier;
    const v = Math.hypot(ship.vel.x, ship.vel.y, ship.vel.z);
    if (v > maxV) {
      ship.vel.x = (ship.vel.x / v) * maxV;
      ship.vel.y = (ship.vel.y / v) * maxV;
      ship.vel.z = (ship.vel.z / v) * maxV;
    }

    // Integrate position
    ship.pos.x += ship.vel.x * dt;
    ship.pos.y += ship.vel.y * dt;
    ship.pos.z += ship.vel.z * dt;

    // Apply boundary physics
    applyBoundaryPhysics(ship, this.state);
  }

  /**
   * Move ship towards a target position with separation steering to avoid clumping using 3D steering
   */
  private moveTowardsWithSeparation(ship: Ship, targetPos: Vector3, dt: number, speed?: number) {
    const config = this.state.behaviorConfig!;
    const separationWeight = config.globalSettings.separationWeight;
    const moveSpeed = speed || ship.speed;

    // Calculate desired direction
    const dx = targetPos.x - ship.pos.x;
    const dy = targetPos.y - ship.pos.y;
    const dz = targetPos.z - ship.pos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < config.globalSettings.movementCloseEnoughThreshold) return; // Close enough

    // Calculate separation force
    const separationForce = this.calculateSeparationForce(ship);

    // Combine desired movement with separation force
    const desiredDirX = dx / distance;
    const desiredDirY = dy / distance;
    const desiredDirZ = dz / distance;

    const combinedX = desiredDirX + separationForce.x * separationWeight;
    const combinedY = desiredDirY + separationForce.y * separationWeight;
    const combinedZ = desiredDirZ + separationForce.z * separationWeight;

    // Normalize combined direction
    const combinedMagnitude = Math.sqrt(combinedX * combinedX + combinedY * combinedY + combinedZ * combinedZ);
    const finalDirX = combinedMagnitude > 0 ? combinedX / combinedMagnitude : desiredDirX;
    const finalDirY = combinedMagnitude > 0 ? combinedY / combinedMagnitude : desiredDirY;
    const finalDirZ = combinedMagnitude > 0 ? combinedZ / combinedMagnitude : desiredDirZ;

    // Calculate desired 3D orientation to look in the combined direction
    const targetLookPos = {
      x: ship.pos.x + finalDirX * 100, // Project forward to get orientation
      y: ship.pos.y + finalDirY * 100,
      z: ship.pos.z + finalDirZ * 100
    };
    const targetOrientation = lookAt(ship.pos, targetLookPos);
    
    // Calculate angular differences for pitch and yaw
    const pitchDiff = angleDifference(ship.orientation.pitch, targetOrientation.pitch);
    const yawDiff = angleDifference(ship.orientation.yaw, targetOrientation.yaw);
    
    // Apply turn rate limits to both pitch and yaw
    const pitchTurn = clampTurn(pitchDiff, ship.turnRate * dt);
    const yawTurn = clampTurn(yawDiff, ship.turnRate * dt);
    
    // Update 3D orientation
    ship.orientation.pitch += pitchTurn;
    ship.orientation.yaw += yawTurn;
    
    // Keep legacy dir field in sync with yaw for backward compatibility
    ship.dir = ship.orientation.yaw;

    // Move forward using 3D forward vector
    const forward = getForwardVector(ship.orientation.pitch, ship.orientation.yaw);
    const accel = moveSpeed * PhysicsConfig.acceleration.forwardMultiplier;
    
    ship.vel.x += forward.x * accel * dt;
    ship.vel.y += forward.y * accel * dt;
    ship.vel.z += forward.z * accel * dt;

    // Damp and clamp speed using PhysicsConfig
    ship.vel.x *= PhysicsConfig.speed.dampingFactor;
    ship.vel.y *= PhysicsConfig.speed.dampingFactor;
    ship.vel.z *= PhysicsConfig.speed.dampingFactor;

    const maxV = moveSpeed * PhysicsConfig.speed.maxSpeedMultiplier;
    const v = Math.hypot(ship.vel.x, ship.vel.y, ship.vel.z);
    if (v > maxV) {
      ship.vel.x = (ship.vel.x / v) * maxV;
      ship.vel.y = (ship.vel.y / v) * maxV;
      ship.vel.z = (ship.vel.z / v) * maxV;
    }

    // Integrate position
    ship.pos.x += ship.vel.x * dt;
    ship.pos.y += ship.vel.y * dt;
    ship.pos.z += ship.vel.z * dt;

    // Apply boundary physics
    applyBoundaryPhysics(ship, this.state);
  }

  /**
   * Update turret AI for independent targeting
   */
  private updateTurretAI(ship: Ship, dt: number) {
    const config = this.state.behaviorConfig!;
    const turretConfig = config.turretConfig;

    if (turretConfig.behavior === 'independent') {
      for (const turret of ship.turrets) {
        if (!turret.aiState) {
          turret.aiState = {
            targetId: null,
            lastTargetUpdate: 0
          };
        }

        const turretState = turret.aiState;

        // Reevaluate target if needed
        if (this.state.time - turretState.lastTargetUpdate >= turretConfig.targetReevaluationRate) {
          turretState.targetId = this.findBestTurretTarget(ship, turret);
          turretState.lastTargetUpdate = this.state.time;
        }
      }
      // Ensure ship.targetId is set so the global firing logic (fireTurrets)
      // has a target to shoot at. Prefer a target that multiple turrets agree on;
      // otherwise fall back to nearest enemy.
      const turretTargets = ship.turrets
        .map(t => t.aiState?.targetId)
        .filter((id): id is number => typeof id === 'number');

      if (turretTargets.length > 0) {
        const counts = new Map<number, number>();
        for (const id of turretTargets) counts.set(id, (counts.get(id) || 0) + 1);
        let bestId: number | null = null;
        let bestCount = 0;
        for (const [id, count] of counts.entries()) {
          if (count > bestCount) { bestCount = count; bestId = id; }
        }
        ship.targetId = bestId ?? null;
      } else {
        const nearest = this.findNearestEnemy(ship);
        ship.targetId = nearest ? nearest.id : null;
      }
    }
  }

  /**
   * Update shield regeneration for a ship
   */
  private updateShieldRegeneration(ship: Ship, dt: number) {
    // Simple shield regeneration - clamp to prevent overflow
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    ship.shield = clamp(ship.shield + ship.shieldRegen * dt, 0, ship.maxShield);
  }

  /**
   * Find best target for a turret
   */
  private findBestTurretTarget(ship: Ship, turret: TurretState): EntityId | null {
    const config = this.state.behaviorConfig!;
    const turretConfig = config.turretConfig;

    let bestTarget: Ship | null = null;
    let bestScore = 0;

    for (const target of this.state.ships) {
      if (target.team === ship.team || target.health <= 0) continue;

      const distance = this.getDistance(ship.pos, target.pos);
      if (distance < turretConfig.minimumFireRange || distance > turretConfig.maximumFireRange) {
        continue;
      }

      // Score based on distance, health, and other factors
      let score = 1000 / distance; // Closer is better
      score += (target.maxHealth - target.health) * 0.1; // Weaker targets preferred
      score += target.level.level * 5; // Higher level targets worth more

      if (score > bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    }

    return bestTarget?.id || null;
  }

  /**
   * Find nearest enemy to a ship
   */
  private findNearestEnemy(ship: Ship): Ship | null {
    // Use spatial index if available and enabled
    if (this.state.spatialGrid && this.state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      return this.findNearestEnemySpatial(ship);
    }
    
    // Fallback to linear search
    return this.findNearestEnemyLinear(ship);
  }

  /**
   * Find nearest enemy using spatial index
   */
  private findNearestEnemySpatial(ship: Ship): Ship | null {
    if (!this.state.spatialGrid) return null;
    
    // Check if spatial grid is empty and needs updating
    const empty = this.state.spatialGrid.isEmpty();
    if (empty && this.state.ships.length > 0) {
      this.updateSpatialGridImmediate();
    }
    
    // Query k=1 nearest enemies
    const nearestEntities = this.state.spatialGrid.queryKNearest(ship.pos, 1, ship.team === 'red' ? 'blue' : 'red');
    
    if (nearestEntities.length === 0) return null;
    
    // Get the actual ship object
    const nearestEntity = nearestEntities[0];
    return this.state.shipIndex?.get(nearestEntity.id) || null;
  }

  /**
   * Find nearest enemy using linear search (fallback)
   */
  private findNearestEnemyLinear(ship: Ship): Ship | null {
    let best: Ship | null = null;
    let bestDist = Infinity;

    for (const s of this.state.ships) {
      if (s.team === ship.team || s.health <= 0) continue;

      const dist = this.getDistance(ship.pos, s.pos);
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }

    return best;
  }

  /**
   * Find nearby enemies within range
   */
  private findNearbyEnemies(ship: Ship, range: number): Ship[] {
    // Use spatial index if available and enabled
    if (this.state.spatialGrid && this.state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      return this.findNearbyEnemiesSpatial(ship, range);
    }
    
    // Fallback to linear search
    return this.findNearbyEnemiesLinear(ship, range);
  }

  /**
   * Find nearby enemies using spatial index
   */
  private findNearbyEnemiesSpatial(ship: Ship, range: number): Ship[] {
    if (!this.state.spatialGrid) return [];
    
    // Check if spatial grid is empty and needs updating
    const empty = this.state.spatialGrid.isEmpty();
    if (empty && this.state.ships.length > 0) {
      this.updateSpatialGridImmediate();
    }
    
    // Use streaming iteration to avoid array allocation
    const enemies: Ship[] = [];
    this.state.spatialGrid.forEachInRadius(ship.pos, range, (_dx, _dy, _dz, _distSq, entity) => {
      if (entity.team !== ship.team) {
        const enemyShip = this.state.shipIndex?.get(entity.id);
        if (enemyShip && enemyShip.health > 0) {
          enemies.push(enemyShip);
        }
      }
    });
    
    return enemies.sort((a, b) => this.getDistance(ship.pos, a.pos) - this.getDistance(ship.pos, b.pos));
  }

  /**
   * Find nearby enemies using linear search (fallback)
   */
  private findNearbyEnemiesLinear(ship: Ship, range: number): Ship[] {
    const enemies: Ship[] = [];

    for (const s of this.state.ships) {
      if (s.team === ship.team || s.health <= 0) continue;

      const dist = this.getDistance(ship.pos, s.pos);
      if (dist <= range) {
        enemies.push(s);
      }
    }

    return enemies.sort((a, b) => this.getDistance(ship.pos, a.pos) - this.getDistance(ship.pos, b.pos));
  }

  /**
   * Find nearby friendly ships
   */
  private findNearbyFriends(ship: Ship, range: number): Ship[] {
    // Use spatial index if available and enabled
    if (this.state.spatialGrid && this.state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      return this.findNearbyFriendsSpatial(ship, range);
    }
    
    // Fallback to linear search
    return this.findNearbyFriendsLinear(ship, range);
  }

  /**
   * Find nearby friendly ships using spatial index
   */
  private findNearbyFriendsSpatial(ship: Ship, range: number): Ship[] {
    if (!this.state.spatialGrid) return [];
    
    // Check if spatial grid is empty and needs updating (for tests and edge cases)
    const empty = this.state.spatialGrid.isEmpty();
    if (empty && this.state.ships.length > 0) {
      this.updateSpatialGridImmediate();
    }
    
    // Use streaming iteration to avoid array allocation
    const friends: Ship[] = [];
    this.state.spatialGrid.forEachInRadius(ship.pos, range, (_dx, _dy, _dz, _distSq, entity) => {
      if (entity.team === ship.team && entity.id !== ship.id) {
        const friendShip = this.state.shipIndex?.get(entity.id);
        if (friendShip && friendShip.health > 0) {
          friends.push(friendShip);
        }
      }
    });
    
    return friends;
  }

  /**
   * Update spatial grid immediately (for tests and edge cases when not called via simulateStep)
   */
  private updateSpatialGridImmediate() {
    if (!this.state.spatialGrid) return;
    
    this.state.spatialGrid.clear();
    for (const ship of this.state.ships) {
      if (ship.health > 0) {
        this.state.spatialGrid.insert({
          id: ship.id,
          pos: ship.pos,
          radius: 16,
          team: ship.team
        });
      }
    }
  }

  /**
   * Find nearby friendly ships using linear search (fallback)
   */
  private findNearbyFriendsLinear(ship: Ship, range: number): Ship[] {
    const friends: Ship[] = [];

    for (const s of this.state.ships) {
      if (s.team !== ship.team || s.health <= 0 || s.id === ship.id) continue;

      const dist = this.getDistance(ship.pos, s.pos);
      if (dist <= range) {
        friends.push(s);
      }
    }

    return friends;
  }

  /**
   * Calculate center position of a group of ships
   */
  private calculateGroupCenter(ships: Ship[]): Vector3 {
    let x = 0, y = 0, z = 0;

    for (const ship of ships) {
      x += ship.pos.x;
      y += ship.pos.y;
      z += ship.pos.z;
    }

    return {
      x: x / ships.length,
      y: y / ships.length,
      z: z / ships.length
    };
  }

  /**
   * Calculate separation force to avoid clumping with nearby friendly ships
   */
  private calculateSeparationForce(ship: Ship): Vector3 {
    // Delegate to the new helper that returns both force and neighbor count
    return this.calculateSeparationForceWithCount(ship).force;
  }

  /**
   * Public helper: Calculate separation force and the number of neighbors considered.
   * Made public intentionally so unit tests can call it directly.
   * Returns both the normalized force vector and the neighborCount so callers
   * can adjust strength based on cluster density.
   */
  public calculateSeparationForceWithCount(ship: Ship): { force: Vector3; neighborCount: number } {
    const config = this.state.behaviorConfig!;
    const separationDistance = config.globalSettings.separationDistance;

    let separationX = 0;
    let separationY = 0;
    let separationZ = 0;
    let neighborCount = 0;

    // Use spatial index with streaming iteration when enabled; otherwise fallback to linear
    if (this.state.spatialGrid && this.state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      // Fast-path: per-tick cache for repeated identical queries
      const cached = this.sepCache.get(ship.id);
      if (cached && cached.tick === this.state.tick && cached.sepDist === separationDistance &&
          cached.x === ship.pos.x && cached.y === ship.pos.y && cached.z === ship.pos.z) {
        return cached.res;
      }

      // Ensure spatial grid is populated when used outside simulateStep
      const empty = this.state.spatialGrid.isEmpty();
      if (empty && this.state.ships.length > 0) {
        this.updateSpatialGridImmediate();
      }

      this.state.spatialGrid.forEachNeighborsDelta(
        ship.pos,
        separationDistance,
        ship.team,
        ship.id,
        (dxp, dyp, dzp, distSq) => {
          if (distSq <= 0 || distSq >= separationDistance * separationDistance) return;
          const dist = Math.sqrt(distSq);
          const weight = (separationDistance - dist) / separationDistance;
          const inv = 1 / dist;
          separationX += (-dxp) * weight * inv; // dx = ship - other = -(other - ship)
          separationY += (-dyp) * weight * inv;
          separationZ += (-dzp) * weight * inv;
          neighborCount++;
        }
      );
      // Store cache for this tick after computing final normalized force below
      // Store cache for this tick
      const res = { force: { x: 0, y: 0, z: 0 }, neighborCount: 0 } as { force: Vector3; neighborCount: number };
      // We'll fill 'res' fields after normalization below; temporarily stash values
      // Keep interim sums in closure via local variables; we set cache after computing final force
      // To avoid double compute, we'll set after normalization.
      // Defer setting here.
    } else {
      const nearbyFriends = this.getNearbySeparationShipsLinear(ship, separationDistance);
      for (const other of nearbyFriends) {
        const dist = this.getDistance(ship.pos, other.pos);
        if (dist > 0 && dist < separationDistance) {
          const dx = ship.pos.x - other.pos.x;
          const dy = ship.pos.y - other.pos.y;
          const dz = ship.pos.z - other.pos.z;
          const weight = (separationDistance - dist) / separationDistance;
          const inv = 1 / dist;
          separationX += dx * weight * inv;
          separationY += dy * weight * inv;
          separationZ += dz * weight * inv;
          neighborCount++;
        }
      }
    }

    if (neighborCount === 0) {
      const result = { force: { x: 0, y: 0, z: 0 }, neighborCount: 0 };
      if (this.state.spatialGrid && this.state.behaviorConfig?.globalSettings.enableSpatialIndex) {
        this.sepCache.set(ship.id, { x: ship.pos.x, y: ship.pos.y, z: ship.pos.z, sepDist: separationDistance, tick: this.state.tick, res: result });
      }
      return result;
    }

    // Average the raw separation vector
    separationX /= neighborCount;
    separationY /= neighborCount;
    separationZ /= neighborCount;

    const magnitude = Math.sqrt(separationX * separationX + separationY * separationY + separationZ * separationZ);
    if (magnitude > 0.0001) {
      const result = {
        force: {
          x: separationX / magnitude,
          y: separationY / magnitude,
          z: separationZ / magnitude
        },
        neighborCount
      };
      if (this.state.spatialGrid && this.state.behaviorConfig?.globalSettings.enableSpatialIndex) {
        this.sepCache.set(ship.id, { x: ship.pos.x, y: ship.pos.y, z: ship.pos.z, sepDist: separationDistance, tick: this.state.tick, res: result });
      }
      return result;
    }

    // Fallback: if the separation vector is near-zero (symmetrical neighbors),
    // push the ship away from the local group center to break symmetry.
    let centerX = 0, centerY = 0, centerZ = 0;
    
    // Recalculate neighbors for center calculation
    if (this.state.spatialGrid && this.state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      this.state.spatialGrid.forEachNeighborsDelta(
        ship.pos,
        separationDistance,
        ship.team,
        ship.id,
        (_dxp, _dyp, _dzp, distSq, entity) => {
          if (distSq > 0 && distSq < separationDistance * separationDistance) {
            centerX += entity.pos.x;
            centerY += entity.pos.y;
            centerZ += entity.pos.z;
          }
        }
      );
    } else {
      const nearbyFriends = this.getNearbySeparationShipsLinear(ship, separationDistance);
      for (const other of nearbyFriends) {
        const dist = this.getDistance(ship.pos, other.pos);
        if (dist > 0 && dist < separationDistance) {
          centerX += other.pos.x;
          centerY += other.pos.y;
          centerZ += other.pos.z;
        }
      }
    }

    // If we accumulated some neighbors, compute center
    if (centerX !== 0 || centerY !== 0 || centerZ !== 0) {
      const inv = 1 / neighborCount;
      centerX *= inv; centerY *= inv; centerZ *= inv;
      const rx = ship.pos.x - centerX;
      const ry = ship.pos.y - centerY;
      const rz = ship.pos.z - centerZ;
      const rmag = Math.sqrt(rx * rx + ry * ry + rz * rz);
      if (rmag > 0.0001) {
        const result = { force: { x: rx / rmag, y: ry / rmag, z: rz / rmag }, neighborCount };
        if (this.state.spatialGrid && this.state.behaviorConfig?.globalSettings.enableSpatialIndex) {
          this.sepCache.set(ship.id, { x: ship.pos.x, y: ship.pos.y, z: ship.pos.z, sepDist: separationDistance, tick: this.state.tick, res: result });
        }
        return result;
      }
    }

    // As a last resort, return a small random vector to perturb the ship
    const rndAngle = this.state.rng.next() * Math.PI * 2;
    const result = { force: { x: Math.cos(rndAngle), y: Math.sin(rndAngle), z: 0 }, neighborCount };
    if (this.state.spatialGrid && this.state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      this.sepCache.set(ship.id, { x: ship.pos.x, y: ship.pos.y, z: ship.pos.z, sepDist: separationDistance, tick: this.state.tick, res: result });
    }
    return result;
  }

  /**
   * Helper method for linear search in separation force calculation (fallback)
   */
  private getNearbySeparationShipsLinear(ship: Ship, separationDistance: number): Ship[] {
    const nearby: Ship[] = [];
    for (const other of this.state.ships) {
      if (other.team !== ship.team || other.health <= 0 || other.id === ship.id) continue;
      const dist = this.getDistance(ship.pos, other.pos);
      if (dist > 0 && dist < separationDistance) {
        nearby.push(other);
      }
    }
    return nearby;
  }

  /**
   * Find best formation opportunity for a ship
   */
  private findBestFormation(ship: Ship): { name: string; config: FormationConfig } | null {
    const config = this.state.behaviorConfig!;
    const searchRadius = config.globalSettings.formationSearchRadius;

    // Look for carriers to escort
    if (ship.class !== 'carrier') {
      for (const s of this.state.ships) {
        if (s.team === ship.team && s.class === 'carrier' && s.health > 0) {
          const dist = this.getDistance(ship.pos, s.pos);
          if (dist <= searchRadius) {
            const formation = getFormationConfig(config, 'escort');
            if (formation) {
              return { name: 'escort', config: formation };
            }
          }
        }
      }
    }

    // Look for large groups to form up with
    const nearbyFriends = this.findNearbyFriends(ship, searchRadius);
    if (nearbyFriends.length >= 3) {
      const formation = getFormationConfig(config, 'circle');
      if (formation) {
        return { name: 'circle', config: formation };
      }
    }

    return null;
  }

  /**
   * Calculate preferred engagement range for a ship
   */
  private calculatePreferredRange(ship: Ship, personality: AIPersonality): number {
    const shipConfig = getShipClassConfig(ship.class);
    const baseRange = shipConfig.turrets.reduce((max: number, turret) => Math.max(max, turret.range), 0);
    return baseRange * personality.preferredRangeMultiplier;
  }

  /**
   * Assign a roaming anchor for a ship, ensuring proper separation from other anchors
   */
  private assignRoamingAnchor(ship: Ship): Vector3 {
    const config = this.state.behaviorConfig!;
    const minSeparation = config.globalSettings.roamingAnchorMinSeparation;
    const teamAnchors = this.roamingAnchors.get(ship.team)!;
    const bounds = this.state.simConfig.simBounds;
    
    // Try to find a good anchor position with rejection sampling
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate: Vector3 = {
        x: this.state.rng.next() * bounds.width,
        y: this.state.rng.next() * bounds.height,
        z: this.state.rng.next() * bounds.depth
      };
      
      // Check if this candidate is far enough from existing anchors
      let validCandidate = true;
      for (const existing of teamAnchors) {
        if (this.getDistance(candidate, existing) < minSeparation) {
          validCandidate = false;
          break;
        }
      }
      
      if (validCandidate) {
        teamAnchors.push(candidate);
        return candidate;
      }
    }
    
    // If we couldn't find a good position, fall back to ship's current position
    // This ensures the system is robust even in crowded scenarios
    const fallback = { ...ship.pos };
    teamAnchors.push(fallback);
    return fallback;
  }

  /**
   * Release a roaming anchor when a ship stops roaming
   */
  private releaseRoamingAnchor(ship: Ship): void {
    if (!ship.aiState?.roamingAnchor) return;
    
    const teamAnchors = this.roamingAnchors.get(ship.team)!;
    const index = teamAnchors.findIndex(anchor => 
      this.getDistance(anchor, ship.aiState!.roamingAnchor!) < 1.0
    );
    
    if (index >= 0) {
      teamAnchors.splice(index, 1);
    }
    
    ship.aiState.roamingAnchor = undefined;
  }

  /**
   * Clear formation slot assignment when a ship leaves formation
   */
  private clearFormationSlot(ship: Ship): void {
    if (ship.aiState) {
      ship.aiState.formationId = undefined;
      ship.aiState.formationSlotIndex = undefined;
      ship.aiState.formationPosition = undefined;
    }
  }

  /**
   * Get formation center position based on formation type and existing members
   */
  private getFormationCenter(ship: Ship, formationName: string): Vector3 | null {
    if (formationName === 'escort') {
      // For escort formations, center around the carrier
      const carrier = this.state.ships.find(s => 
        s.team === ship.team && 
        s.class === 'carrier' && 
        s.health > 0
      );
      return carrier ? carrier.pos : null;
    }
    
    // For other formations, find the center of existing formation members
    const formationShips = this.state.ships.filter(s => 
      s.team === ship.team && 
      s.health > 0 && 
      s.aiState?.formationId === formationName
    );
    
    if (formationShips.length > 0) {
      // Use center of existing formation
      const center = { x: 0, y: 0, z: 0 };
      for (const s of formationShips) {
        center.x += s.pos.x;
        center.y += s.pos.y;
        center.z += s.pos.z;
      }
      center.x /= formationShips.length;
      center.y /= formationShips.length;
      center.z /= formationShips.length;
      return center;
    }
    
    // For new formations, use the current ship's position as initial center
    return ship.pos;
  }

  /**
   * Calculate formation slot positions based on formation config and center point
   */
  private calculateFormationSlots(config: FormationConfig, center: Vector3): Vector3[] {
    const slots: Vector3[] = [];
    const spacing = config.spacing;
    
    switch (config.type) {
      case 'line':
        for (let i = 0; i < config.maxSize; i++) {
          const offset = (i - (config.maxSize - 1) / 2) * spacing;
          slots.push({
            x: center.x + offset,
            y: center.y,
            z: center.z
          });
        }
        break;
        
      case 'circle':
        for (let i = 0; i < config.maxSize; i++) {
          const angle = (i / config.maxSize) * Math.PI * 2;
          slots.push({
            x: center.x + Math.cos(angle) * spacing,
            y: center.y + Math.sin(angle) * spacing,
            z: center.z
          });
        }
        break;
        
      case 'wedge':
        for (let i = 0; i < config.maxSize; i++) {
          const row = Math.floor(Math.sqrt(i));
          const col = i - row * row;
          const rowOffset = row * spacing;
          const colOffset = (col - row / 2) * spacing;
          slots.push({
            x: center.x + colOffset,
            y: center.y - rowOffset,
            z: center.z
          });
        }
        break;
        
      case 'column':
        for (let i = 0; i < config.maxSize; i++) {
          slots.push({
            x: center.x,
            y: center.y - i * spacing,
            z: center.z
          });
        }
        break;
        
      case 'sphere':
        // Simple sphere arrangement - distribute ships in layers
        for (let i = 0; i < config.maxSize; i++) {
          const layer = Math.floor(i / 4);
          const layerIndex = i % 4;
          const angle = (layerIndex / 4) * Math.PI * 2;
          const radius = spacing * (layer + 1);
          slots.push({
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius,
            z: center.z + (layer - 1) * spacing * 0.5
          });
        }
        break;
    }
    
    return slots;
  }

  /**
   * Assign formation slot to a ship joining a formation
   */
  private assignFormationSlot(ship: Ship, formationName: string, formationConfig: FormationConfig, center: Vector3): void {
    // Calculate all slot positions
    const slots = this.calculateFormationSlots(formationConfig, center);
    
    // Find ships already in this formation
    const formationShips = this.state.ships.filter(s => 
      s.team === ship.team && 
      s.health > 0 && 
      s.aiState?.formationId === formationName &&
      s.aiState?.formationSlotIndex !== undefined
    );
    
    // Find used slot indices
    const usedSlots = new Set(formationShips.map(s => s.aiState!.formationSlotIndex!));
    
    // Find nearest available slot
    let bestSlotIndex = -1;
    let bestDistance = Infinity;
    
    for (let i = 0; i < slots.length; i++) {
      if (!usedSlots.has(i)) {
        const distance = this.getDistance(ship.pos, slots[i]);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestSlotIndex = i;
        }
      }
    }
    
    // Assign the slot
    if (bestSlotIndex >= 0) {
      ship.aiState!.formationSlotIndex = bestSlotIndex;
      ship.aiState!.formationPosition = slots[bestSlotIndex];
    }
  }

  /**
   * Get distance between two positions
   */
  private getDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}