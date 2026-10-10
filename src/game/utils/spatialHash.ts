import type { Vector3 } from 'three';
import { SpatialGrid } from '../../utils/spatialGrid.js';

/**
 * Backwards-compatible functional wrappers over the generic {@link SpatialGrid}.
 *
 * `querySpatialHash` deliberately uses the stable-order `query` (no full-scan
 * fallback) so order-sensitive callers — projectile collisions, which break on
 * the first hit — keep their exact iteration order.
 */
export type SpatialHash<T> = SpatialGrid<T>;

export function buildSpatialHash<T>(
  items: readonly T[],
  cellSize: number,
  getPosition: (item: T) => Vector3,
): SpatialGrid<T> {
  const grid = new SpatialGrid<T>(cellSize, getPosition);
  grid.repopulate(items);
  return grid;
}

export function clearSpatialHash<T>(hash: SpatialGrid<T>, items: readonly T[]): void {
  hash.repopulate(items);
}

export function querySpatialHash<T>(
  hash: SpatialGrid<T>,
  position: Vector3,
  radius: number,
  out: T[] = [],
): T[] {
  return hash.query(position, radius, out);
}
