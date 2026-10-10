import { Vector3 } from 'three';

export type SpatialGridItemPosition<T> = (item: T) => Vector3;

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
  private cells: Map<string, T[]>;
  private getPosition: SpatialGridItemPosition<T>;

  constructor(cellSize: number, getPosition: SpatialGridItemPosition<T>) {
    this.cellSize = cellSize;
    this.cells = new Map();
    this.getPosition = getPosition;
  }

  /**
   * Converts a world position to a cell key.
   */
  private getCellKey(x: number, y: number, z: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx},${cy},${cz}`;
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
          const key = `${centerX + dx},${centerY + dy},${centerZ + dz}`;
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

    let previousKey = '';
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
