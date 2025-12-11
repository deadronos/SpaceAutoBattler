import type { Vector3 } from 'three';

/**
 * A spatial hash grid for efficient spatial queries.
 */
export interface SpatialHash<T> {
  cellSize: number;
  grid: Map<string, T[]>;
  getPosition: (item: T) => Vector3;
}

function toCellIndex(value: number, cellSize: number): number {
  return Math.floor(value / cellSize);
}

function toKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

/**
 * Builds a spatial hash from a list of items.
 *
 * @template T - The type of item stored.
 * @param {readonly T[]} items - The items to index.
 * @param {number} cellSize - The size of each grid cell.
 * @param {(item: T) => Vector3} getPosition - Function to extract position from an item.
 * @returns {SpatialHash<T>} The built spatial hash.
 */
export function buildSpatialHash<T>(
  items: readonly T[],
  cellSize: number,
  getPosition: (item: T) => Vector3,
): SpatialHash<T> {
  const grid = new Map<string, T[]>();

  for (const item of items) {
    const pos = getPosition(item);
    const key = toKey(
      toCellIndex(pos.x, cellSize),
      toCellIndex(pos.y, cellSize),
      toCellIndex(pos.z, cellSize),
    );
    const bucket = grid.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      grid.set(key, [item]);
    }
  }

  return { grid, cellSize, getPosition };
}

/**
 * Queries the spatial hash for items within a radius of a position.
 * Note: This implementation is approximate (checks cells overlapping the bounding box of the sphere).
 *
 * @template T - The type of item.
 * @param {SpatialHash<T>} hash - The spatial hash to query.
 * @param {Vector3} position - The center of the query sphere.
 * @param {number} radius - The radius of the query sphere.
 * @param {T[]} [out=[]] - Array to store results in.
 * @returns {T[]} The list of items found.
 */
export function querySpatialHash<T>(
  hash: SpatialHash<T>,
  position: Vector3,
  radius: number,
  out: T[] = [],
): T[] {
  out.length = 0;
  if (radius < 0) return out;
  const radiusSq = radius * radius;

  const cellRange = Math.max(0, Math.ceil(radius / hash.cellSize));
  const baseX = toCellIndex(position.x, hash.cellSize);
  const baseY = toCellIndex(position.y, hash.cellSize);
  const baseZ = toCellIndex(position.z, hash.cellSize);

  for (let dx = -cellRange; dx <= cellRange; dx += 1) {
    for (let dy = -cellRange; dy <= cellRange; dy += 1) {
      for (let dz = -cellRange; dz <= cellRange; dz += 1) {
        const key = toKey(baseX + dx, baseY + dy, baseZ + dz);
        const bucket = hash.grid.get(key);
        if (bucket) {
          for (const item of bucket) {
            const pos = hash.getPosition(item);
            const dxPos = pos.x - position.x;
            const dyPos = pos.y - position.y;
            const dzPos = pos.z - position.z;
            if (dxPos * dxPos + dyPos * dyPos + dzPos * dzPos <= radiusSq) {
              out.push(item);
            }
          }
        }
      }
    }
  }

  return out;
}
