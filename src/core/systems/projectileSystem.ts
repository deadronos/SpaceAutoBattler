import type { 
  GameState, 
  Bullet, 
  Ship, 
  EntityId, 
  Vector3, 
  Team 
} from '../../types/index.js';
import type { PhysicsAdapter } from '../adapters/physicsAdapter.js';
import type { RendererAdapter } from '../adapters/rendererAdapter.js';
import type { SpatialIndex } from '../spatialIndex.js';
import type { TimeAdapter } from '../adapters/timeAdapter.js';
import { getShipClassConfig } from '../../config/entitiesConfig.js';
import { applyBoundaryPhysicsBullet } from '../boundaryUtils.js';
import * as logger from '../../utils/logger.js';

/**
 * Fire intent describes a request to create a projectile
 */
export interface FireIntent {
  sourceShipId: EntityId;
  turretId: string;
  targetPosition: Vector3;
  leadTargetPos?: Vector3; // Predicted target position for lead shooting
}

/**
 * Hit result from projectile collision
 */
export interface HitResult {
  bulletId: EntityId;
  targetId: EntityId;
  damage: number;
  hitPosition: Vector3;
  hitNormal?: Vector3;
  penetrated: boolean; // Did it go through shields/armor?
}

/**
 * Projectile event for notifications
 */
export interface ProjectileEvent {
  type: 'fired' | 'hit' | 'expired' | 'destroyed';
  bulletId: EntityId;
  timestamp: number;
  sourceShipId?: EntityId;
  targetId?: EntityId;
  hitResult?: HitResult;
}

/**
 * ProjectileSystem manages bullet lifecycle including creation, physics
 * integration, collision detection, and destruction.
 */
export class ProjectileSystem {
  private state: GameState;
  private physicsAdapter?: PhysicsAdapter;
  private rendererAdapter?: RendererAdapter;
  private spatialIndex?: SpatialIndex;
  private timeAdapter?: TimeAdapter;
  private eventHandlers: ((event: ProjectileEvent) => void)[] = [];

  constructor(
    state: GameState,
    adapters?: {
      physics?: PhysicsAdapter;
      renderer?: RendererAdapter;
      spatial?: SpatialIndex;
      time?: TimeAdapter;
    }
  ) {
    this.state = state;
    this.physicsAdapter = adapters?.physics;
    this.rendererAdapter = adapters?.renderer;
    this.spatialIndex = adapters?.spatial;
    this.timeAdapter = adapters?.time;
  }

  /**
   * Subscribe to projectile events
   */
  onProjectileEvent(handler: (event: ProjectileEvent) => void): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const index = this.eventHandlers.indexOf(handler);
      if (index >= 0) {
        this.eventHandlers.splice(index, 1);
      }
    };
  }

  private emitEvent(event: ProjectileEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (_error) { void _error;logger.warn('Error in projectile event handler:', _error);
      }
    }
  }

  /**
   * Fire a projectile from a ship's turret
   */
  fire(intent: FireIntent): EntityId | null {
    const sourceShip = this.state.ships.find(s => s.id === intent.sourceShipId);
    if (!sourceShip) {
      return null;
    }

    const turret = sourceShip.turrets.find(t => t.id === intent.turretId);
    if (!turret || turret.cooldownLeft > 0) {
      return null;
    }

    // Find turret config
    const shipConfig = getShipClassConfig(sourceShip.class);
    const turretIndex = sourceShip.turrets.indexOf(turret);
    const turretConfig = shipConfig.turrets[turretIndex % shipConfig.turrets.length];

    // Check range
    const target = intent.leadTargetPos ?? intent.targetPosition;
    const dx = target.x - sourceShip.pos.x;
    const dy = target.y - sourceShip.pos.y;
    const dz = target.z - sourceShip.pos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance > turretConfig.range) {
      return null;
    }

    // Create bullet
    const bulletId = this.allocateId();
    const direction = distance > 0 ? {
      x: dx / distance,
      y: dy / distance,
      z: dz / distance
    } : { x: 1, y: 0, z: 0 };

    const bullet: Bullet = {
      id: bulletId,
      ownerShipId: sourceShip.id,
      ownerTeam: sourceShip.team,
      pos: { ...sourceShip.pos },
      vel: {
        x: direction.x * turretConfig.bulletSpeed,
        y: direction.y * turretConfig.bulletSpeed,
        z: direction.z * turretConfig.bulletSpeed
      },
      ttl: this.state.simConfig.bulletLifetime,
      damage: turretConfig.damage
    };

    // Add to state
    this.state.bullets.push(bullet);

    // Register with adapters
    this.registerBulletWithAdapters(bullet);

    // Set turret cooldown
    turret.cooldownLeft = turretConfig.cooldown;

    // Emit event
    this.emitEvent({
      type: 'fired',
      bulletId,
      timestamp: this.state.time,
      sourceShipId: sourceShip.id
    });

    return bulletId;
  }

  /**
   * Update all projectiles (movement, TTL, collisions)
   */
  update(dt: number): void {
    const bulletsToRemove: number[] = [];

    for (let i = 0; i < this.state.bullets.length; i++) {
      const bullet = this.state.bullets[i];
      
      // Update position
      bullet.pos.x += bullet.vel.x * dt;
      bullet.pos.y += bullet.vel.y * dt;
      bullet.pos.z += bullet.vel.z * dt;

      // Update TTL
      bullet.ttl -= dt;
      if (bullet.ttl <= 0) {
        this.emitEvent({
          type: 'expired',
          bulletId: bullet.id,
          timestamp: this.state.time
        });
        bulletsToRemove.push(i);
        continue;
      }

      // Apply boundary physics
      const wasRemoved = this.applyBoundaryPhysics(bullet);
      if (wasRemoved) {
        this.emitEvent({
          type: 'destroyed',
          bulletId: bullet.id,
          timestamp: this.state.time
        });
        bulletsToRemove.push(i);
        continue;
      }

      // Check collisions
      const hitTarget = this.checkCollisions(bullet);
      if (hitTarget) {
        bulletsToRemove.push(i);
        continue;
      }

      // Update adapters
      this.updateBulletInAdapters(bullet);
    }

    // Remove expired/destroyed bullets
    for (let i = bulletsToRemove.length - 1; i >= 0; i--) {
      const index = bulletsToRemove[i];
      const bullet = this.state.bullets[index];
      this.removeBulletFromAdapters(bullet);
      this.state.bullets.splice(index, 1);
    }
  }

  /**
   * Remove a specific bullet
   */
  removeBullet(bulletId: EntityId): boolean {
    const index = this.state.bullets.findIndex(b => b.id === bulletId);
    if (index === -1) {
      return false;
    }

    const bullet = this.state.bullets[index];
    this.removeBulletFromAdapters(bullet);
    this.state.bullets.splice(index, 1);

    this.emitEvent({
      type: 'destroyed',
      bulletId,
      timestamp: this.state.time
    });

    return true;
  }

  /**
   * Get projectile statistics
   */
  getStats(): {
    totalBullets: number;
    bulletsByTeam: Record<Team, number>;
    avgTTL: number;
    avgSpeed: number;
  } {
    const bulletsByTeam = { red: 0, blue: 0 } as Record<Team, number>;
    let totalTTL = 0;
    let totalSpeed = 0;

    for (const bullet of this.state.bullets) {
      bulletsByTeam[bullet.ownerTeam]++;
      totalTTL += bullet.ttl;
      const speed = Math.sqrt(
        bullet.vel.x ** 2 + 
        bullet.vel.y ** 2 + 
        bullet.vel.z ** 2
      );
      totalSpeed += speed;
    }

    const count = this.state.bullets.length;
    return {
      totalBullets: count,
      bulletsByTeam,
      avgTTL: count > 0 ? totalTTL / count : 0,
      avgSpeed: count > 0 ? totalSpeed / count : 0
    };
  }

  private checkCollisions(bullet: Bullet): Ship | null {
    if (!this.spatialIndex) {
      // Fallback to linear search
      return this.checkCollisionsLinear(bullet);
    }

    // Use spatial index for efficient collision detection
    const candidates = this.spatialIndex.queryBulletCollisions(
      bullet.pos, 
      2, // bullet radius
      25 // max ship radius
    );

    for (const candidate of candidates) {
      const ship = this.state.ships.find(s => s.id === candidate.id);
      if (!ship || ship.team === bullet.ownerTeam) {
        continue;
      }

      if (this.testBulletShipCollision(bullet, ship)) {
        this.processBulletHit(bullet, ship);
        return ship;
      }
    }

    return null;
  }

  private checkCollisionsLinear(bullet: Bullet): Ship | null {
    for (const ship of this.state.ships) {
      if (ship.team === bullet.ownerTeam) {
        continue;
      }

      if (this.testBulletShipCollision(bullet, ship)) {
        this.processBulletHit(bullet, ship);
        return ship;
      }
    }

    return null;
  }

  private testBulletShipCollision(bullet: Bullet, ship: Ship): boolean {
    const dx = bullet.pos.x - ship.pos.x;
    const dy = bullet.pos.y - ship.pos.y;
    const dz = bullet.pos.z - ship.pos.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    
    const shipRadius = 20; // Ship collision radius
    const bulletRadius = 2; // Bullet collision radius
    const totalRadius = shipRadius + bulletRadius;
    
    return distSq <= totalRadius * totalRadius;
  }

  private processBulletHit(bullet: Bullet, ship: Ship): void {
    let damage = bullet.damage;
    let penetrated = false;

    // Apply shield damage first
    if (ship.shield > 0) {
      const shieldDamage = Math.min(damage, ship.shield);
      ship.shield -= shieldDamage;
      damage -= shieldDamage;
      
      // Mark shield as dirty for UI optimization
      ship._shieldDirty = true;
      
      // Record shield hit for visual effects
      ship.lastShieldHitTime = this.state.time;
      ship.lastShieldHitStrength = shieldDamage;
      ship.lastShieldHitDir = {
        x: ship.pos.x - bullet.pos.x,
        y: ship.pos.y - bullet.pos.y,
        z: ship.pos.z - bullet.pos.z
      };
    }

    // Apply remaining damage to health (accounting for armor)
    if (damage > 0) {
      const armorReduction = ship.armor;
      const effectiveDamage = Math.max(1, damage - armorReduction);
      ship.health -= effectiveDamage;
      penetrated = true;

      // Mark health as dirty for UI optimization
      ship._healthDirty = true;

      // Track damage source for kill crediting
      ship.lastDamageBy = bullet.ownerShipId;
      ship.lastDamageTime = this.state.time;
    }

    // Create hit result
    const hitResult: HitResult = {
      bulletId: bullet.id,
      targetId: ship.id,
      damage: bullet.damage,
      hitPosition: { ...bullet.pos },
      penetrated
    };

    this.emitEvent({
      type: 'hit',
      bulletId: bullet.id,
      timestamp: this.state.time,
      sourceShipId: bullet.ownerShipId,
      targetId: ship.id,
      hitResult
    });
  }

  private applyBoundaryPhysics(bullet: Bullet): boolean {
    const initialTTL = bullet.ttl;
    applyBoundaryPhysicsBullet(bullet, this.state);
    // If TTL was set to 0, the bullet was marked for removal
    return bullet.ttl <= 0 && initialTTL > 0;
  }

  private registerBulletWithAdapters(bullet: Bullet): void {
    // Register with physics
    if (this.physicsAdapter) {
      this.physicsAdapter.addBody(bullet.id, {
        position: bullet.pos,
        velocity: bullet.vel,
        mass: 0.1, // Light bullet mass
        radius: 2, // Small bullet radius
        collisionMask: bullet.ownerTeam === 'red' ? 0x02 : 0x01 // Hit opposite team
      });
    }

    // Register with renderer
    if (this.rendererAdapter) {
      this.rendererAdapter.ensureMeshForBullet(bullet);
    }

    // Spatial index registration handled in update loop
  }

  private updateBulletInAdapters(bullet: Bullet): void {
    // Update physics
    if (this.physicsAdapter) {
      this.physicsAdapter.setBodyState(bullet.id, {
        position: bullet.pos,
        velocity: bullet.vel,
        mass: 0.1,
        radius: 2
      });
    }

    // Update renderer
    if (this.rendererAdapter) {
      this.rendererAdapter.updateMeshFromBullet(bullet);
    }
  }

  private removeBulletFromAdapters(bullet: Bullet): void {
    this.rendererAdapter?.removeBullet(bullet.id);
    this.physicsAdapter?.removeBody(bullet.id);
  }

  private allocateId(): EntityId {
    return this.state.nextId++;
  }
}

