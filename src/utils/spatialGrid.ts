import { Vector3 } from 'three';
import type { ShipEntity } from '../types/index.js';

/**
 * Simple spatial grid for broad-phase culling.
 * Divides 3D space into cells to quickly find nearby entities.
 */
export class SpatialGrid {
  private cellSize: number;
  private cells: Map<string, ShipEntity[]>;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.cells = new Map();
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
   * Inserts a ship into the grid.
   */
  insert(ship: ShipEntity): void {
    const pos = ship.transform.position;
    const key = this.getCellKey(pos.x, pos.y, pos.z);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(ship);
  }

  /**
   * Queries ships within a radius of a position.
   * Returns ships in the same cell and adjacent cells.
   */
  query(position: Vector3, radius: number): ShipEntity[] {
    const results: ShipEntity[] = [];
    const radiusSq = radius * radius;

    // Determine which cells to check based on radius
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

          for (const ship of cell) {
            const distSq = position.distanceToSquared(ship.transform.position);
            if (distSq <= radiusSq) {
              results.push(ship);
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Checks whether any ship occludes the line segment from source to target.
   * Returns early as soon as an occluder is found.
   */
  hasOccluderOnSegment(
    source: Vector3,
    target: Vector3,
    direction: Vector3,
    maxDistance: number,
    excludeSource: ShipEntity,
    excludeTarget: ShipEntity,
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

      for (const ship of cell) {
        if (ship === excludeSource || ship === excludeTarget) continue;

        const obstacleX = ship.transform.position.x - source.x;
        const obstacleY = ship.transform.position.y - source.y;
        const obstacleZ = ship.transform.position.z - source.z;
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
