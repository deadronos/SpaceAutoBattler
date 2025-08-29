import type { GameState, Ship, Vector3, EntityId, TurretState } from '../types/index.js';
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

/**
 * AI Controller - Configurable AI behaviors for ships
 */

export class AIController {
  private state: GameState;

  constructor(state: GameState) {
    this.state = state;
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
        preferredRange: this.calculatePreferredRange(ship, personality)
      };
    }

    const aiState = ship.aiState;

    // Reevaluate intent if needed
    if (this.state.time - aiState.lastIntentReevaluation >= personality.intentReevaluationRate) {
      this.reevaluateIntent(ship, personality);
      aiState.lastIntentReevaluation = this.state.time;
    }

    // Execute current intent
    this.executeIntent(ship, aiState.currentIntent, dt);

    // Update turret AI
    this.updateTurretAI(ship, dt);
  }

  /**
   * Reevaluate what the ship should be doing
   */
  private reevaluateIntent(ship: Ship, personality: AIPersonality) {
    const aiState = ship.aiState!;
    const config = this.state.behaviorConfig!;

    // Don't change intent if we're still committed to current one
    if (this.state.time < aiState.intentEndTime) {
      return;
    }

    let newIntent: AIIntent = 'idle';
    let intentDuration = personality.minIntentDuration;

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
      if (distance < ship.aiState!.preferredRange! * 0.8) {
        return this.state.rng.next() < 0.7 ? 'strafe' : 'evade';
      } else {
        return 'pursue';
      }
    }
    return 'patrol';
  }

  /**
   * Choose intent for defensive behavior
   */
  private chooseDefensiveIntent(ship: Ship, personality: AIPersonality): AIIntent {
    const threats = this.findNearbyEnemies(ship, ship.aiState!.preferredRange! * 2);
    if (threats.length > 0) {
      const nearestThreat = threats[0];
      const distance = this.getDistance(ship.pos, nearestThreat.pos);
      if (distance < ship.aiState!.preferredRange! * 0.5) {
        return 'evade';
      }
    }
    return this.state.rng.next() < personality.groupCohesion ? 'group' : 'patrol';
  }

  /**
   * Choose intent for roaming behavior
   */
  private chooseRoamingIntent(ship: Ship, personality: AIPersonality): AIIntent {
    const aiState = ship.aiState!;

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
      ship.aiState!.formationId = formation.name;
      return 'group';
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
   * Execute evade behavior - move away from threats
   */
  private executeEvade(ship: Ship, dt: number) {
    const threats = this.findNearbyEnemies(ship, ship.aiState!.preferredRange!);
    if (threats.length === 0) return;

    // Move away from nearest threat
    const threat = threats[0];
    const awayDir = {
      x: ship.pos.x - threat.pos.x,
      y: ship.pos.y - threat.pos.y,
      z: ship.pos.z - threat.pos.z
    };
    const length = Math.sqrt(awayDir.x * awayDir.x + awayDir.y * awayDir.y + awayDir.z * awayDir.z);
    if (length > 0) {
      awayDir.x /= length;
      awayDir.y /= length;
      awayDir.z /= length;
    }

    const targetPos = {
      x: ship.pos.x + awayDir.x * 100,
      y: ship.pos.y + awayDir.y * 100,
      z: ship.pos.z + awayDir.z * 100
    };

    this.moveTowards(ship, targetPos, dt);
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

    let targetPos: Vector3;

    switch (pattern.type) {
      case 'random':
        if (!aiState.roamingStartTime || this.state.time > aiState.roamingStartTime + 5) {
          const angle = this.state.rng.next() * Math.PI * 2;
          const distance = this.state.rng.next() * pattern.radius;
          targetPos = {
            x: ship.pos.x + Math.cos(angle) * distance,
            y: ship.pos.y + Math.sin(angle) * distance,
            z: ship.pos.z + (this.state.rng.next() - 0.5) * pattern.radius * 0.5
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
          x: ship.pos.x + Math.cos(angle) * pattern.radius,
          y: ship.pos.y + Math.sin(angle) * pattern.radius,
          z: ship.pos.z
        };
        break;

      case 'figure_eight':
        const t = this.state.time - (aiState.roamingStartTime || 0);
        const figureAngle = (t / pattern.duration) * Math.PI * 2;
        targetPos = {
          x: ship.pos.x + Math.sin(figureAngle) * pattern.radius,
          y: ship.pos.y + Math.sin(figureAngle * 2) * pattern.radius * 0.5,
          z: ship.pos.z
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
   * Move ship towards a target position
   */
  private moveTowards(ship: Ship, targetPos: Vector3, dt: number, speed?: number) {
    const moveSpeed = speed || ship.speed;

    // Calculate desired direction
    const dx = targetPos.x - ship.pos.x;
    const dy = targetPos.y - ship.pos.y;
    const dz = targetPos.z - ship.pos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < 10) return; // Close enough

    // Turn towards target
    const desiredDir = Math.atan2(dy, dx);
    let diff = desiredDir - ship.dir;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const turn = Math.sign(diff) * Math.min(Math.abs(diff), ship.turnRate * dt);
    ship.dir += turn;

    // Move forward
    const ax = Math.cos(ship.dir) * moveSpeed * 0.5;
    const ay = Math.sin(ship.dir) * moveSpeed * 0.5;
    const az = (targetPos.z - ship.pos.z) * 0.1;

    ship.vel.x += ax * dt;
    ship.vel.y += ay * dt;
    ship.vel.z += az * dt;

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
   * Move ship towards a target position with separation steering to avoid clumping
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

    // Turn towards combined direction
    const desiredDir = Math.atan2(finalDirY, finalDirX);
    let diff = desiredDir - ship.dir;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const turn = Math.sign(diff) * Math.min(Math.abs(diff), ship.turnRate * dt);
    ship.dir += turn;

    // Move forward
    const ax = Math.cos(ship.dir) * moveSpeed * 0.5;
    const ay = Math.sin(ship.dir) * moveSpeed * 0.5;
    const az = finalDirZ * moveSpeed * 0.1;

    ship.vel.x += ax * dt;
    ship.vel.y += ay * dt;
    ship.vel.z += az * dt;

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
   * Get distance between two positions
   */
  private getDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}