import { test, expect } from 'vitest';
import { srand } from '../src/rng.js';
import { initStars, createStarCanvas } from '../src/gamemanager.js';

test('initStars populates state.stars deterministically when seeded', () => {
  const state1 = { stars: [] };
  const state2 = { stars: [] };
  srand(777);
  initStars(state1, 200, 100, 10);
  srand(777);
  initStars(state2, 200, 100, 10);
  expect(state1.stars.length).toBe(10);
  expect(state1.stars.map(s => `${s.x.toFixed(2)},${s.y.toFixed(2)}`)).toEqual(state2.stars.map(s => `${s.x.toFixed(2)},${s.y.toFixed(2)}`));
});

test('createStarCanvas throws when state missing', () => {
  expect(() => createStarCanvas(null, 200, 100)).toThrow();
});
