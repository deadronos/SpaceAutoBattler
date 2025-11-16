import { Vector3 } from 'three';
import type {
  GameEntity,
  GameState,
  ProjectileEntity,
  ShipEntity,
  ShieldRipple,
} from '../../types/index.js';
import { resolveProjectileCategory, resolveProjectileInfo } from '../../utils/projectileInfo.js';
import { awardDamageXp, awardKillXp } from '../progression.js';
import { applySubsystemDamage } from '../subsystems.js';
import { applyDamageResultToShip, calculateEffectiveDamage } from '../combat/damage.js';
import { emitShipKillExplosion } from '../explosions.js';
import { destroyEntity } from '../state.js';
import { AI_CONFIG } from '../config.js';
import {
  accumulateInterruptDamage,
  ensureInterruptState,
  getInterruptQueue,
  queueInterrupt,
  queueTargetLossInterrupts,
} from './decision/interrupts.js';
import type { ProjectileCategory } from '../../types/combat.js';
import { safeNormalize } from '../../utils/steering.js';
import { appendCappedMutable } from '../../utils/cappedBuffer.js';
import type { SpatialHash } from '../utils/spatialHash.js';
import { buildSpatialHash, querySpatialHash } from '../utils/spatialHash.js';

const TEMP_RIPPLE_DIR = new Vector3();
const SHIP_GRID_CELL_SIZE = 12;

export interface ProjectileDamageOutcome {
  totalDamage: number;
  hullDamage: number;
  destroyed: boolean;
}

export function applyProjectileDamage(
  state: GameState,
  projectile: ProjectileEntity,
  ship: ShipEntity,
  ships: ShipEntity[],
  shipsById: Map<number, ShipEntity>,
): ProjectileDamageOutcome {
  const projectileCategory =
    projectile.projectile.category ?? resolveProjectileCategory(projectile.projectile.bulletType);
  const damageResult = calculateEffectiveDamage(
    projectile.projectile.damage,
    projectile.projectile.damageType,
    ship.ship.shield,
    ship.ship.armor,
  );

  const manager = state.ai;
  const sourceMeta = {
    id: projectile.projectile.sourceId ?? undefined,
    team: projectile.projectile.team,
    bulletType: projectile.projectile.bulletType,
    category: projectileCategory,
  };
  const attackerShip = sourceMeta.id
    ? shipsById.get(sourceMeta.id)
    : ships.find((s) => s.ship.team === sourceMeta.team);

  const outcome = applyDamageResultToShip({
    state,
    ship,
    damageResult,
    source: sourceMeta,
    rngSeed: projectile.id + state.time,
    callbacks: {
      emitShieldRipple: ({ strength }) => {
        TEMP_RIPPLE_DIR.copy(projectile.transform.position).sub(ship.transform.position);
        safeNormalize(TEMP_RIPPLE_DIR, TEMP_RIPPLE_DIR);
        const ripple: ShieldRipple = {
          dir: TEMP_RIPPLE_DIR.clone(),
          t0: state.time,
          amp: strength,
        };
        const list = (ship.shieldRipples ??= []);
        appendCappedMutable(list, ripple, 64);
      },
      applySubsystemDamage: (component, hullDamage, rng) => {
        applySubsystemDamage(component, hullDamage, rng);
      },
      onDamageApplied: ({ totalDamage, hullDamage }) => {
        if (totalDamage > 0 && attackerShip) {
          awardDamageXp(
            attackerShip.ship,
            totalDamage,
            state,
            attackerShip.id,
            projectile.projectile.bulletType,
            projectileCategory,
          );
        }

        if (manager && hullDamage > 0) {
          const accumulated = accumulateInterruptDamage(
            manager,
            ship.id,
            hullDamage,
            manager.tickIndex,
          );
          const maxHp = Math.max(1, ship.ship.maxHp);
          if (accumulated / maxHp >= (AI_CONFIG.interruptHpDrop ?? 0.1)) {
            queueInterrupt(manager, {
              shipId: ship.id,
              reason: 'hp-drop',
              tick: manager.tickIndex,
              sourceId: projectile.id,
            });
          }
        }
      },
      onKill: () => {
        if (manager) {
          queueTargetLossInterrupts(state, ships, ship.id);
        }
        if (attackerShip) {
          awardKillXp(attackerShip.ship, ship.ship.maxHp, state, attackerShip.id);
        }
        emitShipKillExplosion(state, ship, projectile);
      },
    },
  });

  return outcome;
}

function isProjectileArmed(projectile: ProjectileEntity, now: number): boolean {
  const armingTime = projectile.projectile.armingTime ?? 0;
  if (armingTime <= 0) return true;
  const spawnTime = projectile.projectile.spawnTime;
  if (spawnTime == null) return true;
  return now - spawnTime >= armingTime;
}

function handleBeamProjectile(
  state: GameState,
  projectile: ProjectileEntity,
  ships: ShipEntity[],
  shipsById: Map<number, ShipEntity>,
  toRemove: Set<GameEntity>,
  delta: number,
): void {
  const beam = projectile.projectile.beam;
  projectile.projectile.ttl -= delta;
  if (!beam) {
    toRemove.add(projectile);
    return;
  }

  if (!beam.applied && projectile.projectile.targetId != null) {
    const target = shipsById.get(projectile.projectile.targetId);
    if (target && target.ship.team !== projectile.projectile.team) {
      const outcome = applyProjectileDamage(state, projectile, target, ships, shipsById);
      if (outcome.destroyed) {
        toRemove.add(target);
      }
    }
    beam.applied = true;
  }

  if (projectile.projectile.ttl <= 0) {
    toRemove.add(projectile);
  }
}

function applyAoeDamage(
  state: GameState,
  projectile: ProjectileEntity,
  ships: ShipEntity[],
  shipsById: Map<number, ShipEntity>,
  shipSpatialHash: SpatialHash<ShipEntity>,
  toRemove: Set<GameEntity>,
  radius: number,
  primaryTarget: ShipEntity,
): void {
  const origin = primaryTarget.transform.position;
  const nearbyShips = querySpatialHash(shipSpatialHash, origin, radius);
  for (const ship of nearbyShips) {
    if (ship === primaryTarget) continue;
    if (ship.ship.team === projectile.projectile.team) continue;
    const distance = ship.transform.position.distanceTo(origin);
    if (distance > radius) continue;
    const outcome = applyProjectileDamage(state, projectile, ship, ships, shipsById);
    if (outcome.destroyed) {
      toRemove.add(ship);
    }
  }
}

export function resolveProjectiles(state: GameState, delta: number): void {
  const ships = state.queries.ships.entities as ShipEntity[];
  const shipSpatialHash: SpatialHash<ShipEntity> = buildSpatialHash(
    ships,
    SHIP_GRID_CELL_SIZE,
    (ship) => ship.transform.position,
  );
  const shipsById = new Map<number, ShipEntity>();
  for (const ship of ships) {
    shipsById.set(ship.id, ship);
  }
  const maxShipImpactRadius = ships.reduce((radius, ship) => Math.max(radius, ship.transform.scale * 0.9), 0);
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  const toRemove = new Set<GameEntity>();
  const manager = state.ai;
  if (manager) {
    ensureInterruptState(manager);
    getInterruptQueue(manager);
  }

  for (const projectile of projectiles) {
    const category: ProjectileCategory =
      projectile.projectile.category ?? resolveProjectileCategory(projectile.projectile.bulletType);

    if (category === 'beam') {
      handleBeamProjectile(state, projectile, ships, shipsById, toRemove, delta);
      continue;
    }

    projectile.projectile.ttl -= delta;
    if (projectile.projectile.ttl <= 0) {
      toRemove.add(projectile);
      continue;
    }

    const info = resolveProjectileInfo(projectile.projectile.bulletType);
    const projRadius =
      info.config.colliderRadius ?? Math.max(0.08, projectile.transform.scale * 1.2);
    const searchRadius = maxShipImpactRadius + projRadius;

    const nearbyShips = querySpatialHash(
      shipSpatialHash,
      projectile.transform.position,
      searchRadius,
    );

    for (const ship of nearbyShips) {
      const impactRadius = ship.transform.scale * 0.9 + projRadius;
      if (ship.ship.team === projectile.projectile.team) continue;
      const distance = ship.transform.position.distanceTo(projectile.transform.position);
      if (distance > impactRadius) continue;
      if (!isProjectileArmed(projectile, state.time)) {
        // Not armed yet — skip damage but allow future collisions.
        continue;
      }

      const outcome = applyProjectileDamage(state, projectile, ship, ships, shipsById);
      toRemove.add(projectile);

      if (outcome.destroyed) {
        toRemove.add(ship);
      }

      if (projectile.projectile.aoeRadius && projectile.projectile.aoeRadius > 0) {
        applyAoeDamage(
          state,
          projectile,
          ships,
          shipsById,
          shipSpatialHash,
          toRemove,
          projectile.projectile.aoeRadius,
          ship,
        );
      }
      break;
    }
  }

  for (const entity of toRemove) {
    destroyEntity(state, entity);
  }
}
