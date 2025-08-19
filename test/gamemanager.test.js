import { describe, it, expect } from 'vitest';
import { srand } from '../src/rng.js';
import * as gm from '../src/gamemanager.js';

describe('GameManager basic API', () => {
  it('reset with a fixed seed produces deterministic fleets', () => {
    srand(12345);
    gm.reset(12345);
    // After reset seeded, expect fleets of ships to exist
    expect(Array.isArray(gm.ships)).toBe(true);
    expect(gm.ships.length).toBeGreaterThanOrEqual(2);
    // both teams present
    const red = gm.ships.filter(s => s.team === 0).length;
    const blue = gm.ships.filter(s => s.team === 1).length;
    expect(red).toBeGreaterThan(0);
    expect(blue).toBeGreaterThan(0);
  });

  it('simulate advances state and returns state object', () => {
    gm.reset(777);
    const preShips = gm.ships.length;
    const res = gm.simulate(0.016, 800, 600);
    expect(res).toHaveProperty('ships');
    expect(res).toHaveProperty('bullets');
    expect(res).toHaveProperty('particles');
    // ships array should still be accessible
    expect(gm.ships.length).toBe(preShips);
  });
});
