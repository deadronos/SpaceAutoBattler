import type { Vector3, EntityId, Team } from '../types/index.js';

export interface SpatialEntity {
  id: EntityId;
  pos: Vector3;
  radius: number;
  team: Team;
}

/**
 * Uniform grid spatial partitioning for efficient proximity queries.
 * Optimizes AI neighbor searches and targeting from O(n) to O(1) average case.
 */
export class SpatialGrid {
  private cellSize: number;
  private grid: Map<string, SpatialEntity[]> = new Map();
  private bounds: { width: number; height: number; depth: number };

  constructor(cellSize: number = 64, bounds = { width: 1920, height: 1080, depth: 600 }) {
    this.cellSize = cellSize;
    this.bounds = bounds;
  }

  /**
   * Clear all entities from the grid
   */
  clear() {
    this.grid.clear();
  }

  /**
   * Get cell key for position coordinates
   */
  private getCellKey(x: number, y: number, z: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    const cellZ = Math.floor(z / this.cellSize);
    return `${cellX},${cellY},${cellZ}`;
  }

  /**
   * Insert an entity into the spatial grid
   */
  insert(entity: SpatialEntity) {
    const key = this.getCellKey(entity.pos.x, entity.pos.y, entity.pos.z);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(entity);
  }

  /**
   * Query entities within a radius around a center point
   */
  queryRadius(center: Vector3, radius: number): SpatialEntity[] {
    const results: SpatialEntity[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCellX = Math.floor(center.x / this.cellSize);
    const centerCellY = Math.floor(center.y / this.cellSize);
    const centerCellZ = Math.floor(center.z / this.cellSize);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
          const key = `${centerCellX + dx},${centerCellY + dy},${centerCellZ + dz}`;
          const entities = this.grid.get(key);
          if (entities) {
            // Filter by actual distance within radius
            for (const entity of entities) {
              const distSq = 
                (entity.pos.x - center.x) ** 2 +
                (entity.pos.y - center.y) ** 2 +
                (entity.pos.z - center.z) ** 2;
              if (distSq <= radius * radius) {
                results.push(entity);
              }
            }
          }
        }
      }
    }
    return results;
  }

  /**
   * Query k nearest entities to a center point
   */
  queryKNearest(center: Vector3, k: number, team?: Team, excludeId?: EntityId): SpatialEntity[] {
    // Start with a small radius and expand until we have enough entities
    let radius = this.cellSize;
    let candidates: SpatialEntity[] = [];
    
    while (candidates.length < k * 2 && radius < Math.max(this.bounds.width, this.bounds.height, this.bounds.depth)) {
      candidates = this.queryRadius(center, radius);
      
      // Filter by team and exclude id if specified
      if (team !== undefined || excludeId !== undefined) {
        candidates = candidates.filter(entity => {
          if (team !== undefined && entity.team !== team) return false;
          if (excludeId !== undefined && entity.id === excludeId) return false;
          return true;
        });
      }
      
      if (candidates.length < k) {
        radius *= 2; // Expand search radius
      }
    }

    // Sort by distance and return k nearest
    candidates.sort((a, b) => {
      const distA = 
        (a.pos.x - center.x) ** 2 +
        (a.pos.y - center.y) ** 2 +
        (a.pos.z - center.z) ** 2;
      const distB = 
        (b.pos.x - center.x) ** 2 +
        (b.pos.y - center.y) ** 2 +
        (b.pos.z - center.z) ** 2;
      return distA - distB;
    });

    return candidates.slice(0, k);
  }

  /**
   * Query entities within a sector (cone) from a position
   */
  querySector(center: Vector3, direction: Vector3, angleRadians: number, range: number, team?: Team, excludeId?: EntityId): SpatialEntity[] {
    // First get entities within the radius
    const candidates = this.queryRadius(center, range);
    
    // Filter by team and exclude id if specified
    let filtered = candidates;
    if (team !== undefined || excludeId !== undefined) {
      filtered = candidates.filter(entity => {
        if (team !== undefined && entity.team !== team) return false;
        if (excludeId !== undefined && entity.id === excludeId) return false;
        return true;
      });
    }
    
    // Normalize direction vector
    const dirMag = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
    if (dirMag === 0) return [];
    
    const dirX = direction.x / dirMag;
    const dirY = direction.y / dirMag;
    const dirZ = direction.z / dirMag;
    
    const cosHalfAngle = Math.cos(angleRadians / 2);
    
    // Filter by angle
    return filtered.filter(entity => {
      // Vector from center to entity
      const toEntityX = entity.pos.x - center.x;
      const toEntityY = entity.pos.y - center.y;
      const toEntityZ = entity.pos.z - center.z;
      
      const toEntityMag = Math.sqrt(toEntityX ** 2 + toEntityY ** 2 + toEntityZ ** 2);
      if (toEntityMag === 0) return false;
      
      // Normalized vector to entity
      const toEntityNormX = toEntityX / toEntityMag;
      const toEntityNormY = toEntityY / toEntityMag;
      const toEntityNormZ = toEntityZ / toEntityMag;
      
      // Dot product with direction
      const dotProduct = dirX * toEntityNormX + dirY * toEntityNormY + dirZ * toEntityNormZ;
      
      // Check if within cone angle
      return dotProduct >= cosHalfAngle;
    });
  }

  /**
   * Query neighbors (same team) within radius
   */
  queryNeighbors(center: Vector3, radius: number, team: Team, excludeId?: EntityId): SpatialEntity[] {
    const entities = this.queryRadius(center, radius);
    return entities.filter(entity => {
      if (entity.team !== team) return false;
      if (excludeId !== undefined && entity.id === excludeId) return false;
      return true;
    });
  }

  /**
   * Query enemies (different team) within radius
   */
  queryEnemies(center: Vector3, radius: number, team: Team): SpatialEntity[] {
    const entities = this.queryRadius(center, radius);
    return entities.filter(entity => entity.team !== team);
  }

  /**
   * Optimized query for bullet-ship collisions
   */
  queryBulletCollisions(bulletPos: Vector3, bulletRadius: number, maxShipRadius: number = 20): SpatialEntity[] {
    return this.queryRadius(bulletPos, bulletRadius + maxShipRadius);
  }

  /**
   * Get statistics about the spatial grid (useful for debugging/tuning)
   */
  getStats(): { totalCells: number; occupiedCells: number; totalEntities: number; avgEntitiesPerCell: number } {
    const totalCells = this.grid.size;
    let totalEntities = 0;
    
    for (const entities of this.grid.values()) {
      totalEntities += entities.length;
    }
    
    return {
      totalCells,
      occupiedCells: totalCells,
      totalEntities,
      avgEntitiesPerCell: totalCells > 0 ? totalEntities / totalCells : 0
    };
  }
}