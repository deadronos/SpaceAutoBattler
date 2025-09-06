import type { GameState, Ship, Vector3 } from '../../types/index.js';

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

export class BatchedQueryManager {
  private results: BatchedResults = {
    nearestEnemyCache: new Map(),
  nearbyEnemiesCache: new Map(),
  nearbyFriendsCache: new Map(),
    separationNeighborsCache: new Map()
  };
  
  private frameId = 0;
  private static BENCH = !!process.env.VITEST_DEBUG_BENCH;

  public resetForFrame(newFrameId: number) {
    if (newFrameId !== this.frameId) {
      this.results.nearestEnemyCache.clear();
      this.results.nearbyEnemiesCache.clear();
      this.results.nearbyFriendsCache.clear();
      this.results.separationNeighborsCache.clear();
      this.frameId = newFrameId;
    }
  }

  /**
   * Pre-compute nearest enemies for all ships in one batch operation
   */
  public precomputeNearestEnemies(state: GameState, ships: Ship[]) {
    const bench = BatchedQueryManager.BENCH;
    const t0 = bench ? performance.now() : 0;
    if (!state.spatialGrid || !state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      // Fallback to individual queries
      if (bench) console.log('[BENCH] precomputeNearestEnemies skipped - no spatialGrid or index');
      return;
    }

    // Ensure spatial grid is populated once for all queries. Use shared helper
    // to avoid duplicating rebuild logic and reduce allocations.
    try {
      // Import helper lazily to avoid circular deps at module load
      const { ensureSpatialGridUpdated } = require('../ai/spatial.js');
      ensureSpatialGridUpdated(state);
  } catch {
      // Fallback: populate directly if helper isn't available
      state.spatialGrid.clear();
      for (const s of state.ships) {
        if (s.health > 0) {
          state.spatialGrid.insert({ id: s.id, pos: s.pos, radius: 16, team: s.team });
        }
      }
    }

    // Batch query nearest enemies for all ships
    for (const ship of ships) {
      const targetTeam = ship.team === 'red' ? 'blue' : 'red';
      const nearest = state.spatialGrid.queryKNearest(ship.pos, 2, targetTeam);
      
      let bestEnemy: Ship | null = null;
      if (nearest && nearest.length > 0) {
        let best = nearest[0];
        if (nearest.length > 1) {
          const a = state.shipIndex?.get(nearest[0].id);
          const b = state.shipIndex?.get(nearest[1].id);
          if (a && b) {
            const dax=a.pos.x-ship.pos.x, day=a.pos.y-ship.pos.y, daz=a.pos.z-ship.pos.z;
            const dbx=b.pos.x-ship.pos.x, dby=b.pos.y-ship.pos.y, dbz=b.pos.z-ship.pos.z;
            const da=dax*dax+day*day+daz*daz; const db=dbx*dbx+dby*dby+dbz*dbz;
            if (db < da || (db===da && b.id < a.id)) best = nearest[1];
          }
        }
        bestEnemy = state.shipIndex?.get(best.id) || null;
      }
      
      this.results.nearestEnemyCache.set(ship.id, bestEnemy);
    }
    if (bench) {
      const t1 = performance.now();
      console.log(`[BENCH] precomputeNearestEnemies for ${ships.length} ships: ${(t1 - t0).toFixed(3)}ms`);
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
    
    if (!state.spatialGrid || !state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      if (bench) console.log('[BENCH] precomputeSeparationNeighbors skipped - no spatialGrid or index');
      return;
    }

  // Reuse cached arrays when available to avoid allocations
  for (const ship of ships) {
      // Reuse existing array if present to avoid allocating a fresh array
      let neighbors = this.results.separationNeighborsCache.get(ship.id);
      if (!neighbors) {
        neighbors = [] as Vector3[];
        this.results.separationNeighborsCache.set(ship.id, neighbors);
      } else {
        neighbors.length = 0; // clear in-place
      }

      state.spatialGrid.forEachNeighborsDelta(
        ship.pos,
        separationDistance,
        ship.team,
        ship.id,
        (_dxp, _dyp, _dzp, distSq, entity) => {
          if (distSq > 0 && distSq < separationDistance * separationDistance) {
            neighbors.push(entity.pos);
          }
        }
      );
    }
    if (bench) {
      const t1 = performance.now();
      console.log(`[BENCH] precomputeSeparationNeighbors for ${ships.length} ships: ${(t1 - t0).toFixed(3)}ms`);
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
    if (!state.spatialGrid || !state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      return;
    }

    // Group ships by spatial cells to reduce redundant queries
    const cellSize = state.simConfig.spatialGrid.cellSize;
    const cellQueries = new Map<string, { ships: Ship[], center: Vector3 }>();

    for (const ship of ships) {
      const cellX = Math.floor(ship.pos.x / cellSize);
      const cellY = Math.floor(ship.pos.y / cellSize);
      const cellZ = Math.floor(ship.pos.z / cellSize);
      const cellKey = `${cellX}|${cellY}|${cellZ}`;
      
      if (!cellQueries.has(cellKey)) {
        cellQueries.set(cellKey, { 
          ships: [], 
          center: { x: cellX * cellSize, y: cellY * cellSize, z: cellZ * cellSize }
        });
      }
      cellQueries.get(cellKey)!.ships.push(ship);
    }

    // Execute one query per cell region
    for (const [_cellKey, { ships, center }] of cellQueries) {
      const enemies: Ship[] = [];
      state.spatialGrid.forEachInRadius(center, range + cellSize, (_dx, _dy, _dz, _distSq, entity) => {
        if (ships[0].team !== entity.team) {
          const s = state.shipIndex?.get(entity.id);
          if (s && s.health > 0) enemies.push(s);
        }
      });

      // Cache results for all ships in this cell. Use squared-distance math
      // to avoid repeated Math.sqrt and extra allocations.
      for (const ship of ships) {
  const range2 = range * range;
  const nearbyEnemies = enemies.filter(enemy => {
          const dx = enemy.pos.x - ship.pos.x;
          const dy = enemy.pos.y - ship.pos.y;
          const dz = enemy.pos.z - ship.pos.z;
          return (dx*dx + dy*dy + dz*dz) <= range2;
        }).sort((a, b) => {
          const adx = a.pos.x - ship.pos.x, ady = a.pos.y - ship.pos.y, adz = a.pos.z - ship.pos.z;
          const bdx = b.pos.x - ship.pos.x, bdy = b.pos.y - ship.pos.y, bdz = b.pos.z - ship.pos.z;
          const da = adx*adx + ady*ady + adz*adz;
          const db = bdx*bdx + bdy*bdy + bdz*bdz;
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
  return inner ? (inner.get(range) || []) : [];
  }
}
