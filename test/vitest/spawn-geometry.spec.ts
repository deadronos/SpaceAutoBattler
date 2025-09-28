import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createGameState, disposeGameState, spawnInitialFleets, spawnRandomShip } from '../../src/game/state.js';
import { SPAWN_CONFIG, WORLD_HALF } from '../../src/game/config.js';
import { SHIP_STATS } from '../../src/game/ships.js';
import type { ShipEntity } from '../../src/types/index.js';

function computeCentroid(ships: ShipEntity[], team: 'blue' | 'red'): Vector3 {
  const centroid = new Vector3();
  let count = 0;
  for (const ship of ships) {
    if (ship.ship.team !== team) continue;
    centroid.add(ship.transform.position);
    count += 1;
  }
  return count > 0 ? centroid.multiplyScalar(1 / count) : centroid;
}

describe('spawnInitialFleets', () => {
  it('separates teams by configured factor', async () => {
    const state = await createGameState();
    try {
      spawnInitialFleets(state);
      const ships = state.queries.ships.entities as ShipEntity[];
      const blueCentroid = computeCentroid(ships, 'blue');
      const redCentroid = computeCentroid(ships, 'red');
      const separation = Math.abs(blueCentroid.x - redCentroid.x);
      const maxRange = Math.max(...Object.values(SHIP_STATS).map((stats) => stats.range));
      const expected = maxRange * SPAWN_CONFIG.initialSeparationFactor;
      expect(separation).toBeGreaterThanOrEqual(expected);
    } finally {
      disposeGameState(state);
    }
  });

  it('applies vertical spread across formations', async () => {
    const state = await createGameState();
    try {
      spawnInitialFleets(state);
      const ships = state.queries.ships.entities as ShipEntity[];
      const blueHeights = ships.filter((s) => s.ship.team === 'blue').map((s) => Math.abs(s.transform.position.y));
      const maxHeight = Math.max(...blueHeights);
      const expectedSpread = WORLD_HALF * SPAWN_CONFIG.verticalSpreadFactor;
      expect(maxHeight).toBeGreaterThan(expectedSpread * 0.1);
    } finally {
      disposeGameState(state);
    }
  });

  it('produces deterministic vertical offsets for seed 1337', async () => {
    const stateA = await createGameState();
    const stateB = await createGameState();
    try {
      spawnInitialFleets(stateA);
      spawnInitialFleets(stateB);
      const shipsA = stateA.queries.ships.entities as ShipEntity[];
      const shipsB = stateB.queries.ships.entities as ShipEntity[];
      const serialize = (ships: ShipEntity[], team: 'blue' | 'red'): number[] =>
        ships
          .filter((ship) => ship.ship.team === team)
          .map((ship) => Number(ship.transform.position.y.toFixed(6)));
      expect(serialize(shipsA, 'blue')).toEqual(serialize(shipsB, 'blue'));
      expect(serialize(shipsA, 'red')).toEqual(serialize(shipsB, 'red'));
    } finally {
      disposeGameState(stateA);
      disposeGameState(stateB);
    }
  });

  it('ensures seeded vertical dispersion exceeds threshold', async () => {
    const state = await createGameState();
    try {
      spawnInitialFleets(state);
      const ships = state.queries.ships.entities as ShipEntity[];
      const absoluteHeights = ships.map((ship) => Math.abs(ship.transform.position.y)).sort((a, b) => a - b);
      const mid = Math.floor(absoluteHeights.length / 2);
      const median =
        absoluteHeights.length % 2 === 1
          ? absoluteHeights[mid]
          : (absoluteHeights[mid - 1] + absoluteHeights[mid]) * 0.5;
      expect(median).toBeGreaterThan(200);
    } finally {
      disposeGameState(state);
    }
  });
});

describe('spawnRandomShip', () => {
  it('keeps random spawns within configured vertical spread', async () => {
    const state = await createGameState();
    try {
      spawnRandomShip(state, 'blue');
      const ships = state.queries.ships.entities as ShipEntity[];
      const maxAllowed = WORLD_HALF * SPAWN_CONFIG.verticalSpreadFactor * 0.5;
      for (const ship of ships) {
        expect(Math.abs(ship.transform.position.y)).toBeLessThanOrEqual(maxAllowed + 1);
      }
    } finally {
      disposeGameState(state);
    }
  });
});
