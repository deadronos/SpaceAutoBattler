import { test, expect } from 'vitest';
import { simulateStep } from '../src/simulate.js';

test('simulateStep initializes missing arrays on empty state', () => {
  const state = {};
  // Should not throw and should populate expected arrays/objects
  expect(() => simulateStep(state, 0.016)).not.toThrow();
  expect(Array.isArray(state.ships)).toBe(true);
  expect(Array.isArray(state.bullets)).toBe(true);
  expect(Array.isArray(state.explosions)).toBe(true);
  expect(Array.isArray(state.shieldHits)).toBe(true);
  expect(Array.isArray(state.healthHits)).toBe(true);
  expect(state.score).toBeDefined();
  expect(typeof state.score.red).toBe('number');
  expect(typeof state.score.blue).toBe('number');
});
