import { describe, it, expect } from 'vitest';

import { reFormFleets } from '../../../src/core/reFormFleets';

describe('reFormFleets', () => {
  it('positions ships within expected bounds and zeros velocity', () => {
    const state: any = {
      simConfig: { simBounds: { width: 2000, depth: 2000 } },
      ships: [],
      rng: { next: () => 0.5 },
    };

    // create some ships on both teams
    for (let i = 0; i < 6; i++) {
      state.ships.push({
        id: i + 1,
        team: i < 3 ? 'red' : 'blue',
        pos: { x: 0, y: 0, z: 0 },
        vel: { x: 1, y: 1, z: 1 },
      });
    }

    reFormFleets(state);

    for (const s of state.ships) {
      // velocity should be zeroed
      expect(s.vel.x).toBe(0);
      expect(s.vel.y).toBe(0);
      expect(s.vel.z).toBe(0);
      // position x should be within sim bounds horizontally
      expect(s.pos.x).toBeGreaterThanOrEqual(0);
      expect(s.pos.x).toBeLessThanOrEqual(state.simConfig.simBounds.width);
      // y should be >= base spawn y (400)
      expect(s.pos.y).toBeGreaterThanOrEqual(400);
      // z should be within depth +/- 50 because rng.next() returns 0.5 (centered)
      expect(Math.abs(s.pos.z - state.simConfig.simBounds.depth / 2)).toBeLessThanOrEqual(50);
    }
  });
});
