import { describe, it, expect } from 'vitest';
import { getDistance, findNearestEnemy, findNearbyEnemies, findNearbyFriends, getNearbySeparationShipsLinear } from '../../src/core/searchUtils.js';
import { SpatialGrid } from '../../src/utils/spatialGrid.js';

// Minimal type-like mocks matching the project's shapes
function makeShip(id: number, team: 'red' | 'blue', x: number, y: number, z = 0, health = 100) {
  // Cast to any so we don't need to construct the full Ship shape in tests
  return { id, team, pos: { x, y, z }, health } as any;
}

function makeState(ships: any[], useSpatial = false) {
  const shipIndex = new Map();
  for (const s of ships) shipIndex.set(s.id, s);
  const state: any = {
    ships,
    shipIndex,
    behaviorConfig: { globalSettings: { enableSpatialIndex: useSpatial } },
    simConfig: { simBounds: { width: 1000, height: 1000, depth: 1000 }, boundaryBehavior: { ships: 'wrap', bullets: 'wrap' } }
  };
  if (useSpatial) state.spatialGrid = new SpatialGrid(64, state.simConfig.simBounds);
  return state;
}

describe('searchUtils', () => {
  it('getDistance returns Euclidean distance', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 3, y: 4, z: 0 };
    expect(getDistance(a, b)).toBeCloseTo(5);
  });

  it('findNearestEnemy works with linear fallback', () => {
    const ships = [makeShip(1, 'red', 0, 0), makeShip(2, 'blue', 10, 0), makeShip(3, 'blue', 30, 0)];
    const state = makeState(ships, false);
    const nearest = findNearestEnemy(state, ships[0]);
    expect(nearest?.id).toBe(2);
  });

  it('findNearbyEnemies returns correct set (linear)', () => {
    const ships = [makeShip(1, 'red', 0, 0), makeShip(2, 'blue', 10, 0), makeShip(3, 'blue', 40, 0)];
    const state = makeState(ships, false);
    const nearby = findNearbyEnemies(state, ships[0], 20);
    expect(nearby.map(s => s.id).sort()).toEqual([2]);
  });

  it('findNearbyFriends returns correct set (linear)', () => {
    const ships = [makeShip(1, 'red', 0, 0), makeShip(2, 'red', 5, 0), makeShip(3, 'blue', 5, 0)];
    const state = makeState(ships, false);
    const friends = findNearbyFriends(state, ships[0], 10);
    expect(friends.map(s => s.id).sort()).toEqual([2]);
  });

  it('getNearbySeparationShipsLinear returns only close friends', () => {
    const ships = [makeShip(1, 'red', 0, 0), makeShip(2, 'red', 1, 1), makeShip(3, 'red', 10, 10), makeShip(4, 'blue', 0, 1)];
    const state = makeState(ships, false);
    const nearby = getNearbySeparationShipsLinear(state, ships[0], 2);
    expect(nearby.map(s => s.id).sort()).toEqual([2]);
  });

  it('findNearestEnemy prefers spatial index when enabled', () => {
    const ships = [makeShip(1, 'red', 0, 0), makeShip(2, 'blue', 300, 0), makeShip(3, 'blue', 10, 0)];
    const state = makeState(ships, true);
    // Populate spatial grid
    for (const s of ships) state.spatialGrid.insert({ id: s.id, pos: s.pos, radius: 16, team: s.team });
    const nearest = findNearestEnemy(state, ships[0]);
    expect(nearest?.id).toBe(3);
  });
});
