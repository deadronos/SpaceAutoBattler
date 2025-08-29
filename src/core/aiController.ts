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
import { lookAt, getForwardVector, angleDifference, clampTurn, magnitude, normalize, subtract } from '../utils/vector3.js';

/**
 * AI Controller - Configurable AI behaviors for ships
 */

export class AIController {
  private state: GameState;
  
  // Per-team anchor registries for roaming behavior
  private roamingAnchors: Map<Team, Vector3[]>;

  constructor(state: GameState) {
    this.state = state;
    this.roamingAnchors = new Map();
    this.roamingAnchors.set('red', []);
    this.roamingAnchors.set('blue', []);
  }

  /**
   * Update AI for all ships
   */
  updateAllShips(dt: number) {
    if (!this.state.behaviorConfig?.globalSettings.aiEnabled) {
      return;
    }

    for (const ship of this.state.ships) {
      if (ship.health <= 0) continue;
      this.updateShipAI(ship, dt);
    }
  }

  /**
   * Update AI for a single ship
   */
  private updateShipAI(ship: Ship, dt: number) {
    const config = this.state.behaviorConfig!;
    const personality = getEffectivePersonality(config, ship.class, ship.team);

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

    // Force intent reevaluation if ship has taken significant damage
    const recentDamage = aiState.recentDamage || 0;
    const shouldForceReevaluation = recentDamage >= this.state.behaviorConfig!.globalSettings.damageEvadeThreshold;

    // Reevaluate intent if needed (either by time or by damage)
    if (shouldForceReevaluation || this.state.time - aiState.lastIntentReevaluation >= personality.intentReevaluationRate) {
      this.reevaluateIntent(ship, personality);
      aiState.lastIntentReevaluation = this.state.time;
    }

    // Execute current intent
    this.executeIntent(ship, aiState.currentIntent, dt);

    // Update turret AI
    this.updateTurretAI(ship, dt);
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
   * Reevaluate what the ship should be doing
   */
  private reevaluateIntent(ship: Ship, personality: AIPersonality) {
    const aiState = ship.aiState!;
    const config = this.state.behaviorConfig!;

    // Check if ship has taken significant recent damage and should evade
    const recentDamage = aiState.recentDamage || 0;
    const shouldEvadeFromDamage = recentDamage >= config.globalSettings.damageEvadeThreshold;

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

    // Release roaming anchor if we're no longer in roaming mode or patrol intent
    if (personality.mode !== 'roaming' || (newIntent !== 'patrol' && oldIntent === 'patrol')) {
      this.releaseRoamingAnchor(ship);
    }
    
    // Clear formation slot if we're no longer in formation mode
    if (personality.mode !== 'formation') {
      this.clearFormationSlot(ship);
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
    const nearestEnemy = this.findNearestEnemy(ship);
    if (nearestEnemy) {
      const distance = this.getDistance(ship.pos, nearestEnemy.pos);
      const preferredRange = ship.aiState!.preferredRange!;
      
      // Within optimal combat range - maintain pursuit for effective engagement
      if (distance < preferredRange * 0.6) {
        return 'pursue';
      }
      // At medium range - continue pursuing to close distance
      else if (distance < preferredRange * 1.2) {
        return 'pursue';
      }
      // At longer range - use tactical movement
      else {
        return this.state.rng.next() < 0.6 ? 'pursue' : 'strafe';
      }
    }
    return 'patrol';
  }

  /**
   * Choose intent for defensive behavior
   */
  private chooseDefensiveIntent(ship: Ship, personality: AIPersonality): AIIntent {
    const config = this.state.behaviorConfig!;
    const threats = this.findNearbyEnemies(ship, ship.aiState!.preferredRange! * 2);
    if (threats.length > 0) {
      const nearestThreat = threats[0];
      const distance = this.getDistance(ship.pos, nearestThreat.pos);
      if (distance < ship.aiState!.preferredRange! * 0.5) {
        // Only evade if config allows it OR ship has recently taken damage
        if (!config.globalSettings.evadeOnlyOnDamage) {
          // Backwards compatibility: allow proximity-based evade
          return 'evade';
        } else {
          // New behavior: only evade if recently damaged
          const recentDamage = ship.aiState!.recentDamage || 0;
          if (recentDamage >= config.globalSettings.damageEvadeThreshold) {
            return 'evade';
          }
          // Otherwise, choose more aggressive behavior
          return this.state.rng.next() < 0.7 ? 'group' : 'patrol';
        }
      }
    }
    return this.state.rng.next() < personality.groupCohesion ? 'group' : 'patrol';
  }

  /**
   * Choose intent for roaming behavior
   */
  private chooseRoamingIntent(ship: Ship, personality: AIPersonality): AIIntent {
    const aiState = ship.aiState!;

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
      const randomPitch = (this.state.rng.next() - 0.5) * Math.PI * 0.5; // ±45 degrees pitch
      
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
    let score = 100; // Base score

    // Penalty for proximity to threats
    for (const threat of threats) {
      const distance = this.getDistance(targetPos, threat.pos);
      const threatPenalty = Math.max(0, 200 - distance) * 0.5;
      score -= threatPenalty;
    }

    // Penalty for being near boundaries
    const boundaryMargin = 50;
    if (targetPos.x < boundaryMargin) score -= (boundaryMargin - targetPos.x) * 2;
    if (targetPos.x > bounds.width - boundaryMargin) score -= (targetPos.x - (bounds.width - boundaryMargin)) * 2;
    if (targetPos.y < boundaryMargin) score -= (boundaryMargin - targetPos.y) * 2;
    if (targetPos.y > bounds.height - boundaryMargin) score -= (targetPos.y - (bounds.height - boundaryMargin)) * 2;
    if (targetPos.z < boundaryMargin) score -= (boundaryMargin - targetPos.z) * 2;
    if (targetPos.z > bounds.depth - boundaryMargin) score -= (targetPos.z - (bounds.depth - boundaryMargin)) * 2;

    // Bonus for increasing distance from nearest threat
    const currentDistance = this.getDistance(ship.pos, threats[0].pos);
    const newDistance = this.getDistance(targetPos, threats[0].pos);
    if (newDistance > currentDistance) {
      score += (newDistance - currentDistance) * 0.3;
    }

    // Penalty for getting too close to friendly ships
    for (const friendly of this.state.ships) {
      if (friendly.team === ship.team && friendly.id !== ship.id && friendly.health > 0) {
        const distance = this.getDistance(targetPos, friendly.pos);
        if (distance < 80) {
          score -= (80 - distance) * 0.2;
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
   * Move ship towards a target position using 3D steering
   */
  private moveTowards(ship: Ship, targetPos: Vector3, dt: number, speed?: number) {
    const moveSpeed = speed || ship.speed;

    // Calculate desired direction
    const dx = targetPos.x - ship.pos.x;
    const dy = targetPos.y - ship.pos.y;
    const dz = targetPos.z - ship.pos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < 10) return; // Close enough

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
    const accel = moveSpeed * 0.5;
    
    ship.vel.x += forward.x * accel * dt;
    ship.vel.y += forward.y * accel * dt;
    ship.vel.z += forward.z * accel * dt;

    // Damp and clamp speed
    ship.vel.x *= 0.98;
    ship.vel.y *= 0.98;
    ship.vel.z *= 0.98;

    const maxV = moveSpeed;
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

    if (distance < 10) return; // Close enough

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
    const accel = moveSpeed * 0.5;
    
    ship.vel.x += forward.x * accel * dt;
    ship.vel.y += forward.y * accel * dt;
    ship.vel.z += forward.z * accel * dt;

    // Damp and clamp speed
    ship.vel.x *= 0.98;
    ship.vel.y *= 0.98;
    ship.vel.z *= 0.98;

    const maxV = moveSpeed;
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
    }
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
    const config = this.state.behaviorConfig!;
    const separationDistance = config.globalSettings.separationDistance;
    
    let separationX = 0;
    let separationY = 0;
    let separationZ = 0;
    let neighborCount = 0;

    // Find nearby friends within separation distance
    for (const other of this.state.ships) {
      if (other.team !== ship.team || other.health <= 0 || other.id === ship.id) continue;

      const dist = this.getDistance(ship.pos, other.pos);
      if (dist > 0 && dist < separationDistance) {
        // Calculate repulsion vector (away from other ship)
        const dx = ship.pos.x - other.pos.x;
        const dy = ship.pos.y - other.pos.y;
        const dz = ship.pos.z - other.pos.z;
        
        // Weight by inverse distance (closer ships have stronger repulsion)
        const weight = (separationDistance - dist) / separationDistance;
        const normalizedDist = dist > 0 ? 1 / dist : 1;
        
        separationX += dx * weight * normalizedDist;
        separationY += dy * weight * normalizedDist;
        separationZ += dz * weight * normalizedDist;
        neighborCount++;
      }
    }

    if (neighborCount === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    // Average and normalize the separation force
    separationX /= neighborCount;
    separationY /= neighborCount;
    separationZ /= neighborCount;

    const magnitude = Math.sqrt(separationX * separationX + separationY * separationY + separationZ * separationZ);
    if (magnitude > 0) {
      return {
        x: separationX / magnitude,
        y: separationY / magnitude,
        z: separationZ / magnitude
      };
    }

    return { x: 0, y: 0, z: 0 };
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