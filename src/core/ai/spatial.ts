import type { GameState, Ship, Vector3 } from '../../types/index.js';
import type { AggressiveSpatialOptimizer } from './aggressiveSpatialOptimizer.js';
import {
  getDistance as sharedGetDistance,
  findNearbyEnemies as sharedFindNearbyEnemies,
  findNearbyFriends as sharedFindNearbyFriends,
  findNearestEnemy as sharedFindNearestEnemy,
  getNearbySeparationShipsLinear as sharedGetNearbySeparationShipsLinear,
} from '../searchUtils.js';
import { calculateSeparationForceWithCount as steeringSeparation } from './steering.js';

export class SpatialHelpers {
  private state: GameState;
  private sepCache: Map<
    number,
    {
      x: number;
      y: number;
      z: number;
      sepDist: number;
      tick: number;
      res: { force: Vector3; neighborCount: number };
    }
  > = new Map();
  private spatialGridUpdated = false;
  private spatialOptimizer: AggressiveSpatialOptimizer | undefined;

  constructor(state: GameState, spatialOptimizer?: AggressiveSpatialOptimizer) {
    this.state = state;
    this.spatialOptimizer = spatialOptimizer;
  }
  resetTick() {
    this.spatialGridUpdated = false;
  }
  // The spatial grid is now updated incrementally by updateSpatialGrid in gameState.ts
  // No need for a full rebuild here.
  calculateSeparationForceWithCount(ship: Ship): { force: Vector3; neighborCount: number } {
    const separationDistance = this.state.behaviorConfig!.globalSettings.separationDistance;
    const magnitudeThreshold =
      this.state.behaviorConfig!.globalSettings.separationVectorMagnitudeThreshold || 0.0001;
    const cached = this.sepCache.get(ship.id);
    if (this.spatialOptimizer && this.state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      if (
        cached &&
        cached.tick === this.state.tick &&
        cached.sepDist === separationDistance &&
        cached.x === ship.pos.x &&
        cached.y === ship.pos.y &&
        cached.z === ship.pos.z
      ) {
        return cached.res;
      }
      // Use the optimized spatial query
      const entities = this.spatialOptimizer.queryRadiusOptimized(
        ship.pos,
        separationDistance,
        ship.team,
        ship.id,
      );
      const neighbors: Vector3[] = [];
      for (const entity of entities) {
        const distSq =
          (entity.pos.x - ship.pos.x) ** 2 +
          (entity.pos.y - ship.pos.y) ** 2 +
          (entity.pos.z - ship.pos.z) ** 2;
        if (distSq > 0 && distSq < separationDistance * separationDistance) {
          neighbors.push(entity.pos);
        }
      }
      const res = steeringSeparation(
        ship.pos,
        neighbors,
        separationDistance,
        magnitudeThreshold,
        () => this.state.rng.next(),
      );
      this.sepCache.set(ship.id, {
        x: ship.pos.x,
        y: ship.pos.y,
        z: ship.pos.z,
        sepDist: separationDistance,
        tick: this.state.tick,
        res,
      });
      return res;
    }
    const nearby = sharedGetNearbySeparationShipsLinear(this.state, ship, separationDistance);
    const neighborPositions = nearby.map((o) => o.pos);
    const res = steeringSeparation(
      ship.pos,
      neighborPositions,
      separationDistance,
      magnitudeThreshold,
      () => this.state.rng.next(),
    );
    return res;
  }

  /**
   * OPTIMIZATION: Calculate separation force from pre-computed neighbor positions
   * This avoids redundant spatial queries when neighbors are already known
   */
  calculateSeparationFromNeighbors(
    ship: Ship,
    neighbors: Vector3[],
  ): { force: Vector3; neighborCount: number } {
    const separationDistance = this.state.behaviorConfig!.globalSettings.separationDistance;
    const magnitudeThreshold =
      this.state.behaviorConfig!.globalSettings.separationVectorMagnitudeThreshold || 0.0001;
    return steeringSeparation(ship.pos, neighbors, separationDistance, magnitudeThreshold, () =>
      this.state.rng.next(),
    );
  }
}

export function findNearestEnemy(state: GameState, ship: Ship) {
  return sharedFindNearestEnemy(state, ship);
}
export function findNearbyEnemies(state: GameState, ship: Ship, range: number) {
  return sharedFindNearbyEnemies(state, ship, range);
}
export function findNearbyFriends(state: GameState, ship: Ship, range: number) {
  return sharedFindNearbyFriends(state, ship, range);
}
export function getDistance(a: Vector3, b: Vector3) {
  return sharedGetDistance(a, b);
}
export function calculateSeparationForceWithCount(state: GameState, ship: Ship) {
  const helper = new SpatialHelpers(state);
  return helper.calculateSeparationForceWithCount(ship);
}
