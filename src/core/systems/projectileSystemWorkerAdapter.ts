import type { GameState, Bullet, Ship, EntityId, Vector3, Team } from '../../types/index.js';
import type { PhysicsAdapter } from '../adapters/physicsAdapter.js';
import type { RendererAdapter } from '../adapters/rendererAdapter.js';
import type { SpatialIndex } from '../spatialIndex.js';
import type { TimeAdapter } from '../adapters/timeAdapter.js';
import { getShipClassConfig } from '../../config/entitiesConfig.js';
import { recordDamage } from '../gameState.js';
import { createRNG } from '../../utils/rng.js';
import * as logger from '../../utils/logger.js';
import type { FireIntent, ProjectileEvent, HitResult } from './projectileSystem.js';

// Performance measurement helpers
function isDebugPerfEnabled(): boolean {
  try {
    if (typeof window !== 'undefined' && window.location?.search.includes('debugPerf=1')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function recordPerf(name: string, ms: number): void {
  if (!isDebugPerfEnabled()) return;
  try {
    const perfObj = (window as any).__perf;
    if (perfObj && typeof perfObj.addEvent === 'function') {
      perfObj.addEvent({ name, ms });
    }
  } catch {
    /* ignore */
  }
}

/**
 * ProjectileSystemWorkerAdapter manages bullet lifecycle by delegating
 * physics computation to simWorker while handling events and visuals on main thread.
 */
export class ProjectileSystemWorkerAdapter {
  private state: GameState;
  private rendererAdapter?: RendererAdapter;
  private spatialIndex?: SpatialIndex;
  private timeAdapter?: TimeAdapter;
  private eventHandlers: ((event: ProjectileEvent) => void)[] = [];
  private worker: Worker | null = null;

  constructor(
    state: GameState,
    adapters?: {
      physics?: PhysicsAdapter;
      renderer?: RendererAdapter;
      spatial?: SpatialIndex;
      time?: TimeAdapter;
    },
    worker?: Worker | null
  ) {
    this.state = state;
    // Note: physics adapter not used since physics is handled by worker
    this.rendererAdapter = adapters?.renderer;
    this.spatialIndex = adapters?.spatial;
    this.timeAdapter = adapters?.time;
    this.worker = worker || null;
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

  emitEvent(event: ProjectileEvent): void {
    // Log emitted events at info level so wiring can be traced in runtime
    try {
      logger.info('[ProjectileSystemWorkerAdapter] emitEvent', event.type, {
        bulletId: event.bulletId,
        sourceShipId: event.sourceShipId ?? null,
        targetId: event.targetId ?? null,
      });
    } catch {
      /* ignore logging failures */
    }

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (_error) {
        void _error;
        logger.warn('Error in projectile event handler:', _error);
      }
    }
  }

  /**
   * Fire a projectile from a ship's turret - delegates bullet creation to worker
   */
  fire(intent: FireIntent): EntityId | null {
    const t0 = isDebugPerfEnabled() ? performance.now() : 0;
    
    const sourceShip = this.state.ships.find((s) => s.id === intent.sourceShipId);
    if (!sourceShip) {
      return null;
    }

    const turret = sourceShip.turrets.find((t) => t.id === intent.turretId);
    if (!turret || turret.cooldownLeft > 0) {
      return null;
    }

    // Find turret config
    const shipConfig = getShipClassConfig(sourceShip.class);
    const turretIndex = sourceShip.turrets.indexOf(turret);
    const turretConfig = shipConfig.turrets[turretIndex % shipConfig.turrets.length];

    // Check range (use squared distance to avoid sqrt in the common out-of-range case)
    const target = intent.leadTargetPos ?? intent.targetPosition;
    const dx = target.x - sourceShip.pos.x;
    const dy = target.y - sourceShip.pos.y;
    const dz = target.z - sourceShip.pos.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    const range = turretConfig.range;
    const rangeSq = range * range;

    if (distSq > rangeSq) {
      return null;
    }

    // Create bullet ID and direction (same logic as original system)
    const bulletId = this.allocateId();
    let direction = { x: 1, y: 0, z: 0 };
    if (distSq > 0) {
      const sqrt = Math.sqrt;
      const distance = sqrt(distSq);
      direction = { x: dx / distance, y: dy / distance, z: dz / distance };
    }

    // Apply accuracy/spread based on turret config and ship level
    try {
      const turretAccuracy =
        typeof turretConfig.accuracy === 'number' ? turretConfig.accuracy : 1.0;
      const maxSpread =
        typeof turretConfig.maxSpreadRadians === 'number'
          ? turretConfig.maxSpreadRadians
          : (2 * Math.PI) / 180;

      const shipLevel = sourceShip.level?.level ?? 1;
      const globalSettings = this.state.behaviorConfig
        ? this.state.behaviorConfig.globalSettings
        : undefined;
      const perLevel =
        globalSettings && typeof globalSettings.turretLevelAccuracyPerLevel === 'number'
          ? globalSettings.turretLevelAccuracyPerLevel
          : 0.02;
      const maxReduction =
        globalSettings && typeof globalSettings.turretLevelAccuracyMaxReduction === 'number'
          ? globalSettings.turretLevelAccuracyMaxReduction
          : 0.5;
      const levelReduction = Math.max(0, Math.min(maxReduction, (shipLevel - 1) * perLevel));

      const baseInaccuracy = Math.max(0, 1 - turretAccuracy);
      const finalInaccuracy = baseInaccuracy * (1 - levelReduction);

      if (finalInaccuracy > 1e-6) {
        const coneAngle = finalInaccuracy * maxSpread;
        const rng = this.state?.rng ?? createRNG(String(Date.now()));
        const rngNext = () => rng.next();

        const cosTheta = 1 - (1 - Math.cos(coneAngle)) * rngNext();
        const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
        const phi = 2 * Math.PI * rngNext();

        const ux = direction.x, uy = direction.y, uz = direction.z;
        let vx: number, vy: number, vz: number;
        if (Math.abs(ux) < 0.9) {
          vx = 0; vy = -uz; vz = uy;
        } else {
          vx = uz; vy = 0; vz = -ux;
        }
        const vlenSq = vx * vx + vy * vy + vz * vz;
        const vlen = vlenSq > 0 ? Math.sqrt(vlenSq) : 1;
        vx /= vlen; vy /= vlen; vz /= vlen;
        const wx = uy * vz - uz * vy;
        const wy = uz * vx - ux * vz;
        const wz = ux * vy - uy * vx;

        const sampledX = cosTheta * ux + sinTheta * (Math.cos(phi) * vx + Math.sin(phi) * wx);
        const sampledY = cosTheta * uy + sinTheta * (Math.cos(phi) * vy + Math.sin(phi) * wy);
        const sampledZ = cosTheta * uz + sinTheta * (Math.cos(phi) * vz + Math.sin(phi) * wz);
        const sLenSq = sampledX * sampledX + sampledY * sampledY + sampledZ * sampledZ;
        const sLen = sLenSq > 0 ? Math.sqrt(sLenSq) : 1;
        direction = { x: sampledX / sLen, y: sampledY / sLen, z: sampledZ / sLen };
      }
    } catch (e) {
      logger.warn('[ProjectileSystemWorkerAdapter] spread calculation failed', e);
    }

    // Create bullet locally for tracking and visuals
    const bullet: Bullet = {
      id: bulletId,
      ownerShipId: sourceShip.id,
      ownerTeam: sourceShip.team,
      pos: { ...sourceShip.pos },
      prevPos: { ...sourceShip.pos },
      vel: {
        x: direction.x * turretConfig.bulletSpeed,
        y: direction.y * turretConfig.bulletSpeed,
        z: direction.z * turretConfig.bulletSpeed,
      },
      ttl: this.state.simConfig.bulletLifetime,
      damage: turretConfig.damage,
    };

    // Add to local state
    this.state.bullets.push(bullet);

    // Send bullet to worker for physics simulation
    if (this.worker) {
      try {
        this.worker.postMessage({
          type: 'fire-bullet',
          payload: {
            id: bulletId,
            ownerShipId: sourceShip.id,
            ownerTeam: sourceShip.team,
            pos: bullet.pos,
            vel: bullet.vel,
            ttl: bullet.ttl,
            damage: bullet.damage,
          },
        });
      } catch (e) {
        logger.warn('[ProjectileSystemWorkerAdapter] Failed to send bullet to worker:', e);
      }
    }

    // Register with renderer
    if (this.rendererAdapter) {
      this.rendererAdapter.ensureMeshForBullet(bullet);
    }

    // Set turret cooldown
    turret.cooldownLeft = turretConfig.cooldown;

    // Emit event
    this.emitEvent({
      type: 'fired',
      bulletId,
      timestamp: this.state.time,
      sourceShipId: sourceShip.id,
    });

    // Record performance metrics for bullet firing
    if (isDebugPerfEnabled()) {
      const fireTime = performance.now() - t0;
      recordPerf('projectile.fire.worker', fireTime);
    }

    return bulletId;
  }

  /**
   * Update projectiles - mainly handles visual updates since physics is in worker
   */
  update(dt: number): void {
    const t0 = isDebugPerfEnabled() ? performance.now() : 0;

    // Update renderer for all bullets
    if (this.rendererAdapter) {
      for (const bullet of this.state.bullets) {
        this.rendererAdapter.updateMeshFromBullet(bullet);
      }
    }

    // Check for collisions that may have been missed by worker
    // This provides a backup collision detection for edge cases
    this.checkMainThreadCollisions();

    // Record performance metrics
    if (isDebugPerfEnabled()) {
      const processingTime = performance.now() - t0;
      recordPerf('projectile.update.worker', processingTime);
      recordPerf('projectile.count.worker', this.state.bullets.length);
    }
  }

  /**
   * Remove a specific bullet
   */
  removeBullet(bulletId: EntityId): boolean {
    const index = this.state.bullets.findIndex((b) => b.id === bulletId);
    if (index === -1) {
      return false;
    }

    const bullet = this.state.bullets[index];
    
    // Remove from renderer
    if (this.rendererAdapter) {
      this.rendererAdapter.removeBullet(bulletId);
    }
    
    // Remove from local state
    this.state.bullets.splice(index, 1);

    // Notify worker to remove bullet
    if (this.worker) {
      try {
        this.worker.postMessage({
          type: 'remove-bullet',
          payload: { bulletId },
        });
      } catch (e) {
        logger.warn('[ProjectileSystemWorkerAdapter] Failed to remove bullet from worker:', e);
      }
    }

    this.emitEvent({
      type: 'destroyed',
      bulletId,
      timestamp: this.state.time,
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
      const speed = Math.sqrt(bullet.vel.x ** 2 + bullet.vel.y ** 2 + bullet.vel.z ** 2);
      totalSpeed += speed;
    }

    const count = this.state.bullets.length;
    return {
      totalBullets: count,
      bulletsByTeam,
      avgTTL: count > 0 ? totalTTL / count : 0,
      avgSpeed: count > 0 ? totalSpeed / count : 0,
    };
  }

  private checkMainThreadCollisions(): void {
    // Simplified collision detection as backup to worker physics
    // This helps ensure hits are registered even if worker misses them
    const t0 = isDebugPerfEnabled() ? performance.now() : 0;

    for (const bullet of this.state.bullets) {
      if (!this.spatialIndex) {
        // Fallback to linear search
        this.checkCollisionsLinear(bullet);
      } else {
        // Use spatial index for efficient collision detection
        const candidates = this.spatialIndex.queryBulletCollisions(
          bullet.pos,
          2, // bullet radius
          25, // max ship radius
        );

        for (const candidate of candidates) {
          const ship = this.state.ships.find((s) => s.id === candidate.id);
          if (!ship || ship.team === bullet.ownerTeam) {
            continue;
          }

          if (this.testBulletShipCollision(bullet, ship)) {
            this.processBulletHit(bullet, ship);
            this.removeBullet(bullet.id);
            break;
          }
        }
      }
    }

    // Record performance metrics for collision detection
    if (isDebugPerfEnabled()) {
      const collisionTime = performance.now() - t0;
      recordPerf('projectile.collision.worker', collisionTime);
    }
  }

  private checkCollisionsLinear(bullet: Bullet): void {
    for (const ship of this.state.ships) {
      if (ship.team === bullet.ownerTeam) {
        continue;
      }

      if (this.testBulletShipCollision(bullet, ship)) {
        this.processBulletHit(bullet, ship);
        this.removeBullet(bullet.id);
        break;
      }
    }
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
        z: ship.pos.z - bullet.pos.z,
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

      // Centralize XP/ai bookkeeping and last-damage tracking
      recordDamage(this.state, ship, effectiveDamage, bullet.ownerShipId);
    }

    // Create hit result
    const hitResult: HitResult = {
      bulletId: bullet.id,
      targetId: ship.id,
      damage: bullet.damage,
      hitPosition: { ...bullet.pos },
      penetrated,
    };

    this.emitEvent({
      type: 'hit',
      bulletId: bullet.id,
      timestamp: this.state.time,
      sourceShipId: bullet.ownerShipId,
      targetId: ship.id,
      hitResult,
    });
  }

  private allocateId(): EntityId {
    return this.state.nextId++;
  }
}