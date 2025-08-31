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
  private grid: Map<number, SpatialEntity[]> = new Map();
  // Fast lookup of an entity's current cell and reference for incremental updates
  private entityById: Map<EntityId, { key: number; entity: SpatialEntity } > = new Map();
  private bounds: { width: number; height: number; depth: number };
  private nx: number; // cells along x
  private ny: number; // cells along y
  private nz: number; // cells along z
  private version = 0; // increments on any mutation
  private lastRadiusCache: {
    cx: number; cy: number; cz: number; cellRadius: number; version: number; cellKeys: number[]
  } | null = null;
  // Reusable scratch array to reduce allocations when building occupied cell lists
  private _occupiedKeysScratch: number[] = [];
  // Simple pool for result arrays to avoid allocating on every queryRadius call.
  // Callers can either provide their own `out` array to `queryRadius`, or
  // explicitly request a pooled array via `getPooledResults()` and return it
  // to the pool with `releasePooledResults()` when finished.
  private _resultPool: SpatialEntity[][] = [];

  constructor(cellSize: number = 64, bounds = { width: 1920, height: 1080, depth: 600 }) {
    this.cellSize = cellSize;
    this.bounds = bounds;
    this.nx = Math.max(1, Math.ceil(bounds.width / cellSize));
    this.ny = Math.max(1, Math.ceil(bounds.height / cellSize));
    this.nz = Math.max(1, Math.ceil(bounds.depth / cellSize));
  }

  /**
   * Clear all entities from the grid
   */
  clear() {
    this.grid.clear();
    this.entityById.clear();
    this.version++;
    this.lastRadiusCache = null;
  }

  /**
   * Get cell key for position coordinates
   */
  private getCellKey(x: number, y: number, z: number): number {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    const cellZ = Math.floor(z / this.cellSize);
    return this.linearIndex(cellX, cellY, cellZ);
  }

  private linearIndex(cx: number, cy: number, cz: number): number {
    // Clamp to bounds to avoid out-of-range indices from precision issues
    const x = cx < 0 ? 0 : (cx >= this.nx ? this.nx - 1 : cx);
    const y = cy < 0 ? 0 : (cy >= this.ny ? this.ny - 1 : cy);
    const z = cz < 0 ? 0 : (cz >= this.nz ? this.nz - 1 : cz);
    return ((x * this.ny) + y) * this.nz + z;
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
    // Track entity by id for incremental updates (if duplicate id inserted, last wins)
    this.entityById.set(entity.id, { key, entity });
    this.version++;
    this.lastRadiusCache = null;
  }

  /**
   * Incrementally add or update an entity's position/team/radius in the grid.
   * Uses the id to move the entity between cells without clearing the grid.
   */
  update(id: EntityId, pos: Vector3, radius: number, team: Team) {
    const newKey = this.getCellKey(pos.x, pos.y, pos.z);
    const rec = this.entityById.get(id);
    if (!rec) {
      // New entity
      const entity: SpatialEntity = { id, pos, radius, team };
      if (!this.grid.has(newKey)) this.grid.set(newKey, []);
      this.grid.get(newKey)!.push(entity);
      this.entityById.set(id, { key: newKey, entity });
      this.version++;
      this.lastRadiusCache = null;
      return;
    }
    // Existing entity: update in place, moving cells if needed
    if (rec.key !== newKey) {
      // Remove from old cell array
      const oldArr = this.grid.get(rec.key);
      if (oldArr) {
        const idx = oldArr.findIndex(e => e.id === id);
        if (idx !== -1) {
          oldArr.splice(idx, 1);
          if (oldArr.length === 0) this.grid.delete(rec.key);
        }
      }
      // Add to new cell
      if (!this.grid.has(newKey)) this.grid.set(newKey, []);
      this.grid.get(newKey)!.push(rec.entity);
      rec.key = newKey;
      this.version++;
      this.lastRadiusCache = null;
    }
    // Update reference fields (keep pos by reference to avoid extra allocs)
    rec.entity.pos = pos;
    rec.entity.radius = radius;
    rec.entity.team = team;
  }

  /** Remove an entity from the grid by id (no-op if missing) */
  remove(id: EntityId) {
    const rec = this.entityById.get(id);
    if (!rec) return;
    const arr = this.grid.get(rec.key);
    if (arr) {
      const idx = arr.findIndex(e => e.id === id);
      if (idx !== -1) {
        arr.splice(idx, 1);
        if (arr.length === 0) this.grid.delete(rec.key);
      }
    }
    this.entityById.delete(id);
    this.version++;
    this.lastRadiusCache = null;
  }

  /**
   * Garbage-collect entities that are not present in the provided active id set.
   * Useful to purge dead/removed entities without a full clear.
   */
  gcExcept(activeIds: Set<EntityId>) {
    // Collect ids to remove first to avoid iterator invalidation
    const toRemove: EntityId[] = [];
    for (const id of this.entityById.keys()) {
      if (!activeIds.has(id)) toRemove.push(id);
    }
    for (const id of toRemove) this.remove(id);
  }

  /**
   * Rebuild the grid from a list of entities. Clears internal state.
   */
  rebuild(entities: SpatialEntity[]) {
    this.clear();
    for (const e of entities) this.insert(e);
  }

  /**
   * Query entities within a radius around a center point
   */
  queryRadius(center: Vector3, radius: number, out?: SpatialEntity[]): SpatialEntity[] {
    // If caller provided an output array, use it. Otherwise create a new
    // array (backwards-compatible). Callers who want pooling can call
    // getPooledResults() and pass that in as `out`, then return it via
    // releasePooledResults(arr) when done.
    const results: SpatialEntity[] = out ?? [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCellX = Math.floor(center.x / this.cellSize);
    const centerCellY = Math.floor(center.y / this.cellSize);
    const centerCellZ = Math.floor(center.z / this.cellSize);
    const cellSize = this.cellSize;
    const radiusSq = radius * radius;
    const grid = this.grid;

    // Use cached occupied cell keys for this center cell and radius if grid hasn't changed
    let occupiedKeys: number[] | null = null;
    const lrc = this.lastRadiusCache;
    if (
      lrc && lrc.version === this.version &&
      lrc.cx === centerCellX && lrc.cy === centerCellY && lrc.cz === centerCellZ &&
      lrc.cellRadius === cellRadius
    ) {
      occupiedKeys = lrc.cellKeys;
    }

    if (!occupiedKeys) {
      // Build list of occupied cell keys intersecting the sphere (use scratch to reduce allocs)
      const scratch = this._occupiedKeysScratch;
      scratch.length = 0;
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const cellX = centerCellX + dx;
        const minX = cellX * cellSize;
        const maxX = minX + cellSize;
        const distX = center.x < minX ? (minX - center.x) : (center.x > maxX ? (center.x - maxX) : 0);
        const distXSq = distX * distX;

        for (let dy = -cellRadius; dy <= cellRadius; dy++) {
          const cellY = centerCellY + dy;
          const minY = cellY * cellSize;
          const maxY = minY + cellSize;
          const distY = center.y < minY ? (minY - center.y) : (center.y > maxY ? (center.y - maxY) : 0);
          const distYSq = distY * distY;
          if (distXSq + distYSq > radiusSq) continue;

          for (let dz = -cellRadius; dz <= cellRadius; dz++) {
            const cellZ = centerCellZ + dz;
            const minZ = cellZ * cellSize;
            const maxZ = minZ + cellSize;
            const distZ = center.z < minZ ? (minZ - center.z) : (center.z > maxZ ? (center.z - maxZ) : 0);
            const minDistSq = distXSq + distYSq + distZ * distZ;
            if (minDistSq > radiusSq) continue;

            const key = this.linearIndex(cellX, cellY, cellZ);
            const bucket = grid.get(key);
            if (bucket && bucket.length > 0) scratch.push(key);
          }
        }
      }
      // Copy scratch to cache so later modifications to scratch don't mutate cache
      const keysCopy = scratch.slice();
      this.lastRadiusCache = { cx: centerCellX, cy: centerCellY, cz: centerCellZ, cellRadius, version: this.version, cellKeys: keysCopy };
      occupiedKeys = keysCopy;
    }

    // Iterate only occupied cells (use locals for speed)
    for (let i = 0; i < occupiedKeys.length; i++) {
      const bucket = grid.get(occupiedKeys[i]);
      if (!bucket) continue; // may have been emptied since cache creation
      for (let j = 0; j < bucket.length; j++) {
        const entity = bucket[j];
        const dxp = entity.pos.x - center.x;
        const dyp = entity.pos.y - center.y;
        const dzp = entity.pos.z - center.z;
        const distSq = dxp * dxp + dyp * dyp + dzp * dzp;
        if (distSq <= radiusSq) results.push(entity);
      }
    }
    return results;
  }

  /**
   * Streaming radius iteration: avoids allocating result arrays entirely by
   * invoking `fn` for each found entity. The callback receives dx,dy,dz and
   * distSq (squared distance) alongside the entity so callers can compute
   * sqrt only when necessary.
   */
  forEachInRadius(
    center: Vector3,
    radius: number,
    fn: (dx: number, dy: number, dz: number, distSq: number, entity: SpatialEntity) => void
  ): void {
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCellX = Math.floor(center.x / this.cellSize);
    const centerCellY = Math.floor(center.y / this.cellSize);
    const centerCellZ = Math.floor(center.z / this.cellSize);
    const cellSize = this.cellSize;
    const radiusSq = radius * radius;
    const grid = this.grid;

    let occupiedKeys: number[] | null = null;
    const lrc = this.lastRadiusCache;
    if (
      lrc && lrc.version === this.version && lrc.cx === centerCellX && lrc.cy === centerCellY && lrc.cz === centerCellZ && lrc.cellRadius === cellRadius
    ) {
      occupiedKeys = lrc.cellKeys;
    }

    if (!occupiedKeys) {
      const scratch = this._occupiedKeysScratch;
      scratch.length = 0;
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const cellX = centerCellX + dx;
        const minX = cellX * cellSize;
        const maxX = minX + cellSize;
        const distX = center.x < minX ? (minX - center.x) : (center.x > maxX ? (center.x - maxX) : 0);
        const distXSq = distX * distX;

        for (let dy = -cellRadius; dy <= cellRadius; dy++) {
          const cellY = centerCellY + dy;
          const minY = cellY * cellSize;
          const maxY = minY + cellSize;
          const distY = center.y < minY ? (minY - center.y) : (center.y > maxY ? (center.y - maxY) : 0);
          const distYSq = distY * distY;
          if (distXSq + distYSq > radiusSq) continue;

          for (let dz = -cellRadius; dz <= cellRadius; dz++) {
            const cellZ = centerCellZ + dz;
            const minZ = cellZ * cellSize;
            const maxZ = minZ + cellSize;
            const distZ = center.z < minZ ? (minZ - center.z) : (center.z > maxZ ? (center.z - maxZ) : 0);
            const minDistSq = distXSq + distYSq + distZ * distZ;
            if (minDistSq > radiusSq) continue;

            const key = this.linearIndex(cellX, cellY, cellZ);
            const bucket = grid.get(key);
            if (bucket && bucket.length > 0) scratch.push(key);
          }
        }
      }
      const keysCopy = scratch.slice();
      this.lastRadiusCache = { cx: centerCellX, cy: centerCellY, cz: centerCellZ, cellRadius, version: this.version, cellKeys: keysCopy };
      occupiedKeys = keysCopy;
    }

    for (let i = 0; i < occupiedKeys.length; i++) {
      const bucket = grid.get(occupiedKeys[i]);
      if (!bucket) continue;
      for (let j = 0; j < bucket.length; j++) {
        const entity = bucket[j];
        const dxp = entity.pos.x - center.x;
        const dyp = entity.pos.y - center.y;
        const dzp = entity.pos.z - center.z;
        const distSq = dxp * dxp + dyp * dyp + dzp * dzp;
        if (distSq <= radiusSq) fn(dxp, dyp, dzp, distSq, entity);
      }
    }
  }

  /**
   * Acquire a pooled result array. Callers must call `releasePooledResults(arr)`
   * when finished to return the array to the pool.
   */
  getPooledResults(): SpatialEntity[] {
    const a = this._resultPool.pop();
    return a ?? [];
  }

  /**
   * Return an array previously acquired from `getPooledResults()` back to the pool.
   */
  releasePooledResults(arr: SpatialEntity[]) {
    arr.length = 0;
    this._resultPool.push(arr);
  }

  /**
   * Query k nearest entities to a center point
   */
  queryKNearest(center: Vector3, k: number, team?: Team, excludeId?: EntityId): SpatialEntity[] {
    // Start with a small radius and expand until we have enough candidates
    let radius = this.cellSize;
    const filtered = this.getPooledResults();

    const maxDimension = Math.max(this.bounds.width, this.bounds.height, this.bounds.depth);
    while (filtered.length < k * 2 && radius < maxDimension) {
      // Use pooled array for temporary batch
      const batch = this.getPooledResults();
      this.queryRadius(center, radius, batch);
      
      for (const entity of batch) {
        if (team !== undefined && entity.team !== team) continue;
        if (excludeId !== undefined && entity.id === excludeId) continue;
        filtered.push(entity);
      }
      
      this.releasePooledResults(batch);
      
      if (filtered.length < k) {
        radius *= 2; // Expand search radius
      }
    }

    if (filtered.length === 0) {
      this.releasePooledResults(filtered);
      return [];
    }

    // Maintain a bounded list of k nearest without sorting the entire set
    type Candidate = { e: SpatialEntity; d2: number };
    const best: Candidate[] = [];

    let maxIdx = -1;
    let maxD2 = -1;
    for (let i = 0; i < filtered.length; i++) {
      const e = filtered[i];
      const dx = e.pos.x - center.x;
      const dy = e.pos.y - center.y;
      const dz = e.pos.z - center.z;
      const d2 = dx * dx + dy * dy + dz * dz;

      if (best.length < k) {
        best.push({ e, d2 });
        if (d2 > maxD2) { maxD2 = d2; maxIdx = best.length - 1; }
      } else if (d2 < maxD2) {
        // Replace current worst
        best[maxIdx] = { e, d2 };
        // Recompute worst among best
        maxD2 = -1; maxIdx = 0;
        for (let j = 0; j < best.length; j++) {
          if (best[j].d2 > maxD2) { maxD2 = best[j].d2; maxIdx = j; }
        }
      }
    }

    // Return entities sorted by distance for determinism
    best.sort((a, b) => a.d2 - b.d2);
    const results = best.map(b => b.e);
    
    this.releasePooledResults(filtered);
    return results;
  }

  /**
   * Query entities within a sector (cone) from a position
   */
  querySector(center: Vector3, direction: Vector3, angleRadians: number, range: number, team?: Team, excludeId?: EntityId): SpatialEntity[] {
    // Normalize direction vector
    const dirMag = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
    if (dirMag === 0) return [];
    
    const dirX = direction.x / dirMag;
    const dirY = direction.y / dirMag;
    const dirZ = direction.z / dirMag;
    
    const cosHalfAngle = Math.cos(angleRadians / 2);
    const results: SpatialEntity[] = [];
    
    this.forEachInRadius(center, range, (dx, dy, dz, _distSq, entity) => {
      // Filter by team and exclude id if specified
      if (team !== undefined && entity.team !== team) return;
      if (excludeId !== undefined && entity.id === excludeId) return;
      
      // Check if within cone angle
      const toEntityMag = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (toEntityMag === 0) return;
      
      // Normalized vector to entity (dx,dy,dz are already entity.pos - center)
      const toEntityNormX = dx / toEntityMag;
      const toEntityNormY = dy / toEntityMag;
      const toEntityNormZ = dz / toEntityMag;
      
      // Dot product with direction
      const dotProduct = dirX * toEntityNormX + dirY * toEntityNormY + dirZ * toEntityNormZ;
      
      // Check if within cone angle
      if (dotProduct >= cosHalfAngle) {
        results.push(entity);
      }
    });
    
    return results;
  }

  /**
   * Query neighbors (same team) within radius
   */
  queryNeighbors(center: Vector3, radius: number, team: Team, excludeId?: EntityId): SpatialEntity[] {
    const results: SpatialEntity[] = [];
    this.forEachInRadius(center, radius, (_dx, _dy, _dz, _distSq, entity) => {
      if (entity.team === team && (excludeId === undefined || entity.id !== excludeId)) {
        results.push(entity);
      }
    });
    return results;
  }

  /**
   * Optimized streaming iteration over neighbors (same team) within radius.
   * Avoids creating intermediate arrays and reuses the cached occupied cell keys
   * for repeated queries at the same center cell and radius.
   * The callback receives the delta vector and distance for immediate math use.
   */
  forEachNeighborsDelta(
    center: Vector3,
    radius: number,
    team: Team,
    excludeId: EntityId | undefined,
    // Note: callback receives distSq (squared distance) to avoid inner sqrt; callers can sqrt if needed
    fn: (dx: number, dy: number, dz: number, distSq: number, entity: SpatialEntity) => void
  ): void {
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCellX = Math.floor(center.x / this.cellSize);
    const centerCellY = Math.floor(center.y / this.cellSize);
    const centerCellZ = Math.floor(center.z / this.cellSize);
    const cellSize = this.cellSize;
  const radiusSq = radius * radius;
    const grid = this.grid;

    // Use cached occupied cell keys for this center cell and radius if grid hasn't changed
    let occupiedKeys: number[] | null = null;
    const lrc = this.lastRadiusCache;
    if (
      lrc && lrc.version === this.version && lrc.cx === centerCellX && lrc.cy === centerCellY && lrc.cz === centerCellZ && lrc.cellRadius === cellRadius
    ) {
      occupiedKeys = lrc.cellKeys;
    }

    if (!occupiedKeys) {
      const scratch = this._occupiedKeysScratch;
      scratch.length = 0;
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const cellX = centerCellX + dx;
        const minX = cellX * cellSize;
        const maxX = minX + cellSize;
        const distX = center.x < minX ? (minX - center.x) : (center.x > maxX ? (center.x - maxX) : 0);
        const distXSq = distX * distX;

        for (let dy = -cellRadius; dy <= cellRadius; dy++) {
          const cellY = centerCellY + dy;
          const minY = cellY * cellSize;
          const maxY = minY + cellSize;
          const distY = center.y < minY ? (minY - center.y) : (center.y > maxY ? (center.y - maxY) : 0);
          const distYSq = distY * distY;
          if (distXSq + distYSq > radiusSq) continue;

          for (let dz = -cellRadius; dz <= cellRadius; dz++) {
            const cellZ = centerCellZ + dz;
            const minZ = cellZ * cellSize;
            const maxZ = minZ + cellSize;
            const distZ = center.z < minZ ? (minZ - center.z) : (center.z > maxZ ? (center.z - maxZ) : 0);
            const minDistSq = distXSq + distYSq + distZ * distZ;
            if (minDistSq > radiusSq) continue;

            const key = this.linearIndex(cellX, cellY, cellZ);
            const bucket = grid.get(key);
            if (bucket && bucket.length > 0) scratch.push(key);
          }
        }
      }
      const keysCopy = scratch.slice();
      this.lastRadiusCache = { cx: centerCellX, cy: centerCellY, cz: centerCellZ, cellRadius, version: this.version, cellKeys: keysCopy };
      occupiedKeys = keysCopy;
    }

    // Iterate only occupied cells
    for (let i = 0; i < occupiedKeys.length; i++) {
      const bucket = grid.get(occupiedKeys[i]);
      if (!bucket) continue;
      for (let j = 0; j < bucket.length; j++) {
        const entity = bucket[j];
        if (entity.team !== team) continue;
        if (excludeId !== undefined && entity.id === excludeId) continue;
        const dxp = entity.pos.x - center.x;
        const dyp = entity.pos.y - center.y;
        const dzp = entity.pos.z - center.z;
        const distSq = dxp * dxp + dyp * dyp + dzp * dzp;
        if (distSq <= radiusSq) {
          fn(dxp, dyp, dzp, distSq, entity);
        }
      }
    }
  }

  /**
   * Query enemies (different team) within radius
   */
  queryEnemies(center: Vector3, radius: number, team: Team): SpatialEntity[] {
    const results: SpatialEntity[] = [];
    this.forEachInRadius(center, radius, (_dx, _dy, _dz, _distSq, entity) => {
      if (entity.team !== team) {
        results.push(entity);
      }
    });
    return results;
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
    const totalEntities = this.entityById.size;
    let sum = 0;
    for (const entities of this.grid.values()) sum += entities.length;
    return {
      totalCells,
      occupiedCells: totalCells,
      totalEntities,
      avgEntitiesPerCell: totalCells > 0 ? sum / totalCells : 0
    };
  }

  /** Fast check if the grid currently contains no entities */
  isEmpty(): boolean {
    return this.entityById.size === 0;
  }
}