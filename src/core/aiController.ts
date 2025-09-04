import type { GameState, Ship, Vector3, EntityId, TurretState, Team } from '../types/index.js';
import type { AIIntent, AIPersonality, FormationConfig } from '../config/behaviorConfig.js';
import { getEffectivePersonality, selectRoamingPattern, getFormationConfig } from '../config/behaviorConfig.js';
import { PhysicsConfig } from '../config/physicsConfig.js';import { lookAt, getForwardVector, angleDifference, clampTurn } from '../utils/vector3.js';
import { calculateEscapeScore as steeringCalculateEscapeScore, moveTowards as steeringMoveTowards, calculateSeparationForceWithCount as steeringSeparation } from './ai/steering.js';
import { scoreEvade as deScoreEvade } from './ai/decisionEngine.js';
import { IntentManager } from './ai/intentManager.js';
import { pickBestTurretTarget } from './ai/turretTargeting.js';
import { getShipClassConfig } from '../config/entitiesConfig.js';
import { computeInterceptPoint } from './math/ballisticIntercept.js';
import { getDistance as sharedGetDistance, findNearestEnemy as sharedFindNearestEnemy, findNearbyEnemies as sharedFindNearbyEnemies, findNearbyFriends as sharedFindNearbyFriends, getNearbySeparationShipsLinear as sharedGetNearbySeparationShipsLinear } from './searchUtils.js';
import { applyBoundaryPhysicsShip } from './boundaryUtils.js';

/**
 * AI Controller - Configurable AI behaviors for ships
 */

export class AIController {
  private state: GameState;
  // Cache for separation force results per ship within the same tick to avoid
  // recomputing identical queries (helps synthetic benchmarks and repeated calls)
  private sepCache: Map<number, { x: number; y: number; z: number; sepDist: number; tick: number; res: { force: Vector3; neighborCount: number } } > = new Map();
  
  // Per-team anchor registries for roaming behavior
  // We track assigned anchors with the owning ship id so we can remove them reliably
  private roamingAnchors: Map<Team, { pos: Vector3; shipId: number }[]>;
  
  // Team alarm system - tracks when teams are under attack
  private teamAlarmTimes: Map<Team, number>;
  
  // Scout assignment - tracks which ship is the current scout per team
  private teamScouts: Map<Team, EntityId | null>;
  private isSpatialGridUpdatedThisTick: boolean;
  private intentManager: IntentManager;

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
    this.isSpatialGridUpdatedThisTick = false;
    this.intentManager = new IntentManager();
  }

  /**
   * Compute intercept point for a constant-speed projectile.
   * Returns a Vector3 world position where the shooter should aim such that
   * a projectile launched at speed `projectileSpeed` from shooterPos will
   * meet the target moving at targetVel from targetPos. If no valid intercept
   * exists (target too fast or geometry), returns null.
   */
  // computeInterceptPoint is provided by src/core/math/ballisticIntercept.ts and imported above

  /**
   * Update AI for all ships
   */
  public updateAllShips(dt: number) {
    if (!this.state.behaviorConfig?.globalSettings.aiEnabled) {
      return;
    }

    this.isSpatialGridUpdatedThisTick = false;

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

      // Only consider this an alarm if the ship actually recorded recent damage
      // (guards against default lastDamageTime === 0 being treated as a damage event)
      if ((aiState.recentDamage && aiState.recentDamage > 0) && timeSinceLastDamage <= config.globalSettings.alarmSystemWindowSeconds) {
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

      const currentScout = this.teamScouts.get(team);
      const scoutShip = currentScout ? teamShips.find(s => s.id === currentScout) : null;

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
    const _intentDuration = personality.minIntentDuration;

    if (shouldEvadeFromDamage) {
      newIntent = 'evade';
      // Shorter duration for damage-based evade to allow quick reassessment
      // Use _intentDuration as the baseline variable
      const intentDuration = Math.min(_intentDuration, config.globalSettings.intentDurationDamageEvade);
      void intentDuration;
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

      // Optional decision engine gate (evade only): if enabled and DE suggests evade,
      // allow it to override non-evade intents. This is behind a feature flag to avoid
      // behavior changes by default.
      if (config.globalSettings.useDecisionEngineEvadeGate) {
        const de = this.previewDecisionEngineEvade(ship);
        if (de.wouldEvade && newIntent !== 'evade') {
          newIntent = 'evade';
          // Use standard (non-damage) intent duration for DE-driven evade
          // (do not shorten here to preserve overall pacing)
        }
      }
    }

    // Debugging: previously logged cases where an evade intent was chosen.
    // Removed noisy console.debug('[AI] Evade chosen', ...) per request.

    // Release roaming anchor if patrol intent changes
    if (newIntent !== 'patrol' && oldIntent === 'patrol') {
      this.releaseRoamingAnchor(ship);
    }

    // Set intent duration via IntentManager to keep parity
    const _duration = this.intentManager.applyIntent(
      ship,
      this.state.time,
      newIntent,
      personality,
      this.state.rng,
      shouldEvadeFromDamage
        ? { damageEvade: true, damageEvadeDuration: config.globalSettings.intentDurationDamageEvade }
        : undefined
    );
  }

  /**
   * Public helper: Preview whether the Decision Engine would choose to Evade
   * based on current threat proximity and recent damage window.
   * Returns the raw score and a boolean for convenience.
   */
  public previewDecisionEngineEvade(ship: Ship): { score: number; wouldEvade: boolean } {
    const config = this.state.behaviorConfig!;
    // Nearest enemy distance (null if none)
    const nearest = this.findNearestEnemy(ship);
    const distanceToThreat = nearest ? this.getDistance(ship.pos, nearest.pos) : null;
    const recentDamage = ship.aiState?.recentDamage || 0;
    const lastDamageTime = ship.aiState?.lastDamageTime || 0;
    const withinRecentDamageWindow = (this.state.time - lastDamageTime) <= config.globalSettings.evadeRecentDamageWindowSeconds;
    const score = deScoreEvade({
      distanceToThreat,
      recentDamage,
      damageEvadeThreshold: config.globalSettings.damageEvadeThreshold,
      withinRecentDamageWindow,
      settings: config.globalSettings
    });
    // Using a simple threshold: any positive signal indicates DE would prefer evade.
    // Current scoring gives +1 for proximity and +1 for recent-damage-within-window.
    const wouldEvade = score >= 1.0 || (score > 0.0 && distanceToThreat === null);
    return { score, wouldEvade };
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
      aiState.roamingPattern = selectRoamingPattern(this.state.behaviorConfig!, this.state.rng);
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
    const settings = this.state.behaviorConfig!.globalSettings;
    const threatsPos = threats.map(t => t.pos);
    const friendsPos = this.state.ships.filter(s => s.team === ship.team && s.id !== ship.id && s.health > 0).map(s => s.pos);
    return steeringCalculateEscapeScore(ship.pos, targetPos, threatsPos, friendsPos, bounds, settings);
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
    const config = this.state.behaviorConfig!;
    const angle = Math.atan2(ship.pos.y - target.pos.y, ship.pos.x - target.pos.x) + dt;
    const radius = config.globalSettings.strafeRadius;
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

      case 'circular': {
        const time = this.state.time - (aiState.roamingStartTime || 0);
        const angle = (time / pattern.duration) * Math.PI * 2;
        targetPos = {
          x: center.x + Math.cos(angle) * pattern.radius,
          y: center.y + Math.sin(angle) * pattern.radius,
          z: center.z
        };
        break;
      }

      case 'figure_eight': {
        const t = this.state.time - (aiState.roamingStartTime || 0);
        const figureAngle = (t / pattern.duration) * Math.PI * 2;
        targetPos = {
          x: center.x + Math.sin(figureAngle) * pattern.radius,
          y: center.y + Math.sin(figureAngle * 2) * pattern.radius * 0.5,
          z: center.z
        };
        break;
      }

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
    const config = this.state.behaviorConfig!;
    const bounds = this.state.simConfig.simBounds;
    const offset = config.globalSettings.boundarySafetyMargin;
    let safePos: Vector3;
    if (ship.team === 'red') {
      safePos = { x: offset, y: bounds.height / 2, z: bounds.depth / 2 };
    } else {
      safePos = { x: bounds.width - offset, y: bounds.height / 2, z: bounds.depth / 2 };
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

  const _aiState = ship.aiState!;
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
    const settings = this.state.behaviorConfig!.globalSettings;
    steeringMoveTowards(ship, targetPos, dt, settings, speed);
    // Apply boundary physics to preserve behavior parity
    applyBoundaryPhysicsShip(ship, this.state);
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
    const distance = this.getDistance(ship.pos, targetPos);

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
    const projectionDistance = this.state.behaviorConfig?.globalSettings.orientationProjectionDistance ?? 100;
    const targetLookPos = {
      x: ship.pos.x + finalDirX * projectionDistance, // Project forward to get orientation
      y: ship.pos.y + finalDirY * projectionDistance,
      z: ship.pos.z + finalDirZ * projectionDistance
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
  applyBoundaryPhysicsShip(ship, this.state);
  }

  /**
   * Update turret AI for independent targeting
   */
  private updateTurretAI(ship: Ship, _dt: number) {
    const config = this.state.behaviorConfig!;
    const turretConfig = config.turretConfig;

    // We'll support both static behavior and optional dynamic per-turret switching
      for (const turret of ship.turrets) {
        if (!turret.aiState) {
          turret.aiState = {
            targetId: null,
            lastTargetUpdate: 0
          };
        }

        const turretState = turret.aiState;

        // Initialize per-turret behavior if not set
        if (!turretState.behavior) {
          // Default behavior initialization comes from designer-preferred turret config
          // If the designer set 'dynamic', fall back to global turret config behavior
          const shipCfg = getShipClassConfig(ship.class);
          const tIndex = ship.turrets.indexOf(turret);
          const tCfg = shipCfg.turrets[tIndex % shipCfg.turrets.length];
          const pref = (tCfg as any).preferredBehavior;
          if (pref && pref !== 'dynamic') {
            turretState.behavior = pref;
            // Designer override: persist indefinitely (no auto-switch unless explicitly 'dynamic')
            turretState.behaviorExpireTime = Infinity;
          } else {
            turretState.behavior = turretConfig.behavior;
            // small default expiry so first switch happens after some time if dynamic
            turretState.behaviorExpireTime = this.state.time + (turretConfig.dynamicSwitch?.minDuration ?? 1);
          }
        }

        // Dynamic switching: pick new behavior when expired
        const dyn = turretConfig.dynamicSwitch;
        if (dyn?.enabled) {
          if (!turretState.behaviorExpireTime || this.state.time >= turretState.behaviorExpireTime) {
            // Weighted random pick from options (fallback to global behavior list)
            const opts = dyn.options && dyn.options.length ? dyn.options : [ { behavior: turretConfig.behavior, weight: 1 } ];
            const total = opts.reduce((s, o) => s + (o.weight || 0), 0);
            const r = (this.state.rng.next() * total);
            let acc = 0;
            let chosen = opts[0].behavior;
            for (const o of opts) {
              acc += o.weight || 0;
              if (r <= acc) { chosen = o.behavior; break; }
            }
            turretState.behavior = chosen;
            // Pick duration between min and max
            const minD = dyn.minDuration;
            const maxD = dyn.maxDuration;
            const dur = minD + this.state.rng.next() * Math.max(0, (maxD - minD));
            turretState.behaviorExpireTime = this.state.time + dur;
          }
        }

        // Reevaluate target if needed
        if (this.state.time - turretState.lastTargetUpdate >= turretConfig.targetReevaluationRate) {
          turretState.targetId = this.findBestTurretTarget(ship, turret);
          turretState.lastTargetUpdate = this.state.time;
        }

        // If current per-turret behavior requests lead prediction, compute an intercept
        if (turretState.behavior === 'lead_target') {
          // Determine which target to lead: prefer turret-specific target, fall back to ship.targetId
          const tid = turretState.targetId ?? ship.targetId;
          if (typeof tid === 'number') {
            const targetShip = this.state.shipIndex?.get(tid) ?? this.state.ships.find(s => s.id === tid);
            if (targetShip) {
              // Compute turret's bullet speed from ship class config
              const shipCfg = getShipClassConfig(ship.class);
              const turretIndex = ship.turrets.indexOf(turret);
              const tCfg = shipCfg.turrets[turretIndex % shipCfg.turrets.length];
              const bulletSpeed = tCfg.bulletSpeed;

              // Solve intercept point using closed-form solution for constant-speed projectile
              // Determine lookahead limit: per-turret override preferred, otherwise global setting
              // Prefer per-turret override if present, otherwise use global setting
              const perTurretLookahead = (tCfg as import('../types/index.js').TurretConfig | undefined)?.maxInterceptLookahead;
              const lookahead = perTurretLookahead ?? this.state.behaviorConfig!.globalSettings.maxInterceptLookahead;
              const intercept = computeInterceptPoint(
                ship.pos,
                bulletSpeed,
                targetShip.pos,
                targetShip.vel,
                lookahead
              );

              if (intercept) {
                turretState.leadTargetPos = intercept;
              } else {
                // Fallback to a short linear predict using configured leadPredictionTime
                const leadTime = turretConfig.leadPredictionTime ?? 0.5;
                turretState.leadTargetPos = {
                  x: targetShip.pos.x + (targetShip.vel?.x ?? 0) * leadTime,
                  y: targetShip.pos.y + (targetShip.vel?.y ?? 0) * leadTime,
                  z: targetShip.pos.z + (targetShip.vel?.z ?? 0) * leadTime
                };
              }
            }
          } else {
            // Clear any stale lead position if no target
            delete turretState.leadTargetPos;
          }
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

  /**
   * Update shield regeneration for a ship
   */
  private updateShieldRegeneration(ship: Ship, dt: number) {
    // Simple shield regeneration - clamp to prevent overflow
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const newShield = clamp(ship.shield + ship.shieldRegen * dt, 0, ship.maxShield);
    
    // Mark as dirty only if shield value actually changed
    if (newShield !== ship.shield) {
      ship.shield = newShield;
      ship._shieldDirty = true;
    }
  }

  /**
   * Find best target for a turret
   */
  private findBestTurretTarget(ship: Ship, turret: TurretState): EntityId | null {
    const config = this.state.behaviorConfig!;
    const turretConfig = config.turretConfig;

    // Feature gate: use extracted helper if enabled
    if (config.globalSettings.useTurretTargetingHelper) {
      const id = pickBestTurretTarget(this.state, ship, turret, turretConfig);
      return id ?? null;
    }

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
    return sharedFindNearestEnemy(this.state, ship);
  }

  /**
   * Find nearest enemy using spatial index
   */
  

  /**
   * Find nearest enemy using linear search (fallback)
   */
  

  /**
   * Find nearby enemies within range
   */
  private findNearbyEnemies(ship: Ship, range: number): Ship[] {
    return sharedFindNearbyEnemies(this.state, ship, range);
  }

  /**
   * Find nearby enemies using spatial index
   */
  

  /**
   * Find nearby enemies using linear search (fallback)
   */
  

  /**
   * Find nearby friendly ships
   */
  private findNearbyFriends(ship: Ship, range: number): Ship[] {
    return sharedFindNearbyFriends(this.state, ship, range);
  }

  /**
   * Find nearby friendly ships using spatial index
   */
  

  /**
   * Ensures the spatial grid is updated, but only once per tick.
   */
  private ensureSpatialGridUpdated() {
    if (!this.isSpatialGridUpdatedThisTick) {
      this.updateSpatialGridImmediate();
      this.isSpatialGridUpdatedThisTick = true;
    }
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
    // Caching fast-path with spatial index: compute neighbor vectors via spatial index if enabled,
    // else via linear fallback, then call steeringSeparation to compute the force.
    const magnitudeThreshold = this.state.behaviorConfig!.globalSettings.separationVectorMagnitudeThreshold || 0.0001;
    const cached = this.sepCache.get(ship.id);
    if (this.state.spatialGrid && this.state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      if (cached && cached.tick === this.state.tick && cached.sepDist === separationDistance && cached.x === ship.pos.x && cached.y === ship.pos.y && cached.z === ship.pos.z) {
        return cached.res;
      }
      this.ensureSpatialGridUpdated();
      const neighbors: Vector3[] = [];
      this.state.spatialGrid.forEachNeighborsDelta(
        ship.pos,
        separationDistance,
        ship.team,
        ship.id,
        (dxp, dyp, dzp, distSq, entity) => {
          if (distSq > 0 && distSq < separationDistance * separationDistance) {
            neighbors.push(entity.pos);
          }
        }
      );
      const res = steeringSeparation(ship.pos, neighbors, separationDistance, magnitudeThreshold, () => this.state.rng.next());
      this.sepCache.set(ship.id, { x: ship.pos.x, y: ship.pos.y, z: ship.pos.z, sepDist: separationDistance, tick: this.state.tick, res });
      return res;
    }
    // Linear fallback
    const nearby = this.getNearbySeparationShipsLinear(ship, separationDistance);
    const neighborPositions = nearby.map(o => o.pos);
    const res = steeringSeparation(ship.pos, neighborPositions, separationDistance, magnitudeThreshold, () => this.state.rng.next());
    return res;
  }

  /**
   * Helper method for linear search in separation force calculation (fallback)
   */
  private getNearbySeparationShipsLinear(ship: Ship, separationDistance: number): Ship[] {
    return sharedGetNearbySeparationShipsLinear(this.state, ship, separationDistance);
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
    
    // If no carrier escort found, allow forming up with nearby friendly ships
    const nearbyFriends = this.findNearbyFriends(ship, searchRadius);
    if (nearbyFriends.length >= config.globalSettings.formationMinGroupSize) {
      const formation = getFormationConfig(config, 'line') || Object.values(config.formations)[0];
      if (formation) return { name: 'line', config: formation };
    }
    // TODO: Add more formation logic as needed
    return null;
  }

  /**
   * Calculate Euclidean distance between two Vector3 positions
   */
  private getDistance(a: Vector3, b: Vector3): number {
    return sharedGetDistance(a, b);
  }

  /**
   * Release roaming anchor for a ship (removes anchor assignment)
   */
  private releaseRoamingAnchor(ship: Ship): void {
    if (ship.aiState && ship.aiState.roamingAnchor) {
      // Remove from registry based on ship id
      const anchors = this.roamingAnchors.get(ship.team);
      if (anchors) {
        const idx = anchors.findIndex(a => a.shipId === ship.id);
        if (idx !== -1) anchors.splice(idx, 1);
      }
      ship.aiState.roamingAnchor = undefined;
    }
  }

  /**
   * Clear formation slot for a ship (removes formation assignment)
   */
  private clearFormationSlot(ship: Ship): void {
    if (ship.aiState) {
      ship.aiState.formationId = undefined;
      ship.aiState.formationPosition = undefined;
      ship.aiState.formationSlotIndex = undefined;
    }
  }

  /**
   * Calculate preferred range for a ship based on personality and config
   */
  private calculatePreferredRange(ship: Ship, personality: AIPersonality): number {
  // Use config separationDistance as base range and personality multiplier
  const baseRange = this.state.behaviorConfig!.globalSettings.separationDistance;
  const range = baseRange * (personality.preferredRangeMultiplier ?? 1);
  return range;
  }

  /**
   * Assign a roaming anchor for a ship (returns anchor position)
   */
  private assignRoamingAnchor(ship: Ship): Vector3 {
    // Use config for roaming anchor maxAttempts and a default anchor radius
    const config = this.state.behaviorConfig!;
  const maxAttempts = config.globalSettings.roamingAnchorMaxAttempts;
  const minSeparation = config.globalSettings.roamingAnchorMinSeparation;
  // Use roaming pattern radius if available, else fallback to evadeDistance and ensure it's >= minSeparation
  const anchorRadius = Math.max(
    config.roamingPatterns?.[0]?.radius ?? config.globalSettings.evadeDistance,
    minSeparation
  );
  const bounds = this.state.simConfig.simBounds;
  let attempt = 0;
  const teamAnchors = this.roamingAnchors.get(ship.team) || [];

    while (attempt < maxAttempts) {
      const angle = this.state.rng.next() * Math.PI * 2;
      let radius = this.state.rng.next() * anchorRadius;
      let anchor = {
        x: ship.pos.x + Math.cos(angle) * radius,
        y: ship.pos.y + Math.sin(angle) * radius,
        z: ship.pos.z
      };
      // Ensure anchor is within bounds
      if (
        anchor.x > 0 && anchor.x < bounds.width &&
        anchor.y > 0 && anchor.y < bounds.height &&
        anchor.z > 0 && anchor.z < bounds.depth
      ) {
        // Ensure this anchor is not too close to existing anchors for the team
        let ok = true;
        for (const a of teamAnchors) {
          const dx = a.pos.x - anchor.x;
          const dy = a.pos.y - anchor.y;
          const dz = a.pos.z - anchor.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < minSeparation) { ok = false; break; }
        }
        if (!ok) {
          // Try to nudge the anchor outward along the radial direction from ship
          // so it satisfies minSeparation if possible within bounds.
          const dx = anchor.x - ship.pos.x;
          const dy = anchor.y - ship.pos.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const dirx = len > 1e-6 ? dx / len : Math.cos(angle);
          const diry = len > 1e-6 ? dy / len : Math.sin(angle);
          // find min distance to existing anchors
          let minDist = Infinity;
          for (const a of teamAnchors) {
            const ddx = a.pos.x - anchor.x;
            const ddy = a.pos.y - anchor.y;
            const dd = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dd < minDist) minDist = dd;
          }
          const needed = minSeparation - minDist + 1;
          if (needed > 0) {
            radius += needed;
            anchor = {
              x: ship.pos.x + dirx * radius,
              y: ship.pos.y + diry * radius,
              z: ship.pos.z
            };
            // clamp to bounds
            if (anchor.x > 0 && anchor.x < bounds.width && anchor.y > 0 && anchor.y < bounds.height) {
              // re-evaluate separation
              let stillTooClose = false;
              for (const a of teamAnchors) {
                const ddx = a.pos.x - anchor.x;
                const ddy = a.pos.y - anchor.y;
                const dd = Math.sqrt(ddx * ddx + ddy * ddy);
                if (dd < minSeparation) { stillTooClose = true; break; }
              }
              if (!stillTooClose) {
                const entry = { pos: anchor, shipId: ship.id };
                teamAnchors.push(entry);
                this.roamingAnchors.set(ship.team, teamAnchors);
                return anchor;
              }
            }
          }
        } else {
          // Record anchor ownership and return
          const entry = { pos: anchor, shipId: ship.id };
          teamAnchors.push(entry);
          this.roamingAnchors.set(ship.team, teamAnchors);
          return anchor;
        }
      }
      attempt++;
    }
    // Fallback: try to place an anchor relative to nearest team anchor to satisfy minSeparation
    if (teamAnchors.length > 0) {
      // find nearest existing anchor
      let nearest = teamAnchors[0];
      let nearestDist = Infinity;
      for (const a of teamAnchors) {
        const dx = a.pos.x - ship.pos.x;
        const dy = a.pos.y - ship.pos.y;
        const dz = a.pos.z - ship.pos.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < nearestDist) { nearestDist = d; nearest = a; }
      }

      // direction from nearest anchor to ship (or default unit vector)
      let dir = { x: ship.pos.x - nearest.pos.x, y: ship.pos.y - nearest.pos.y, z: ship.pos.z - nearest.pos.z };
      const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
      if (len < 1e-6) {
        dir = { x: 1, y: 0, z: 0 };
      } else {
        dir.x /= len; dir.y /= len; dir.z /= len;
      }

      const fallbackAnchor = {
        x: nearest.pos.x + dir.x * (minSeparation + 1),
        y: nearest.pos.y + dir.y * (minSeparation + 1),
        z: Math.min(Math.max(nearest.pos.z + dir.z * (minSeparation + 1), 0), bounds.depth)
      };

      // Clamp to bounds
      fallbackAnchor.x = Math.max(0, Math.min(bounds.width, fallbackAnchor.x));
      fallbackAnchor.y = Math.max(0, Math.min(bounds.height, fallbackAnchor.y));
      fallbackAnchor.z = Math.max(0, Math.min(bounds.depth, fallbackAnchor.z));

      const entry = { pos: fallbackAnchor, shipId: ship.id };
      teamAnchors.push(entry);
      this.roamingAnchors.set(ship.team, teamAnchors);
      return fallbackAnchor;
    }

    return { ...ship.pos };
  }

  /**
   * Get formation center for a ship and formation name
   */
  private getFormationCenter(ship: Ship, _formationName: string): Vector3 | null {
    // For now, use group center of friendly ships in range
    const config = this.state.behaviorConfig!;
  const searchRadius = config.globalSettings.formationSearchRadius;
    const friends = this.findNearbyFriends(ship, searchRadius);
    if (friends.length > 0) {
      return this.calculateGroupCenter(friends);
    }
    return null;
  }

  /**
   * Assign a unique slot in the formation for a ship
   */
  private assignFormationSlot(ship: Ship, formationName: string, formationConfig: FormationConfig, center: Vector3): void {
    // Assign slot based on ship id modulo maxSize, offset by spacing
  const slotCount = formationConfig.maxSize;
  const spacing = formationConfig.spacing;
    const slotIndex = ship.id % slotCount;
      // Store the assigned slot index for tests/other logic
  if (!ship.aiState) ship.aiState = { currentIntent: 'idle', intentEndTime: 0, lastIntentReevaluation: 0 } as Ship['aiState'];
    const aiState = ship.aiState!;
      aiState.formationSlotIndex = slotIndex;
    // For line formation, offset along x axis; for circle, use polar coordinates
    let slotOffset: Vector3 = { x: 0, y: 0, z: 0 };
    if (formationConfig.type === 'line') {
      slotOffset = { x: (slotIndex - Math.floor(slotCount / 2)) * spacing, y: 0, z: 0 };
    } else if (formationConfig.type === 'circle') {
      const angle = (2 * Math.PI * slotIndex) / slotCount;
      slotOffset = { x: Math.cos(angle) * spacing, y: Math.sin(angle) * spacing, z: 0 };
    } else {
      // Default: offset along x axis
      slotOffset = { x: (slotIndex - Math.floor(slotCount / 2)) * spacing, y: 0, z: 0 };
    }
    aiState.formationPosition = {
      x: center.x + slotOffset.x,
      y: center.y + slotOffset.y,
      z: center.z + slotOffset.z
    };
  }
}

