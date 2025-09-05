import type { GameState, Ship, Vector3 } from '../../types/index.js';

/**
 * Batched query system to reduce redundant spatial searches.
 * Instead of each ship making individual queries, we batch similar
 * queries and share results across multiple ships.
 */

interface BatchedResults {
  nearestEnemyCache: Map<number, Ship | null>;
  nearbyEnemiesCache: Map<string, Ship[]>;
  nearbyFriendsCache: Map<string, Ship[]>;
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
    if (!state.spatialGrid || !state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      // Fallback to individual queries
      return;
    }

    // Ensure spatial grid is populated once for all queries
    state.spatialGrid.clear();
    for (const s of state.ships) {
      if (s.health > 0) {
        state.spatialGrid.insert({ id: s.id, pos: s.pos, radius: 16, team: s.team });
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
    const separationDistance = state.behaviorConfig?.globalSettings.separationDistance ?? 50;
    
    if (!state.spatialGrid || !state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      return;
    }

    for (const ship of ships) {
      const neighbors: Vector3[] = [];
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
      this.results.separationNeighborsCache.set(ship.id, neighbors);
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

      // Cache results for all ships in this cell
      for (const ship of ships) {
        const shipKey = `${ship.id}|${range}`;
        // Filter enemies by actual distance to this specific ship
        const nearbyEnemies = enemies.filter(enemy => {
          const dx = enemy.pos.x - ship.pos.x;
          const dy = enemy.pos.y - ship.pos.y;
          const dz = enemy.pos.z - ship.pos.z;
          return Math.sqrt(dx*dx + dy*dy + dz*dz) <= range;
        }).sort((a, b) => {
          const distA = Math.sqrt(
            Math.pow(a.pos.x - ship.pos.x, 2) + 
            Math.pow(a.pos.y - ship.pos.y, 2) + 
            Math.pow(a.pos.z - ship.pos.z, 2)
          );
          const distB = Math.sqrt(
            Math.pow(b.pos.x - ship.pos.x, 2) + 
            Math.pow(b.pos.y - ship.pos.y, 2) + 
            Math.pow(b.pos.z - ship.pos.z, 2)
          );
          return distA - distB;
        });
        
        this.results.nearbyEnemiesCache.set(shipKey, nearbyEnemies);
      }
    }
  }

  /**
   * Get cached nearby enemies
   */
  public getNearbyEnemies(ship: Ship, range: number): Ship[] {
    const shipKey = `${ship.id}|${range}`;
    return this.results.nearbyEnemiesCache.get(shipKey) || [];
  }
}
