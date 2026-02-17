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
   * Queries potential occluders between source and target.
   * Only checks cells along the line between source and target.
   */
  queryLineSegment(
    source: Vector3,
    target: Vector3,
    excludeSource: ShipEntity,
    excludeTarget: ShipEntity,
  ): ShipEntity[] {
    const results: ShipEntity[] = [];
    const seen = new Set<ShipEntity>();

    // Walk along the line segment and check cells
    const direction = new Vector3().subVectors(target, source);
    const distance = direction.length();
    direction.normalize();

    // Sample points along the line
    const steps = Math.ceil(distance / this.cellSize) + 1;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * distance;
      const px = source.x + direction.x * t;
      const py = source.y + direction.y * t;
      const pz = source.z + direction.z * t;

      const key = this.getCellKey(px, py, pz);
      const cell = this.cells.get(key);
      if (!cell) continue;

      for (const ship of cell) {
        if (ship === excludeSource || ship === excludeTarget) continue;
        if (seen.has(ship)) continue;
        seen.add(ship);
        results.push(ship);
      }
    }

    return results;
  }
}
