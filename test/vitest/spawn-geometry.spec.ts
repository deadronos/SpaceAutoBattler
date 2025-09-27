import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createGameState, disposeGameState, spawnInitialFleets } from '../../src/game/state.js';
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
      expect(separation).toBeGreaterThanOrEqual(expected * 0.9);
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
});
