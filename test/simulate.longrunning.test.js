import { test, expect } from 'vitest';
import { reset, simulate, ships, bullets, particles } from '../src/gamemanager.js';

test('long-running simulate stability (many small steps)', () => {
  reset();
  const W = 320, H = 180;
  for (let i = 0; i < 200; i++) {
    // step with small dt
    const state = simulate(1/60, W, H);
    // ensure arrays exist and not exploding
    expect(Array.isArray(state.ships)).toBe(true);
    expect(Array.isArray(state.bullets)).toBe(true);
    expect(Array.isArray(state.particles)).toBe(true);
    // bounds checks
    for (const s of state.ships) {
      expect(s.x).toBeGreaterThanOrEqual(0 - 1000); // allow movement wrap
      expect(s.y).toBeGreaterThanOrEqual(0 - 1000);
    }
  }
  // arrays remain present (no runaway memory cleared)
  expect(Array.isArray(ships)).toBe(true);
  expect(Array.isArray(bullets)).toBe(true);
  expect(Array.isArray(particles)).toBe(true);
});
