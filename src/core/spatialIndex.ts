import type { Vector3, EntityId, Team } from '../types/index.js';
import type { SpatialGrid, SpatialEntity } from '../utils/spatialGrid.js';

/**
 * Axis-aligned bounding box for spatial queries
 */
export interface AABB {
  min: Vector3;
  max: Vector3;
}

/**
 * Spatial query result with distance information
 */
export interface SpatialQueryResult {
  entity: SpatialEntity;
  distance: number;
  direction: Vector3; // Normalized direction from query point to entity
}

/**
 * Enhanced SpatialIndex adapter interface to decouple AI from a concrete grid.
 * Provides comprehensive spatial queries with performance optimization.
 */
export interface SpatialIndex {
  // Lifecycle
  init(config: { cellSize: number; worldAABB?: AABB }): void;
  clear(): void;
  dispose?(): void;

  // Registration and updates
  insert(entityId: EntityId, pos: Vector3, radius: number, team: Team): void;
  update(id: EntityId, pos: Vector3, radius: number, team: Team): void;
  remove(id: EntityId): void;
  gcExcept(activeIds: Set<EntityId>): void;

  // Basic queries (existing interface)
  queryRadius(center: Vector3, radius: number, out?: SpatialEntity[]): SpatialEntity[];
  forEachInRadius(
    center: Vector3,
    radius: number,
    fn: (dx: number, dy: number, dz: number, distSq: number, entity: SpatialEntity) => void,
  ): void;
  queryKNearest(center: Vector3, k: number, team?: Team, excludeId?: EntityId): SpatialEntity[];
  querySector(
    center: Vector3,
    direction: Vector3,
    angleRadians: number,
    range: number,
    team?: Team,
    excludeId?: EntityId,
  ): SpatialEntity[];
  queryNeighbors(
    center: Vector3,
    radius: number,
    team: Team,
    excludeId?: EntityId,
  ): SpatialEntity[];
  forEachNeighborsDelta(
    center: Vector3,
    radius: number,
    team: Team,
    excludeId: EntityId | undefined,
    fn: (dx: number, dy: number, dz: number, distSq: number, entity: SpatialEntity) => void,
  ): void;
  queryEnemies(center: Vector3, radius: number, team: Team): SpatialEntity[];
  queryBulletCollisions(
    bulletPos: Vector3,
    bulletRadius: number,
    maxShipRadius?: number,
  ): SpatialEntity[];

  // Enhanced queries
  queryAABB(aabb: AABB, layerMask?: number): EntityId[];
  queryRadiusWithDistance(
    center: Vector3,
    radius: number,
    layerMask?: number,
  ): SpatialQueryResult[];
  raycast(
    from: Vector3,
    to: Vector3,
    layerMask?: number,
  ): Array<{ entityId: EntityId; t: number; point: Vector3 }>;

  // Layer-based queries for performance optimization
  queryLayer(center: Vector3, radius: number, layer: number): SpatialEntity[];
  queryLayerMask(center: Vector3, radius: number, layerMask: number): SpatialEntity[];

  // Advanced spatial operations
  queryFrustum?(frustum: { planes: Array<{ normal: Vector3; distance: number }> }): EntityId[];
  queryPath?(from: Vector3, to: Vector3, width: number): SpatialEntity[];

  // Debug/metrics
  getStats(): {
    items: number;
    cells: number;
    avgItemsPerCell: number;
    queriesPerFrame?: number;
    totalMemoryUsage?: number;
  };

  // Performance optimization
  enableBatching?(enable: boolean): void;
  flushBatch?(): void;

  // Bulk query operations for performance optimization
  queryBulkNearest?(
    positions: Float32Array, // [x0, y0, z0, x1, y1, z1, ...]
    k: number,
    team?: Team,
    excludeIds?: Set<EntityId>,
    out?: Uint32Array
  ): Uint32Array;

  queryBulkRadius?(
    positions: Float32Array, // [x0, y0, z0, x1, y1, z1, ...]
    radius: number,
    team?: Team,
    excludeIds?: Set<EntityId>,
    out?: Uint32Array
  ): Uint32Array;
}

/**
 * Adapter implementation that delegates to the existing SpatialGrid.
 * Enhanced with additional query capabilities and performance tracking.
 */
export class SpatialGridAdapter implements SpatialIndex {
  private grid: SpatialGrid;
  private queryCount = 0;
  private frameQueryCount = 0;
  private lastFrameReset = 0;

  constructor(grid: SpatialGrid) {
    this.grid = grid;
  }

  init(_config: { cellSize: number; worldAABB?: AABB }): void {
    // SpatialGrid is typically already initialized, but we could extend it
    // For now, this is a no-op as the existing grid handles its own initialization
  }

  clear(): void {
    this.grid.clear();
  }

  dispose?(): void {
    // Clean up any resources if needed
    this.queryCount = 0;
    this.frameQueryCount = 0;
  }

  // Delegation to existing SpatialGrid methods
  insert(entityId: EntityId, pos: Vector3, radius: number, team: Team): void {
    this.grid.update(entityId, pos, radius, team);
  }

  update(id: EntityId, pos: Vector3, radius: number, team: Team): void {
    this.grid.update(id, pos, radius, team);
  }

  remove(id: EntityId): void {
    this.grid.remove(id);
  }

  gcExcept(activeIds: Set<EntityId>): void {
    this.grid.gcExcept(activeIds);
  }

  queryRadius(center: Vector3, radius: number, out?: SpatialEntity[]): SpatialEntity[] {
    this.trackQuery();
    return this.grid.queryRadius(center, radius, out);
  }

  forEachInRadius(
    center: Vector3,
    radius: number,
    fn: (dx: number, dy: number, dz: number, distSq: number, entity: SpatialEntity) => void,
  ): void {
    this.trackQuery();
    this.grid.forEachInRadius(center, radius, fn);
  }

  queryKNearest(center: Vector3, k: number, team?: Team, excludeId?: EntityId): SpatialEntity[] {
    this.trackQuery();
    return this.grid.queryKNearest(center, k, team, excludeId);
  }

  querySector(
    center: Vector3,
    direction: Vector3,
    angleRadians: number,
    range: number,
    team?: Team,
    excludeId?: EntityId,
  ): SpatialEntity[] {
    this.trackQuery();
    return this.grid.querySector(center, direction, angleRadians, range, team, excludeId);
  }

  queryNeighbors(
    center: Vector3,
    radius: number,
    team: Team,
    excludeId?: EntityId,
  ): SpatialEntity[] {
    this.trackQuery();
    return this.grid.queryNeighbors(center, radius, team, excludeId);
  }

  forEachNeighborsDelta(
    center: Vector3,
    radius: number,
    team: Team,
    excludeId: EntityId | undefined,
    fn: (dx: number, dy: number, dz: number, distSq: number, entity: SpatialEntity) => void,
  ): void {
    this.trackQuery();
    this.grid.forEachNeighborsDelta(center, radius, team, excludeId, fn);
  }

  queryEnemies(center: Vector3, radius: number, team: Team): SpatialEntity[] {
    this.trackQuery();
    return this.grid.queryEnemies(center, radius, team);
  }

  queryBulletCollisions(
    bulletPos: Vector3,
    bulletRadius: number,
    maxShipRadius?: number,
  ): SpatialEntity[] {
    this.trackQuery();
    return this.grid.queryBulletCollisions(bulletPos, bulletRadius, maxShipRadius);
  }

  // Enhanced query implementations
  queryAABB(aabb: AABB, layerMask?: number): EntityId[] {
    this.trackQuery();
    const results: EntityId[] = [];

    // Calculate search radius as half the diagonal of the AABB
    const center = {
      x: (aabb.min.x + aabb.max.x) / 2,
      y: (aabb.min.y + aabb.max.y) / 2,
      z: (aabb.min.z + aabb.max.z) / 2,
    };

    // Use diagonal distance to ensure we capture all possible entities
    const dx = aabb.max.x - aabb.min.x;
    const dy = aabb.max.y - aabb.min.y;
    const dz = aabb.max.z - aabb.min.z;
    // Avoid sqrt: compare squared distances. We still need a radius value for the grid query,
    // so compute squared diagonal and then take sqrt once to produce a radius (infrequent).
    const diagSq = dx * dx + dy * dy + dz * dz;
    const sqrt = Math.sqrt;
    const searchRadius = sqrt(diagSq) / 2 + 50; // infrequent; keep sqrt here

    const buf = this.grid.getPooledResults();
    try {
      this.grid.queryRadius(center, searchRadius, buf);
      for (const entity of buf) {
        // Test if entity's position (considering its radius) intersects with AABB
        const entityMin = {
          x: entity.pos.x - entity.radius,
          y: entity.pos.y - entity.radius,
          z: entity.pos.z - entity.radius,
        };
        const entityMax = {
          x: entity.pos.x + entity.radius,
          y: entity.pos.y + entity.radius,
          z: entity.pos.z + entity.radius,
        };

        // Check AABB vs AABB intersection
        if (
          entityMax.x >= aabb.min.x &&
          entityMin.x <= aabb.max.x &&
          entityMax.y >= aabb.min.y &&
          entityMin.y <= aabb.max.y &&
          entityMax.z >= aabb.min.z &&
          entityMin.z <= aabb.max.z
        ) {
          // Apply layer mask if provided
          if (layerMask === undefined || (1 << (entity.team === 'red' ? 0 : 1)) & layerMask) {
            results.push(entity.id);
          }
        }
      }
      return results;
    } finally {
      this.grid.releasePooledResults(buf);
    }
  }

  queryRadiusWithDistance(
    center: Vector3,
    radius: number,
    layerMask?: number,
  ): SpatialQueryResult[] {
    this.trackQuery();
    const results: SpatialQueryResult[] = [];
    const buf = this.grid.getPooledResults();
    try {
      this.grid.queryRadius(center, radius, buf);

      for (const entity of buf) {
        // Apply layer mask if provided
        if (layerMask !== undefined && !((1 << (entity.team === 'red' ? 0 : 1)) & layerMask)) {
          continue;
        }

        const dx = entity.pos.x - center.x;
        const dy = entity.pos.y - center.y;
        const dz = entity.pos.z - center.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq <= radius * radius) {
          // We need a true distance and normalized direction for the result. Compute sqrt here.
          const sqrt = Math.sqrt;
          const distance = sqrt(distSq);
          const direction =
            distance > 0
              ? { x: dx / distance, y: dy / distance, z: dz / distance }
              : { x: 0, y: 0, z: 0 };

          results.push({ entity, distance, direction });
        }
      }

      return results.sort((a, b) => a.distance - b.distance);
    } finally {
      this.grid.releasePooledResults(buf);
    }
  }

  raycast(
    from: Vector3,
    to: Vector3,
    layerMask?: number,
  ): Array<{ entityId: EntityId; t: number; point: Vector3 }> {
    this.trackQuery();
    const results: Array<{ entityId: EntityId; t: number; point: Vector3 }> = [];

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const rayLengthSq = dx * dx + dy * dy + dz * dz;
    if (rayLengthSq === 0) return results;
    // We need the ray length and normalized direction for intersection math. Compute once.
    const sqrt = Math.sqrt;
    const rayLength = sqrt(rayLengthSq);
    const dirX = dx / rayLength;
    const dirY = dy / rayLength;
    const dirZ = dz / rayLength;

    // Query entities along the ray path with some padding
    const center = {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2,
      z: (from.z + to.z) / 2,
    };
    const queryRadius = rayLength / 2 + 50; // Add padding for entity radii

    const buf2 = this.grid.getPooledResults();
    try {
      this.grid.queryRadius(center, queryRadius, buf2);

      for (const entity of buf2) {
        // Apply layer mask if provided
        if (layerMask !== undefined && !((1 << (entity.team === 'red' ? 0 : 1)) & layerMask)) {
          continue;
        }

        // Simple sphere-ray intersection using normalized ray direction
        const sphereX = entity.pos.x - from.x;
        const sphereY = entity.pos.y - from.y;
        const sphereZ = entity.pos.z - from.z;

        const dot = sphereX * dirX + sphereY * dirY + sphereZ * dirZ;
        if (dot < 0 || dot > rayLength) continue; // Behind ray or beyond end

        const closestX = from.x + dirX * dot;
        const closestY = from.y + dirY * dot;
        const closestZ = from.z + dirZ * dot;

        const distX = entity.pos.x - closestX;
        const distY = entity.pos.y - closestY;
        const distZ = entity.pos.z - closestZ;
        const distSq = distX * distX + distY * distY + distZ * distZ;

        if (distSq <= entity.radius * entity.radius) {
          const t = dot / rayLength;
          results.push({
            entityId: entity.id,
            t,
            point: { x: closestX, y: closestY, z: closestZ },
          });
        }
      }

      return results.sort((a, b) => a.t - b.t);
    } finally {
      this.grid.releasePooledResults(buf2);
    }
  }

  queryLayer(center: Vector3, radius: number, layer: number): SpatialEntity[] {
    this.trackQuery();
    const buf3 = this.grid.getPooledResults();
    try {
      this.grid.queryRadius(center, radius, buf3);
      const teamLayer = layer === 0 ? 'red' : 'blue';
      return buf3.filter((e) => e.team === teamLayer);
    } finally {
      this.grid.releasePooledResults(buf3);
    }
  }

  queryLayerMask(center: Vector3, radius: number, layerMask: number): SpatialEntity[] {
    this.trackQuery();
    const buf4 = this.grid.getPooledResults();
    try {
      this.grid.queryRadius(center, radius, buf4);
      return buf4.filter((e) => {
        const entityLayer = e.team === 'red' ? 0 : 1;
        return (1 << entityLayer) & layerMask;
      });
    } finally {
      this.grid.releasePooledResults(buf4);
    }
  }

  // Bulk query operations for performance optimization
  queryBulkNearest(
    positions: Float32Array,
    k: number,
    team?: Team,
    excludeIds?: Set<EntityId>,
    out?: Uint32Array
  ): Uint32Array {
    this.trackQuery();
    
    const positionCount = Math.floor(positions.length / 3);
    if (positionCount === 0) {
      return out || new Uint32Array(0);
    }

    // Allocate output array if not provided
    const maxResults = positionCount * k;
    const result = out && out.length >= maxResults ? out : new Uint32Array(maxResults);
    let writeIndex = 0;

    const buf = this.grid.getPooledResults();
    try {
      for (let i = 0; i < positionCount; i++) {
        const baseIdx = i * 3;
        const center = {
          x: positions[baseIdx],
          y: positions[baseIdx + 1],
          z: positions[baseIdx + 2],
        };

        // Query k nearest for this position
        const entities = this.grid.queryKNearest(center, k, team);
        
        // Filter out excluded entities and pack results
        let addedCount = 0;
        for (const entity of entities) {
          if (excludeIds && excludeIds.has(entity.id)) continue;
          if (writeIndex < result.length) {
            result[writeIndex++] = entity.id;
            addedCount++;
          }
          if (addedCount >= k) break;
        }
        
        // Pad with 0s if we didn't find k entities for this position
        while (addedCount < k && writeIndex < result.length) {
          result[writeIndex++] = 0;
          addedCount++;
        }
      }

      // If using a provided buffer, it might be larger than needed
      return writeIndex === result.length ? result : result.subarray(0, writeIndex);
    } finally {
      this.grid.releasePooledResults(buf);
    }
  }

  queryBulkRadius(
    positions: Float32Array,
    radius: number,
    team?: Team,
    excludeIds?: Set<EntityId>,
    out?: Uint32Array,
  ): Uint32Array {
    this.trackQuery();
    const positionCount = Math.floor(positions.length / 3);
    if (positionCount === 0) {
      return out || new Uint32Array(0);
    }

    // Produce a flat ids array concatenating results for each input position.
    const idsTemp: number[] = [];

    const buf = this.grid.getPooledResults();
    try {
      for (let i = 0; i < positionCount; i++) {
        const baseIdx = i * 3;
        const center = {
          x: positions[baseIdx],
          y: positions[baseIdx + 1],
          z: positions[baseIdx + 2],
        };

        // Clear and reuse the pooled buffer
        buf.length = 0;
        this.grid.queryRadius(center, radius, buf);

        // Filter and collect results for this query
        for (const entity of buf) {
          if (team && entity.team !== team) continue;
          if (excludeIds && excludeIds.has(entity.id)) continue;
          idsTemp.push(entity.id);
        }
      }

      const ids = out && out.length >= idsTemp.length ? out : new Uint32Array(idsTemp.length);
      for (let i = 0; i < idsTemp.length; i++) ids[i] = idsTemp[i];
      return idsTemp.length === ids.length ? ids : ids.subarray(0, idsTemp.length);
    } finally {
      this.grid.releasePooledResults(buf);
    }
  }

  getStats() {
    const currentTime = performance.now();
    if (currentTime - this.lastFrameReset > 1000) {
      // Reset every second
      this.frameQueryCount = 0;
      this.lastFrameReset = currentTime;
    }

    // Mock implementation since SpatialGrid doesn't expose internal stats
    const itemCount = 100; // Would need to be exposed by SpatialGrid
    const cellCount = 64; // Would need to be exposed by SpatialGrid

    return {
      items: itemCount,
      cells: cellCount,
      avgItemsPerCell: itemCount / cellCount,
      queriesPerFrame: this.frameQueryCount,
      totalMemoryUsage: itemCount * 64, // Rough estimate
    };
  }

  private trackQuery(): void {
    this.queryCount++;
    this.frameQueryCount++;
  }
}

/**
 * No-op spatial index for testing
 */
export class NoopSpatialIndex implements SpatialIndex {
  init(_config: { cellSize: number; worldAABB?: AABB }): void {}
  clear(): void {}
  dispose?(): void {}

  insert(_entityId: EntityId, _pos: Vector3, _radius: number, _team: Team): void {}
  update(_id: EntityId, _pos: Vector3, _radius: number, _team: Team): void {}
  remove(_id: EntityId): void {}
  gcExcept(_activeIds: Set<EntityId>): void {}

  queryRadius(_center: Vector3, _radius: number, _out?: SpatialEntity[]): SpatialEntity[] {
    return [];
  }
  forEachInRadius(
    _center: Vector3,
    _radius: number,
    _fn: (dx: number, dy: number, dz: number, distSq: number, entity: SpatialEntity) => void,
  ): void {}
  queryKNearest(
    _center: Vector3,
    _k: number,
    _team?: Team,
    _excludeId?: EntityId,
  ): SpatialEntity[] {
    return [];
  }
  querySector(
    _center: Vector3,
    _direction: Vector3,
    _angleRadians: number,
    _range: number,
    _team?: Team,
    _excludeId?: EntityId,
  ): SpatialEntity[] {
    return [];
  }
  queryNeighbors(
    _center: Vector3,
    _radius: number,
    _team: Team,
    _excludeId?: EntityId,
  ): SpatialEntity[] {
    return [];
  }
  forEachNeighborsDelta(
    _center: Vector3,
    _radius: number,
    _team: Team,
    _excludeId: EntityId | undefined,
    _fn: (dx: number, dy: number, dz: number, distSq: number, entity: SpatialEntity) => void,
  ): void {}
  queryEnemies(_center: Vector3, _radius: number, _team: Team): SpatialEntity[] {
    return [];
  }
  queryBulletCollisions(
    _bulletPos: Vector3,
    _bulletRadius: number,
    _maxShipRadius?: number,
  ): SpatialEntity[] {
    return [];
  }

  queryAABB(_aabb: AABB, _layerMask?: number): EntityId[] {
    return [];
  }
  queryRadiusWithDistance(
    _center: Vector3,
    _radius: number,
    _layerMask?: number,
  ): SpatialQueryResult[] {
    return [];
  }
  raycast(
    _from: Vector3,
    _to: Vector3,
    _layerMask?: number,
  ): Array<{ entityId: EntityId; t: number; point: Vector3 }> {
    return [];
  }
  queryLayer(_center: Vector3, _radius: number, _layer: number): SpatialEntity[] {
    return [];
  }
  queryLayerMask(_center: Vector3, _radius: number, _layerMask: number): SpatialEntity[] {
    return [];
  }

  getStats() {
    return { items: 0, cells: 0, avgItemsPerCell: 0 };
  }
}
