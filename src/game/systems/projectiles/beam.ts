import type { Vector3 } from 'three';
import type { GameState, ProjectileEntity, ShipEntity } from '../../../types/index.js';

/**
 * Information about where a beam hits.
 */
export interface BeamHitInfo {
  hitPoint: Vector3;
  targetId?: number;
  distance: number;
}

/**
 * Performs a raycast to determine where a beam projectile hits.
 *
 * @param {GameState} state - The game state.
 * @param {Vector3} start - The start position of the beam.
 * @param {Vector3} direction - The direction of the beam.
 * @param {number} range - The maximum range of the beam.
 * @returns {BeamHitInfo} Information about the hit point and target.
 */
export function createBeamHitInfo(
  state: GameState,
  start: Vector3,
  direction: Vector3,
  range: number,
): BeamHitInfo {
  const ray = new state.rapier.Ray(start, direction);
  const hit = state.physicsWorld.castRay(ray, range, true);
  if (!hit) {
    return { hitPoint: start.clone().addScaledVector(direction, range), distance: range };
  }

  const collider = hit.collider;
  const handle = (collider as { handle?: number } | undefined)?.handle;
  const entity =
    handle != null
      ? (state.colliderLookup.get(handle) as ProjectileEntity | ShipEntity | undefined)
      : undefined;
  const distance = (hit as { toi?: number; timeOfImpact?: number }).toi ?? hit.timeOfImpact;
  const hitPoint = start.clone().addScaledVector(direction, distance);
  const targetId = entity?.ship ? entity.id : undefined;
  return { hitPoint, targetId, distance };
}
