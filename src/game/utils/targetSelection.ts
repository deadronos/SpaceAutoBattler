import type { Vector3 } from 'three';
import type { GameState, ProjectileEntity, ShipEntity, Team } from '../../types/index.js';
import type { ProjectileCategory } from '../../types/combat.js';

/**
 * Finds the nearest enemy ship to a given origin ship.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} origin - The searching ship.
 * @returns {ShipEntity | null} The nearest enemy, or null if none found.
 */
export function findNearestEnemy(state: GameState, origin: ShipEntity): ShipEntity | null {
  const ships = state.queries.ships.entities as ShipEntity[];
  let closest: ShipEntity | null = null;
  let shortestSq = Number.POSITIVE_INFINITY;

  for (const ship of ships) {
    if (ship === origin) continue;
    if (ship.ship.team === origin.ship.team) continue;
    const distanceSq = origin.transform.position.distanceToSquared(ship.transform.position);
    if (distanceSq < shortestSq) {
      shortestSq = distanceSq;
      closest = ship;
    }
  }

  return closest;
}

export interface PointDefenseTargetOptions {
  origin: Vector3;
  team: Team;
  maxRange: number;
  preferTargetId?: number;
  categories?: ProjectileCategory[];
}

const DEFAULT_PD_CATEGORIES: ProjectileCategory[] = ['missile', 'torpedo'];

/**
 * Finds the nearest hostile projectile for point-defense targeting.
 *
 * @param {GameState} state - The game state.
 * @param {PointDefenseTargetOptions} options - Targeting options.
 * @returns {ProjectileEntity | null} The selected projectile target.
 */
export function findPointDefenseTarget(
  state: GameState,
  options: PointDefenseTargetOptions,
): ProjectileEntity | null {
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  const maxRangeSq = Math.max(0, options.maxRange) ** 2;
  const categories = options.categories ?? DEFAULT_PD_CATEGORIES;
  let best: ProjectileEntity | null = null;
  let bestSq = Number.POSITIVE_INFINITY;
  let bestIncoming: ProjectileEntity | null = null;
  let bestIncomingSq = Number.POSITIVE_INFINITY;

  for (const projectile of projectiles) {
    if (projectile.projectile.team === options.team) continue;
    const category = projectile.projectile.category ?? 'bullet';
    const isThreat = projectile.projectile.homing || categories.includes(category);
    if (!isThreat) continue;

    const distanceSq = options.origin.distanceToSquared(projectile.transform.position);
    if (distanceSq > maxRangeSq) continue;

    if (
      options.preferTargetId != null &&
      projectile.projectile.targetId === options.preferTargetId
    ) {
      if (distanceSq < bestIncomingSq) {
        bestIncomingSq = distanceSq;
        bestIncoming = projectile;
      }
      continue;
    }

    if (distanceSq < bestSq) {
      bestSq = distanceSq;
      best = projectile;
    }
  }

  return bestIncoming ?? best;
}
