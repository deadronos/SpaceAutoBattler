import { Vector3 } from 'three';

export type SpatialGridItemPosition<T> = (item: T) => Vector3;

/**
 * Radix per axis for the packed integer cell key.
 *
 * Each cell coordinate is biased into `[0, KEY_BASE)` and the three biased
 * digits form a mixed-radix number `((ux * KEY_BASE) + uy) * KEY_BASE + uz`.
 * The largest key is `KEY_BASE^3 - 1 = 2^51 - 1`, comfortably below
 * `Number.MAX_SAFE_INTEGER`, so the packing is exact (no float rounding) and
 * therefore collision-free within the safe coordinate range.
 */
const KEY_BASE = 1 << 17; // 131072
/** Bias added to each cell coordinate so negatives become non-negative digits. */
const KEY_OFFSET = 1 << 16; // 65536
/** Cell coordinates are packed as integers while `|coord| < KEY_LIMIT`. */
const KEY_LIMIT = 1 << 16; // 65536

/**
 * Generic spatial grid for broad-phase culling.
 * Divides space into uniform cells to quickly find nearby entities.
 *
 * Two query strategies are offered so callers can preserve their required
 * semantics:
 * - `query` iterates the cell neighbourhood in a stable order (no fallback),
 *   which order-sensitive callers (projectile collisions) rely on.
 * - `queryBroad` adds a full-scan fallback for large search volumes (sensors),
 *   which is cheaper when the cell neighbourhood dwarfs the populated cells.
 *   It returns the same set of items; only the iteration order can differ.
 */
export class SpatialGrid<T> {
  private cellSize: number;
  private cells: Map<number | string, T[]>;
  private getPosition: SpatialGridItemPosition<T>;

  constructor(cellSize: number, getPosition: SpatialGridItemPosition<T>) {
    this.cellSize = cellSize;
    this.cells = new Map();
    this.getPosition = getPosition;
  }

  /**
   * Packs a cell coordinate triple into a collision-free integer key.
   *
   * While `|cx|,|cy|,|cz| < KEY_LIMIT` (2^16) each biased digit lies in
   * `[0, KEY_BASE)` and the mixed-radix packing is a bijection, so two distinct
   * cells can never share a numeric key. Coordinates outside that range fall
   * back to the legacy string key; a numeric key can never equal a string key,
   * so out-of-range cells also stay collision-free.
   */
  private packCellKey(cx: number, cy: number, cz: number): number | string {
    if (Math.abs(cx) >= KEY_LIMIT || Math.abs(cy) >= KEY_LIMIT || Math.abs(cz) >= KEY_LIMIT) {
      return `${cx},${cy},${cz}`;
    }
    return ((cx + KEY_OFFSET) * KEY_BASE + (cy + KEY_OFFSET)) * KEY_BASE + (cz + KEY_OFFSET);
  }

  /**
   * Converts a world position to a cell key.
   */
  private getCellKey(x: number, y: number, z: number): number | string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return this.packCellKey(cx, cy, cz);
  }

  /**
   * Clears all cells.
   */
  clear(): void {
    this.cells.clear();
  }

  /**
   * Inserts an item into the grid.
   */
  insert(item: T): void {
    const pos = this.getPosition(item);
    const key = this.getCellKey(pos.x, pos.y, pos.z);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(item);
  }

  /**
   * Clears and repopulates the grid from a list of items.
   */
  repopulate(items: readonly T[]): void {
    this.cells.clear();
    for (const item of items) {
      this.insert(item);
    }
  }

  /**
   * Queries items within a radius, iterating the cell neighbourhood in a stable
   * order. No full-scan fallback, so ordering is deterministic for
   * order-sensitive callers.
   *
   * @param {Vector3} position - Query centre.
   * @param {number} radius - Query radius.
   * @param {T[]} [out] - Optional reusable buffer (cleared first).
   * @returns {T[]}
   */
  query(position: Vector3, radius: number, out: T[] = []): T[] {
    out.length = 0;
    if (radius < 0) return out;
    const radiusSq = radius * radius;
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerX = Math.floor(position.x / this.cellSize);
    const centerY = Math.floor(position.y / this.cellSize);
    const centerZ = Math.floor(position.z / this.cellSize);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
          const key = this.packCellKey(centerX + dx, centerY + dy, centerZ + dz);
          const cell = this.cells.get(key);
          if (!cell) continue;
          for (const item of cell) {
            const pos = this.getPosition(item);
            const ox = pos.x - position.x;
            const oy = pos.y - position.y;
            const oz = pos.z - position.z;
            if (ox * ox + oy * oy + oz * oz <= radiusSq) {
              out.push(item);
            }
          }
        }
      }
    }

    return out;
  }

  /**
   * Queries items within a radius, scanning all populated cells when the cell
   * neighbourhood is much larger than the number of populated cells. Returns
   * the same set as `query`, but ordering may differ.
   *
   * @param {Vector3} position - Query centre.
   * @param {number} radius - Query radius.
   * @param {T[]} [out] - Optional reusable buffer (cleared first).
   * @returns {T[]}
   */
  queryBroad(position: Vector3, radius: number, out: T[] = []): T[] {
    out.length = 0;
    if (radius < 0) return out;
    const radiusSq = radius * radius;
    const cellRadius = Math.ceil(radius / this.cellSize);

    // If the volume of cells to search is extremely large relative to the number
    // of actually populated cells, scan all populated cells directly.
    const totalCellsToScan = Math.pow(cellRadius * 2 + 1, 3);
    if (totalCellsToScan > this.cells.size) {
      for (const cell of this.cells.values()) {
        for (const item of cell) {
          const pos = this.getPosition(item);
          const ox = pos.x - position.x;
          const oy = pos.y - position.y;
          const oz = pos.z - position.z;
          if (ox * ox + oy * oy + oz * oz <= radiusSq) {
            out.push(item);
          }
        }
      }
      return out;
    }

    return this.query(position, radius, out);
  }

  /**
   * Returns the candidate item minimizing `(distanceSq, rank(item))`, or `null`
   * when no item satisfies `isCandidate`.
   *
   * The search expands over cell shells by increasing Chebyshev ring
   * `r = 0, 1, 2, ...` (insertion order within each cell). It stops only once
   * `bestDistSq < (r * cellSize)^2` (strict), which guarantees no cell at ring
   * `r + 1` can tie the incumbent on distance and win on rank, or once every
   * populated cell has been visited.
   *
   * Allocation-free: only a single incumbent is retained.
   *
   * @param {Vector3} position - Query centre.
   * @param {Function} isCandidate - Predicate selecting eligible items.
   * @param {Function} rank - Deterministic tie-break; smaller wins.
   * @returns {T | null}
   */
  queryNearest(
    position: Vector3,
    isCandidate: (item: T) => boolean,
    rank: (item: T) => number,
  ): T | null {
    let best: T | null = null;
    let bestDistSq = Infinity;
    let bestRank = Infinity;
    let remaining = this.cells.size;
    if (remaining === 0) {
      return null;
    }

    const centerX = Math.floor(position.x / this.cellSize);
    const centerY = Math.floor(position.y / this.cellSize);
    const centerZ = Math.floor(position.z / this.cellSize);
    const cellSizeSq = this.cellSize * this.cellSize;

    for (let r = 0; remaining > 0; r++) {
      for (let dx = -r; dx <= r; dx++) {
        const onXFace = dx === -r || dx === r;
        for (let dy = -r; dy <= r; dy++) {
          const onYFace = dy === -r || dy === r;
          for (let dz = -r; dz <= r; dz++) {
            // Skip interior cells: only the Chebyshev shell at distance r.
            if (r > 0 && !onXFace && !onYFace && dz !== -r && dz !== r) {
              continue;
            }
            const cell = this.cells.get(this.packCellKey(centerX + dx, centerY + dy, centerZ + dz));
            if (!cell) {
              continue;
            }
            remaining--;

            for (const item of cell) {
              if (!isCandidate(item)) {
                continue;
              }
              const pos = this.getPosition(item);
              const ox = pos.x - position.x;
              const oy = pos.y - position.y;
              const oz = pos.z - position.z;
              const distSq = ox * ox + oy * oy + oz * oz;
              if (distSq < bestDistSq || (distSq === bestDistSq && rank(item) < bestRank)) {
                best = item;
                bestDistSq = distSq;
                bestRank = rank(item);
              }
            }
          }
        }
      }

      // Strict: a cell at ring r + 1 is at least r * cellSize away, so a tie on
      // distance must still be resolved by rank and cannot be skipped.
      if (best !== null && bestDistSq < r * r * cellSizeSq) {
        return best;
      }
    }

    return best;
  }

  /**
   * Checks whether any item occludes the line segment from source to target.
   * Returns early as soon as an occluder is found.
   */
  hasOccluderOnSegment(
    source: Vector3,
    target: Vector3,
    direction: Vector3,
    maxDistance: number,
    excludeSource: T,
    excludeTarget: T,
    cosThreshold: number,
  ): boolean {
    if (maxDistance <= 1e-5) {
      return false;
    }

    const distanceSq = maxDistance * maxDistance;
    const deltaX = target.x - source.x;
    const deltaY = target.y - source.y;
    const deltaZ = target.z - source.z;
    const steps = Math.max(1, Math.ceil(maxDistance / this.cellSize));
    const invSteps = 1 / steps;

    let previousKey: number | string = '';
    for (let i = 0; i <= steps; i++) {
      const t = i * invSteps;
      const px = source.x + deltaX * t;
      const py = source.y + deltaY * t;
      const pz = source.z + deltaZ * t;

      const key = this.getCellKey(px, py, pz);
      if (key === previousKey) {
        continue;
      }
      previousKey = key;

      const cell = this.cells.get(key);
      if (!cell) continue;

      for (const item of cell) {
        if (item === excludeSource || item === excludeTarget) continue;

        const pos = this.getPosition(item);
        const obstacleX = pos.x - source.x;
        const obstacleY = pos.y - source.y;
        const obstacleZ = pos.z - source.z;
        const obstacleDistanceSq =
          obstacleX * obstacleX + obstacleY * obstacleY + obstacleZ * obstacleZ;

        if (obstacleDistanceSq <= 1e-10 || obstacleDistanceSq >= distanceSq) {
          continue;
        }

        const invObstacleDistance = 1 / Math.sqrt(obstacleDistanceSq);
        const cos =
          (obstacleX * direction.x + obstacleY * direction.y + obstacleZ * direction.z) *
          invObstacleDistance;
        if (cos > cosThreshold) {
          return true;
        }
      }
    }

    return false;
  }
}
