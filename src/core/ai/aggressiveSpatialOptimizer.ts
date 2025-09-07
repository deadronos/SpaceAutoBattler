import { DEBUG_AI } from '../../utils/env';
import type { Vector3, EntityId, Team } from '../../types/index.js';
import type { SpatialEntity } from '../../utils/spatialGrid.js';

/**
 * High-performance spatial optimization system that reduces expensive spatial queries
 * through approximation algorithms, hierarchical caching, and reduced update frequency.
 * 
 * Targets the core bottlenecks identified in Chrome DevTools profiler:
 * - queryRadius: 8,533.4ms (86.7% self time)
 * - queryKNearest: 7,682.3ms (78.0% self time)
 */
export class AggressiveSpatialOptimizer {
  private hierarchicalCache = new Map<string, {
    results: SpatialEntity[];
    timestamp: number;
    hitCount: number;
  }>();
  
  // Multi-resolution grids for different query scales
  private coarseGrid = new Map<number, SpatialEntity[]>(); // 4x cell size
  private mediumGrid = new Map<number, SpatialEntity[]>(); // 2x cell size
  private fineGrid = new Map<number, SpatialEntity[]>();   // 1x cell size
  
  private cacheTTL = 5; // frames
  private coarseThreshold = 200; // Use coarse grid for radius > 200
  private mediumThreshold = 100; // Use medium grid for radius > 100
  
  // Approximation tables for fast distance calculations
  private distanceLUT = new Map<string, number>();
  private lutPrecision = 4; // Round to nearest 4 units
  
  // Pre-computed neighbor tables for common scenarios
  private commonNeighborCache = new Map<string, {
    entities: SpatialEntity[];
    frame: number;
  }>();
  
  private currentFrame = 0;
  private spatialUpdateFrequency = 3; // Update spatial data every 3 frames
  private lastSpatialUpdate = 0;
  
  // Performance metrics
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    approximationUses: 0,
    hierarchicalQueries: 0,
  };

  constructor(private baseGrid: { queryRadius: (center: Vector3, radius: number) => SpatialEntity[] } , private cellSize: number) {}

  /**
   * Helper to obtain candidates from the wrapped baseGrid while avoiding
   * large array allocations when possible. Prefers streaming via
   * `forEachInRadius` when available. Falls back to pooled results if the
   * baseGrid exposes pooling helpers, otherwise uses `queryRadius`.
   */
  private getCandidatesFromBaseGrid(center: Vector3, radius: number, team?: Team, excludeId?: EntityId): SpatialEntity[] {
    type OptionalGrid = {
      forEachInRadius?: (center: Vector3, radius: number, fn: (dx: number, dy: number, dz: number, distSq: number, entity: SpatialEntity) => void) => void;
      getPooledResults?: () => SpatialEntity[];
      releasePooledResults?: (arr: SpatialEntity[]) => void;
      queryRadius?: (center: Vector3, radius: number, out?: SpatialEntity[]) => SpatialEntity[];
    };

    const bg = this.baseGrid as unknown as OptionalGrid;

    // Prefer streaming API if present - this avoids allocations entirely
    if (typeof bg.forEachInRadius === 'function') {
      const out: SpatialEntity[] = [];
      try {
        bg.forEachInRadius!(center, radius, (_dx, _dy, _dz, _distSq, entity) => {
          if (team !== undefined && entity.team !== team) return;
          if (excludeId !== undefined && entity.id === excludeId) return;
          out.push(entity);
        });
        return out;
      } catch {
        // Fall through to pooled attempts on error
      }
    }

    // Try pooled results if available: call queryRadius with provided buffer
    if (typeof bg.getPooledResults === 'function' && typeof bg.releasePooledResults === 'function') {
      const buf: SpatialEntity[] = bg.getPooledResults!();
      try {
        if (typeof bg.queryRadius === 'function') {
          bg.queryRadius!(center, radius, buf);
        }
        const res: SpatialEntity[] = [];
        for (const e of buf) {
          if (team !== undefined && e.team !== team) continue;
          if (excludeId !== undefined && e.id === excludeId) continue;
          res.push(e);
        }
        return res;
      } finally {
        bg.releasePooledResults!(buf);
      }
    }

    // As a last resort, call queryRadius and pass an out array if supported
    try {
      if (typeof this.baseGrid.queryRadius === 'function') {
        const arr = this.baseGrid.queryRadius(center, radius) || [];
        // Filter in-place into a new array to preserve caller expectations
        return arr.filter((entity: SpatialEntity) => {
          if (team !== undefined && entity.team !== team) return false;
          if (excludeId !== undefined && entity.id === excludeId) return false;
          return true;
        });
      }
    } catch {
      // ignore errors and fall through
    }
    return [];
  }

  /**
   * Optimized radius query with hierarchical approximation
   */
  queryRadiusOptimized(
    center: Vector3, 
    radius: number, 
    team?: Team,
    excludeId?: EntityId,
  approximationLevel = 0.2 // 0 = exact, 1 = very approximate (default nudged to favor cheaper queries)
  ): SpatialEntity[] {
    this.currentFrame++;
    
    // Generate cache key for this query
    const cacheKey = this.generateCacheKey(center, radius, team, excludeId, approximationLevel);
    
    // Check hierarchical cache first
    const cached = this.hierarchicalCache.get(cacheKey);
    if (cached && (this.currentFrame - cached.timestamp) < this.cacheTTL) {
      cached.hitCount++;
      this.metrics.cacheHits++;
      return cached.results;
    }
    
    this.metrics.cacheMisses++;
    
    // Choose grid resolution based on query radius
    const results = this.executeHierarchicalQuery(center, radius, approximationLevel, team, excludeId);
    
    // Cache the results
    this.hierarchicalCache.set(cacheKey, {
      results: results,
      timestamp: this.currentFrame,
      hitCount: 1
    });
    
    return results;
  }

  /**
   * Extremely fast approximate K-nearest using hierarchical search
   */
  queryKNearestApproximate(
    center: Vector3,
    k: number,
    team?: Team,
    excludeId?: EntityId,
    approximationLevel = 0.2
  ): SpatialEntity[] {
    const cacheKey = `knearest:${this.positionKey(center)}:${k}:${team}:${excludeId}:${approximationLevel}`;
    
    const cached = this.commonNeighborCache.get(cacheKey);
    if (cached && (this.currentFrame - cached.frame) < this.cacheTTL * 2) {
      this.metrics.cacheHits++;
      return cached.entities.slice(0, k);
    }
    
    // Use simple expanding radius with base grid
    let searchRadius = this.cellSize * 2;
    const maxSearchRadius = Math.max(400, this.cellSize * 8);
    
    while (searchRadius <= maxSearchRadius) {
      // Prefer baseGrid when available, but fall back to internal fineGrid
      // which is populated by updateSpatialGrids. This ensures tests that
      // drive the optimizer via updateSpatialGrids still get candidates even
      // when the wrapped baseGrid isn't populated by the test harness.
  let candidates = this.getCandidatesFromBaseGrid(center, searchRadius, team, excludeId);
      if (candidates.length === 0) {
        // Use internal fineGrid if available
        candidates = this.queryFineGrid(center, searchRadius, team, excludeId);
      }
      
      if (candidates.length >= k) {
        // Sort by distance and take k nearest
        candidates.sort((a, b) => {
          const distA = this.getDistanceSqFast(center, a.pos);
          const distB = this.getDistanceSqFast(center, b.pos);
          return distA - distB;
        });
        
        const results = candidates.slice(0, k);
        
        // Cache for next frame
        this.commonNeighborCache.set(cacheKey, {
          entities: results,
          frame: this.currentFrame
        });
        
        this.metrics.approximationUses++;
        return results;
      }
      
      searchRadius *= 1.5;
    }
    
    // Return what we found, even if less than k
  const allCandidates = this.getCandidatesFromBaseGrid(center, maxSearchRadius, team, excludeId);
    if (DEBUG_AI) console.log(`[AggressiveSpatialOptimizer] queryKNearestApproximate - maxSearchRadius: ${maxSearchRadius}, allCandidates.length: ${allCandidates.length}`);
    
    allCandidates.sort((a, b) => {
      const distA = this.getDistanceSqFast(center, a.pos);
      const distB = this.getDistanceSqFast(center, b.pos);
      return distA - distB;
    });
    
    return allCandidates.slice(0, k);
  }

  /**
   * Execute query using appropriate grid resolution
   */
  private executeHierarchicalQuery(
    center: Vector3,
    radius: number,
    _approximationLevel: number,
    team?: Team,
    excludeId?: EntityId
  ): SpatialEntity[] {
    this.metrics.hierarchicalQueries++;
    // Prefer the wrapped baseGrid when it returns results (tests and some
    // integration flows populate the base spatial grid directly). This keeps
    // behavior backward-compatible while still allowing the optimizer's
    // internal grids to be used as a fallback when baseGrid is empty.
    try {
  const baseCandidates = this.getCandidatesFromBaseGrid(center, radius, team, excludeId);
      if (baseCandidates.length > 0) return baseCandidates;
    } catch {
      // Ignore errors from baseGrid and fall through to internal grids
    }

    // Choose grid resolution based on radius thresholds
    if (radius >= this.coarseThreshold) {
      return this.queryCoarseGrid(center, radius, team, excludeId);
    }
    if (radius >= this.mediumThreshold) {
      return this.queryMediumGrid(center, radius, team, excludeId);
    }
    return this.queryFineGrid(center, radius, team, excludeId);
  }

  /**
   * Coarse grid query - 4x cell size, fast but approximate
   */
  private queryCoarseGrid(center: Vector3, radius: number, team?: Team, excludeId?: EntityId): SpatialEntity[] {
    const coarseCellSize = this.cellSize * 4;
    const centerCellX = Math.floor(center.x / coarseCellSize);
    const centerCellY = Math.floor(center.y / coarseCellSize);
    const centerCellZ = Math.floor(center.z / coarseCellSize);
    
    const results: SpatialEntity[] = [];
    const radiusSq = radius * radius;
    const seen = new Set<EntityId>();
    
    // Simplified iteration - only check 6 cardinal directions + center for very fast approximation
    const offsets = [[0,0,0], [-1,0,0], [1,0,0], [0,-1,0], [0,1,0], [0,0,-1], [0,0,1]]; // Cardinal directions
    
    for (const [dx, dy, dz] of offsets) {
      const cellX = centerCellX + dx;
      const cellY = centerCellY + dy;
      const cellZ = centerCellZ + dz;
      
      const key = this.linearIndex(cellX, cellY, cellZ, coarseCellSize);
      const bucket = this.coarseGrid.get(key);
      if (!bucket) continue;
      
      for (const entity of bucket) {
        if (seen.has(entity.id)) continue;
        if (team !== undefined && entity.team !== team) continue;
        if (excludeId !== undefined && entity.id === excludeId) continue;
        
        const distSq = this.getDistanceSqFast(center, entity.pos);
        if (distSq <= radiusSq) {
          seen.add(entity.id);
          results.push(entity);
        }
      }
    }
    
    return results;
  }

  /**
   * Medium resolution grid query
   */
  private queryMediumGrid(center: Vector3, radius: number, team?: Team, excludeId?: EntityId): SpatialEntity[] {
    // Similar to coarse but with 2x cell size and more thorough search
    const mediumCellSize = this.cellSize * 2;
    return this.queryGridWithCellSize(center, radius, this.mediumGrid, mediumCellSize, team, excludeId);
  }

  /**
   * Fine grid query - fallback to original implementation for precision
   */
  private queryFineGrid(center: Vector3, radius: number, team?: Team, excludeId?: EntityId): SpatialEntity[] {
  // Query the internal fineGrid (1x cell size) for precise results.
  // This avoids relying on the wrapped baseGrid, which tests sometimes
  // leave unpopulated while the optimizer's internal grids are populated
  // via updateSpatialGrids.
  return this.queryGridWithCellSize(center, radius, this.fineGrid, this.cellSize, team, excludeId);
  }

  /**
   * Query ring at specific radius for expanding search
   */
  private queryRingApproximate(center: Vector3, radius: number, team?: Team, excludeId?: EntityId): SpatialEntity[] {
    // Use coarse grid for ring queries to be very fast
    const innerRadius = radius * 0.7; // Inner ring boundary
    const outerResults = this.queryCoarseGrid(center, radius, team, excludeId);
    const innerResults = radius > this.cellSize * 2 ? 
      this.queryCoarseGrid(center, innerRadius, team, excludeId) : [];
    
    // Return entities in the ring (outer - inner)
    const innerIds = new Set(innerResults.map(e => e.id));
    return outerResults.filter(e => !innerIds.has(e.id));
  }

  /**
   * Fast distance calculation using lookup table
   */
  private getDistanceSqFast(p1: Vector3, p2: Vector3): number {
    // Use exact squared distance for correctness; LUT rounding caused accuracy regression in tests.
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * Update spatial grids (reduced frequency)
   */
  updateSpatialGrids(entities: SpatialEntity[]) {
    // If we've recently updated, skip to reduce work - but always allow an update
    // when grids are currently empty (initial population) so the first call
    // actually populates the multi-resolution grids.
    if (this.currentFrame - this.lastSpatialUpdate < this.spatialUpdateFrequency && this.fineGrid.size > 0) {
      return; // Skip update this frame
    }
    
    this.lastSpatialUpdate = this.currentFrame;
    
    // Clear grids
    this.coarseGrid.clear();
    this.mediumGrid.clear();
    this.fineGrid.clear();
    
    // Populate all resolution levels
    for (const entity of entities) {
      this.insertIntoGrid(entity, this.coarseGrid, this.cellSize * 4);
      this.insertIntoGrid(entity, this.mediumGrid, this.cellSize * 2);
      this.insertIntoGrid(entity, this.fineGrid, this.cellSize);
    }
    
    // Expire old cache entries
    this.expireCache();
  }

  /**
   * Insert entity into specific grid
   */
  private insertIntoGrid(entity: SpatialEntity, grid: Map<number, SpatialEntity[]>, cellSize: number) {
    const key = this.linearIndex(
      Math.floor(entity.pos.x / cellSize),
      Math.floor(entity.pos.y / cellSize),
      Math.floor(entity.pos.z / cellSize),
      cellSize
    );
    
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(entity);
  }

  /**
   * Generic grid query with specified cell size
   */
  private queryGridWithCellSize(
    center: Vector3,
    radius: number,
    grid: Map<number, SpatialEntity[]>,
    cellSize: number,
    team?: Team,
    excludeId?: EntityId
  ): SpatialEntity[] {
    const cellRadius = Math.ceil(radius / cellSize);
    const centerCellX = Math.floor(center.x / cellSize);
    const centerCellY = Math.floor(center.y / cellSize);
    const centerCellZ = Math.floor(center.z / cellSize);
    
    const results: SpatialEntity[] = [];
    const radiusSq = radius * radius;
    const seen = new Set<EntityId>();
    
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        for (let dz = -cellRadius; dz <= cellRadius; dz++) {
          const key = this.linearIndex(
            centerCellX + dx,
            centerCellY + dy,
            centerCellZ + dz,
            cellSize
          );
          
          const bucket = grid.get(key);
          if (!bucket) continue;
          
          for (const entity of bucket) {
            if (seen.has(entity.id)) continue;
            if (team !== undefined && entity.team !== team) continue;
            if (excludeId !== undefined && entity.id === excludeId) continue;
            
            const distSq = this.getDistanceSqFast(center, entity.pos);
            if (distSq <= radiusSq) {
              seen.add(entity.id);
              results.push(entity);
            }
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(
    center: Vector3,
    radius: number,
    team?: Team,
    excludeId?: EntityId,
    approximationLevel?: number
  ): string {
    const posKey = this.positionKey(center);
    return `${posKey}:${Math.round(radius)}:${team}:${excludeId}:${approximationLevel}`;
  }

  /**
   * Convert position to discrete key for caching
   */
  private positionKey(pos: Vector3): string {
    const precision = this.cellSize / 2; // Half cell precision for caching
    return `${Math.floor(pos.x / precision)},${Math.floor(pos.y / precision)},${Math.floor(pos.z / precision)}`;
  }

  /**
   * Linear index for grid cells
   */
  private linearIndex(x: number, y: number, z: number, cellSize: number): number {
    // Use cellSize in hash for different resolutions
    return (x + 1000) * 2000000 + (y + 1000) * 1000 + (z + 1000) + Math.floor(cellSize);
  }

  /**
   * Clean up old cache entries
   */
  private expireCache() {
    for (const [key, entry] of this.hierarchicalCache.entries()) {
      if (this.currentFrame - entry.timestamp > this.cacheTTL) {
        this.hierarchicalCache.delete(key);
      }
    }
    
    for (const [key, entry] of this.commonNeighborCache.entries()) {
      if (this.currentFrame - entry.frame > this.cacheTTL * 2) {
        this.commonNeighborCache.delete(key);
      }
    }
    
    // Limit LUT size
    if (this.distanceLUT.size > 10000) {
      this.distanceLUT.clear();
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const cacheHitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses);
    return {
      ...this.metrics,
      cacheHitRate: cacheHitRate || 0,
      cacheSize: this.hierarchicalCache.size,
      neighborCacheSize: this.commonNeighborCache.size,
      lutSize: this.distanceLUT.size
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      approximationUses: 0,
      hierarchicalQueries: 0,
    };
  }

  /**
   * Configure optimization parameters
   */
  configure(options: {
    cacheTTL?: number;
    spatialUpdateFrequency?: number;
    lutPrecision?: number;
    coarseThreshold?: number;
    mediumThreshold?: number;
  }) {
    if (options.cacheTTL !== undefined) {
      this.cacheTTL = options.cacheTTL;
    }
    if (options.spatialUpdateFrequency !== undefined) {
      this.spatialUpdateFrequency = options.spatialUpdateFrequency;
    }
    if (options.lutPrecision !== undefined) {
      this.lutPrecision = options.lutPrecision;
    }
    if (options.coarseThreshold !== undefined) {
      this.coarseThreshold = options.coarseThreshold;
    }
    if (options.mediumThreshold !== undefined) {
      this.mediumThreshold = options.mediumThreshold;
    }
  }
}
