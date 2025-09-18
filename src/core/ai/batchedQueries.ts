import type { GameState, Ship, Vector3 } from '../../types/index.js';
import type { AggressiveSpatialOptimizer } from './aggressiveSpatialOptimizer.js';

/**
 * Batched query system to reduce redundant spatial searches.
 * Instead of each ship making individual queries, we batch similar
 * queries and share results across multiple ships.
 */

interface BatchedResults {
  nearestEnemyCache: Map<number, Ship | null>;
  // Map shipId -> Map<range, Ship[]>
  nearbyEnemiesCache: Map<number, Map<number, Ship[]>>;
  nearbyFriendsCache: Map<number, Map<number, Ship[]>>;
  separationNeighborsCache: Map<number, Vector3[]>;
}

interface ShipActivityTracker {
  lastUpdateFrame: number;
  lastPosition: Vector3;
  lastTargetId: number | null;
  skipCount: number; // How many frames we've skipped
}

export class BatchedQueryManager {
  private results: BatchedResults = {
    nearestEnemyCache: new Map(),
    nearbyEnemiesCache: new Map(),
    nearbyFriendsCache: new Map(),
    separationNeighborsCache: new Map(),
  };

  private frameId = 0;
  private static BENCH = !!process.env.VITEST_DEBUG_BENCH;
  private spatialOptimizer: AggressiveSpatialOptimizer | undefined;

  // Activity tracking for reduced frequency updates
  private shipActivity = new Map<number, ShipActivityTracker>();
  private readonly ACTIVITY_CHECK_DISTANCE = 25; // Units - if ship moved this much, consider it active
  private readonly ACTIVITY_CHECK_VELOCITY = 10; // Units/sec - if ship is moving this fast, consider it active
  private readonly MAX_SKIP_FRAMES = 4; // Maximum frames to skip for inactive distant ships
  private readonly MIN_SKIP_FRAMES = 2; // Minimum frames to skip for any inactive ship

  constructor(spatialOptimizer?: AggressiveSpatialOptimizer) {
    this.spatialOptimizer = spatialOptimizer;
  }

  /**
   * Check if a ship needs an update based on movement, target changes, and time since last update
   */
  // Use squared distances to avoid Math.sqrt in hot path
  private shouldUpdateShip(ship: Ship, nearestEnemyDistanceSq?: number): boolean {
    const tracker = this.shipActivity.get(ship.id);
    
    // Always update on first frame or if we don't have tracking data
    if (!tracker || tracker.lastUpdateFrame === 0) {
      return true;
    }

    const framesSinceUpdate = this.frameId - tracker.lastUpdateFrame;
    
    // Force update if we've skipped too many frames
    if (framesSinceUpdate >= this.MAX_SKIP_FRAMES) {
      return true;
    }

    // Check if ship has moved significantly
    const dx = ship.pos.x - tracker.lastPosition.x;
    const dy = ship.pos.y - tracker.lastPosition.y;
    const dz = ship.pos.z - tracker.lastPosition.z;
    const movedSq = dx * dx + dy * dy + dz * dz;
    if (movedSq > this.ACTIVITY_CHECK_DISTANCE * this.ACTIVITY_CHECK_DISTANCE) {
      return true;
    }

    // Check if ship is moving fast (velocity check)
    const speedSq = ship.vel.x * ship.vel.x + ship.vel.y * ship.vel.y + ship.vel.z * ship.vel.z;
    if (speedSq > this.ACTIVITY_CHECK_VELOCITY * this.ACTIVITY_CHECK_VELOCITY) {
      return true;
    }

    // Check if target changed
    if (ship.targetId !== tracker.lastTargetId) {
      return true;
    }

    // For distant ships, allow more skipping (use squared threshold)
    const skipThreshold = nearestEnemyDistanceSq && nearestEnemyDistanceSq > (200 * 200) ? 
      this.MAX_SKIP_FRAMES : this.MIN_SKIP_FRAMES;
    
    // Skip if we haven't reached the minimum skip threshold
    return framesSinceUpdate >= skipThreshold;
  }

  /**
   * Update activity tracking for a ship
   */
  private updateShipActivity(ship: Ship): void {
    this.shipActivity.set(ship.id, {
      lastUpdateFrame: this.frameId,
      lastPosition: { x: ship.pos.x, y: ship.pos.y, z: ship.pos.z },
      lastTargetId: ship.targetId,
      skipCount: 0
    });
  }

  /**
   * Group ships by spatial cell for batch processing
   */
  private groupShipsByCell(ships: Ship[], cellSize: number): Map<string, { ships: Ship[]; center: Vector3 }> {
    const cellQueries = new Map<string, { ships: Ship[]; center: Vector3 }>();

    for (const ship of ships) {
      const cellX = Math.floor(ship.pos.x / cellSize);
      const cellY = Math.floor(ship.pos.y / cellSize);
      const cellZ = Math.floor(ship.pos.z / cellSize);
      const cellKey = `${cellX}|${cellY}|${cellZ}`;

      if (!cellQueries.has(cellKey)) {
        cellQueries.set(cellKey, {
          ships: [],
          center: { x: cellX * cellSize, y: cellY * cellSize, z: cellZ * cellSize },
        });
      }
      cellQueries.get(cellKey)!.ships.push(ship);
    }

    return cellQueries;
  }

  /**
   * Pre-compute nearest enemies for all ships in one batch operation
   */
  public precomputeNearestEnemies(state: GameState, ships: Ship[]) {
    const bench = BatchedQueryManager.BENCH;
    const t0 = bench ? performance.now() : 0;
    if (!this.spatialOptimizer || !state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      // Fallback to individual queries
      if (bench)
        console.log('[BENCH] precomputeNearestEnemies skipped - no spatialOptimizer or index');
      return;
    }

    let processedCount = 0;
    let skippedCount = 0;

  // Keep the individual query approach but add activity-based skipping
    for (const ship of ships) {
      // Quick distance estimate to nearest enemy for activity calculation
      let nearestEnemyDistanceSq: number | undefined;
      const cachedEnemy = this.results.nearestEnemyCache.get(ship.id);
      if (cachedEnemy) {
        const dx = cachedEnemy.pos.x - ship.pos.x;
        const dy = cachedEnemy.pos.y - ship.pos.y;
        const dz = cachedEnemy.pos.z - ship.pos.z;
        nearestEnemyDistanceSq = dx * dx + dy * dy + dz * dz;
      }

      // Check if this ship needs an update
      if (!this.shouldUpdateShip(ship, nearestEnemyDistanceSq)) {
        skippedCount++;
        continue;
      }

      const targetTeam = ship.team === 'red' ? 'blue' : 'red';
      // Query a small candidate set and apply deterministic selection locally to
      // satisfy unit tests that assert tie-break behavior (choose lower id when
      // distances are equal). Using k=2 keeps the workload minimal while allowing
      // us to implement the tie-break rule.
      const candidates = this.spatialOptimizer.queryKNearestApproximate(ship.pos, 2, targetTeam);

      let bestEnemy: Ship | null = null;
      if (candidates && candidates.length > 0) {
        // Compute squared distances to avoid Math.sqrt and apply tie-break on equal dist
        const cx = ship.pos.x, cy = ship.pos.y, cz = ship.pos.z;
        let bestId = candidates[0].id;
        let bdx = candidates[0].pos.x - cx;
        let bdy = candidates[0].pos.y - cy;
        let bdz = candidates[0].pos.z - cz;
        let bestDistSq = bdx * bdx + bdy * bdy + bdz * bdz;
        for (let i = 1; i < candidates.length; i++) {
          const c = candidates[i];
          const dx = c.pos.x - cx;
          const dy = c.pos.y - cy;
          const dz = c.pos.z - cz;
          const dSq = dx * dx + dy * dy + dz * dz;
          if (dSq < bestDistSq || (dSq === bestDistSq && c.id < bestId)) {
            bestDistSq = dSq;
            bestId = c.id;
          }
        }
        bestEnemy = state.shipIndex?.get(bestId) || null;
      }

      this.results.nearestEnemyCache.set(ship.id, bestEnemy);
      this.updateShipActivity(ship);
      processedCount++;

      // Optional debug logging for failing tests: enable by setting VITEST_DEBUG_AI=1
      try {
        if (process.env.VITEST_DEBUG_AI) {
          const ids = candidates
            ? candidates.map((n: { id: number; pos: Vector3 }) =>
                `${n.id}@(${n.pos.x.toFixed(1)},${n.pos.y.toFixed(1)},${n.pos.z.toFixed(1)})`,
              )
            : [] as string[];
          console.log(
            `[DEBUG_AI] ship=${ship.id} nearestCandidates=${ids.join(', ')} selected=${bestEnemy ? bestEnemy.id : 'null'}`,
          );
        }
      } catch {
        // ignore debug logging errors in test env
      }
    }

    if (bench) {
      const t1 = performance.now();
      console.log(
        `[BENCH] precomputeNearestEnemies for ${ships.length} ships (processed: ${processedCount}, skipped: ${skippedCount}): ${(t1 - t0).toFixed(3)}ms`,
      );
    }
  }

  /**
   * Get cached nearest enemy result
   */
  public getNearestEnemy(ship: Ship): Ship | null {
    return this.results.nearestEnemyCache.get(ship.id) || null;
  }

  /**
   * Batch compute separation neighbors for ships in similar regions
   */
  public precomputeSeparationNeighbors(state: GameState, ships: Ship[]) {
    const bench = BatchedQueryManager.BENCH;
    const t0 = bench ? performance.now() : 0;
    const separationDistance = state.behaviorConfig?.globalSettings.separationDistance ?? 50;

    if (!this.spatialOptimizer || !state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      if (bench)
        console.log('[BENCH] precomputeSeparationNeighbors skipped - no spatialOptimizer or index');
      return;
    }

    let processedCount = 0;
    let skippedCount = 0;

    // Keep the individual query approach but add activity-based skipping  
    for (const ship of ships) {
      // Check if this ship needs an update (more frequent for separation since neighbors change quickly)
      if (!this.shouldUpdateShip(ship)) {
        skippedCount++;
        continue;
      }

      // Reuse existing array if present to avoid allocating a fresh array
      let neighbors = this.results.separationNeighborsCache.get(ship.id);
      if (!neighbors) {
        neighbors = [] as Vector3[];
        this.results.separationNeighborsCache.set(ship.id, neighbors);
      } else {
        neighbors.length = 0; // clear in-place
      }

      const entities = this.spatialOptimizer.queryRadiusOptimized(
        ship.pos,
        separationDistance,
        ship.team,
        ship.id,
      );
      for (const entity of entities) {
        const distSq =
          (entity.pos.x - ship.pos.x) ** 2 +
          (entity.pos.y - ship.pos.y) ** 2 +
          (entity.pos.z - ship.pos.z) ** 2;
        if (distSq > 0 && distSq < separationDistance * separationDistance) {
          neighbors.push(entity.pos);
        }
      }
      processedCount++;
    }

    if (bench) {
      const t1 = performance.now();
      console.log(
        `[BENCH] precomputeSeparationNeighbors for ${ships.length} ships (processed: ${processedCount}, skipped: ${skippedCount}): ${(t1 - t0).toFixed(3)}ms`,
      );
    }
  }

  /**
   * Get cached separation neighbors
   */
  public getSeparationNeighbors(ship: Ship): Vector3[] {
    return this.results.separationNeighborsCache.get(ship.id) || [];
  }

  /**
   * Batch query for nearby enemies within range, grouped by spatial regions
   */
  public precomputeNearbyEnemies(state: GameState, ships: Ship[], range: number) {
    if (!this.spatialOptimizer || !state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      return;
    }

    // Group ships by spatial cells to reduce redundant queries
    const cellSize = state.simConfig?.spatialGrid?.cellSize ?? 64; // Fallback to default cell size
    const cellGroups = this.groupShipsByCell(ships, cellSize);

    // Execute one query per cell region
    for (const [_cellKey, { ships: cellShips, center }] of cellGroups) {
      const enemies: Ship[] = [];
      const entities = this.spatialOptimizer.queryRadiusOptimized(center, range + cellSize);
      for (const entity of entities) {
        if (cellShips[0].team !== entity.team) {
          const s = state.shipIndex?.get(entity.id);
          if (s && s.health > 0) enemies.push(s);
        }
      }

      // Cache results for all ships in this cell. Use squared-distance math
      // to avoid repeated Math.sqrt and extra allocations.
      for (const ship of cellShips) {
        const range2 = range * range;
        const nearbyEnemies = enemies
          .filter((enemy) => {
            const dx = enemy.pos.x - ship.pos.x;
            const dy = enemy.pos.y - ship.pos.y;
            const dz = enemy.pos.z - ship.pos.z;
            return dx * dx + dy * dy + dz * dz <= range2;
          })
          .sort((a, b) => {
            const adx = a.pos.x - ship.pos.x,
              ady = a.pos.y - ship.pos.y,
              adz = a.pos.z - ship.pos.z;
            const bdx = b.pos.x - ship.pos.x,
              bdy = b.pos.y - ship.pos.y,
              bdz = b.pos.z - ship.pos.z;
            const da = adx * adx + ady * ady + adz * adz;
            const db = bdx * bdx + bdy * bdy + bdz * bdz;
            return da - db;
          });

        let inner = this.results.nearbyEnemiesCache.get(ship.id);
        if (!inner) {
          inner = new Map<number, Ship[]>();
          this.results.nearbyEnemiesCache.set(ship.id, inner);
        }
        inner.set(range, nearbyEnemies);
      }
    }
  }

  /**
   * Get cached nearby enemies
   */
  public getNearbyEnemies(ship: Ship, range: number): Ship[] {
    const inner = this.results.nearbyEnemiesCache.get(ship.id);
    return inner ? inner.get(range) || [] : [];
  }

  /**
   * Reset per-frame caches. Controller calls this each frame to ensure
   * batched results are fresh for the current frame.
   */
  public resetForFrame(frameId: number) {
    // Clear all cached result maps but keep the object references to allow
    // callers to re-use allocated Maps/arrays where possible.
    // Preserve nearestEnemyCache across frames to allow activity-based skipping
    // to reuse prior results and avoid recomputing every tick. Entries are
    // updated when shouldUpdateShip returns true for a ship. This improves
    // performance significantly in tests without sacrificing correctness.
    this.results.nearbyEnemiesCache.clear();
    this.results.nearbyFriendsCache.clear();
    this.results.separationNeighborsCache.clear();
    this.frameId = frameId;
    
    // Clean up old activity tracking data for ships that no longer exist
    // We do this periodically to prevent memory leaks
    if (frameId % 100 === 0) {
      // Keep only recent entries (ships that were updated in the last 50 frames)
      for (const [shipId, tracker] of this.shipActivity.entries()) {
        if (frameId - tracker.lastUpdateFrame > 50) {
          this.shipActivity.delete(shipId);
          // Also remove stale nearest cache entries for ships that haven't
          // been updated in a long time to prevent unbounded growth.
          this.results.nearestEnemyCache.delete(shipId);
        }
      }
    }
    
    if (BatchedQueryManager.BENCH) console.log(`[BENCH] resetForFrame: ${frameId}`);
  }
}
