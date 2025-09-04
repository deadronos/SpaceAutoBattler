import type { GameState, Ship, Vector3 } from '../../types/index.js';
import { getDistance as sharedGetDistance, findNearbyEnemies as sharedFindNearbyEnemies, findNearbyFriends as sharedFindNearbyFriends, findNearestEnemy as sharedFindNearestEnemy, getNearbySeparationShipsLinear as sharedGetNearbySeparationShipsLinear } from '../searchUtils.js';
import { calculateSeparationForceWithCount as steeringSeparation } from './steering.js';
import { DEBUG_AI } from '../../utils/env';

export class SpatialHelpers {
  private state: GameState;
  private sepCache: Map<number, { x: number; y: number; z: number; sepDist: number; tick: number; res: { force: Vector3; neighborCount: number } } > = new Map();
  private spatialGridUpdated = false;
  constructor(state: GameState) { this.state = state; }
  resetTick() { this.spatialGridUpdated = false; }
  ensureUpdated() {
    if (!this.state.spatialGrid || this.spatialGridUpdated) return;
    if (this.state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      // SpatialGrid API uses rebuild in this project
      (this.state.spatialGrid as any).rebuild?.(this.state.ships);
    }
    this.spatialGridUpdated = true;
  }
  calculateSeparationForceWithCount(ship: Ship): { force: Vector3; neighborCount: number } {
    const separationDistance = this.state.behaviorConfig!.globalSettings.separationDistance;
    const magnitudeThreshold = this.state.behaviorConfig!.globalSettings.separationVectorMagnitudeThreshold || 0.0001;
    const cached = this.sepCache.get(ship.id);
    if (this.state.spatialGrid && this.state.behaviorConfig?.globalSettings.enableSpatialIndex) {
      if (cached && cached.tick === this.state.tick && cached.sepDist === separationDistance && cached.x === ship.pos.x && cached.y === ship.pos.y && cached.z === ship.pos.z) {
        return cached.res;
      }
      this.ensureUpdated();
      const neighbors: Vector3[] = [];
      this.state.spatialGrid.forEachNeighborsDelta(
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
      try {
        if (DEBUG_AI) {
          console.error(`AI-DEBUG spatial ship=${ship.id} usingGrid=true neighborsFound=${neighbors.length}`);
        }
      } catch {
        console.error('AI-DEBUG spatial log failed');
      }
      const res = steeringSeparation(ship.pos, neighbors, separationDistance, magnitudeThreshold, () => this.state.rng.next());
      this.sepCache.set(ship.id, { x: ship.pos.x, y: ship.pos.y, z: ship.pos.z, sepDist: separationDistance, tick: this.state.tick, res });
      return res;
    }
    const nearby = sharedGetNearbySeparationShipsLinear(this.state, ship, separationDistance);
    if (DEBUG_AI) {
      console.error(`AI-DEBUG spatial ship=${ship.id} usingGrid=false neighborsFound=${nearby.length}`);
    }
    const neighborPositions = nearby.map(o => o.pos);
    const res = steeringSeparation(ship.pos, neighborPositions, separationDistance, magnitudeThreshold, () => this.state.rng.next());
    return res;
  }
}

export function ensureSpatialGridUpdated(state: GameState) {
  if (!state.spatialGrid) return;
  if (!state.behaviorConfig?.globalSettings.enableSpatialIndex) return;
  (state.spatialGrid as any).rebuild?.(state.ships);
}

export function findNearestEnemy(state: GameState, ship: Ship) { return sharedFindNearestEnemy(state, ship); }
export function findNearbyEnemies(state: GameState, ship: Ship, range: number) { return sharedFindNearbyEnemies(state, ship, range); }
export function findNearbyFriends(state: GameState, ship: Ship, range: number) { return sharedFindNearbyFriends(state, ship, range); }
export function getDistance(a: Vector3, b: Vector3) { return sharedGetDistance(a, b); }
export function calculateSeparationForceWithCount(state: GameState, ship: Ship) {
  const helper = new SpatialHelpers(state);
  return helper.calculateSeparationForceWithCount(ship);
}
