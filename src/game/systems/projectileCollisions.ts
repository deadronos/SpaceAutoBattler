import type { GameEntity, GameState, ProjectileEntity, ShipEntity } from '../../types/index.js';
import type { ProjectileCategory } from '../../types/combat.js';
import { resolveProjectileCategory, resolveProjectileInfo } from '../../utils/projectileInfo.js';
import { destroyEntity } from '../state.js';
import {
  buildSpatialHash,
  clearSpatialHash,
  querySpatialHash,
  type SpatialHash,
} from '../utils/spatialHash.js';
import { ensureInterruptState, getInterruptQueue } from './decision/interrupts.js';
import { applyProjectileDamage, getDamageBuffers } from './projectileDamage.js';

const SHIP_GRID_CELL_SIZE = 12;

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
    if (target && target.ship.hp > 0 && target.ship.team !== projectile.projectile.team) {
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
  primaryTarget: ShipEntity | null,
): void {
  const origin = projectile.transform.position;
  const nearbyShips = querySpatialHash(shipSpatialHash, origin, radius);
  for (const ship of nearbyShips) {
    if (ship.ship.hp <= 0) continue;
    if (primaryTarget && ship === primaryTarget) continue;
    if (ship.ship.team === projectile.projectile.team) continue;
    const distance = ship.transform.position.distanceTo(origin);
    if (distance > radius) continue;
    const outcome = applyProjectileDamage(state, projectile, ship, ships, shipsById);
    if (outcome.destroyed) {
      toRemove.add(ship);
    }
  }
}

/**
 * Resolves projectile collisions and timeouts.
 * Checks for impacts using a spatial hash and applies damage/AoE effects.
 *
 * @param {GameState} state - The game state.
 * @param {number} delta - The time step.
 */
export function resolveProjectiles(state: GameState, delta: number): void {
  const ships = state.queries.ships.entities as ShipEntity[];
  const buffers = getDamageBuffers(state);

  // Reuse the per-state spatial hash to avoid allocations
  if (!buffers.shipHash) {
    buffers.shipHash = buildSpatialHash(
      ships,
      SHIP_GRID_CELL_SIZE,
      (ship) => ship.transform.position,
    );
  } else {
    clearSpatialHash(buffers.shipHash, ships);
  }
  const shipSpatialHash = buffers.shipHash;

  // Reuse the per-state shipsById map
  buffers.shipsById.clear();
  for (const ship of ships) {
    buffers.shipsById.set(ship.id, ship);
  }
  const shipsById = buffers.shipsById;
  const maxShipImpactRadius = ships.reduce(
    (radius, ship) => Math.max(radius, ship.transform.scale * 0.9),
    0,
  );
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

    // Proximity fuse check
    if (projectile.projectile.proximityFuse && isProjectileArmed(projectile, state.time)) {
      const fuseRadius = projectile.projectile.proximityFuse.radius;
      const fuseTargets = querySpatialHash(
        shipSpatialHash,
        projectile.transform.position,
        fuseRadius,
      );

      let triggered = false;
      for (const target of fuseTargets) {
        if (target.ship.hp <= 0) continue;
        if (target.ship.team === projectile.projectile.team) continue;
        const dist = target.transform.position.distanceTo(projectile.transform.position);
        if (dist <= fuseRadius) {
          triggered = true;
          break;
        }
      }

      if (triggered) {
        toRemove.add(projectile);
        if (projectile.projectile.aoeRadius && projectile.projectile.aoeRadius > 0) {
          applyAoeDamage(
            state,
            projectile,
            ships,
            shipsById,
            shipSpatialHash,
            toRemove,
            projectile.projectile.aoeRadius,
            null,
          );
        }
        continue;
      }
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
      if (ship.ship.hp <= 0) continue;
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
