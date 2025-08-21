import { test, expect } from 'vitest';
import { srand } from '../src/rng.js';
import { initStars, reset, stars } from '../src/gamemanager.js';

// Helper to snapshot a few sample star properties for quick equality checks
function sampleStars(arr, indices = [0, 1, 2, 10, 50]) {
  return indices.map(i => {
    const s = arr[i % arr.length];
    return { x: Math.round(s.x * 1000) / 1000, y: Math.round(s.y * 1000) / 1000, r: Math.round(s.r * 1000) / 1000, a: Math.round(s.a * 1000) / 1000 };
  });
}

test('initStars is deterministic when seeded via srand + initStars', () => {
  srand(12345);
  initStars(800, 600, 140);
  const first = sampleStars(stars);

  // regenerate with same seed
  srand(12345);
  initStars(800, 600, 140);
  const second = sampleStars(stars);

  expect(first).toEqual(second);
});

test('reset(seed) seeds and produces same starfield', () => {
  reset(54321);
  const first = sampleStars(stars);

  reset(54321);
  const second = sampleStars(stars);

  expect(first).toEqual(second);
});

test('different seeds produce different starfields (likely)', () => {
  reset(1000);
  const a = sampleStars(stars);
  reset(1001);
  const b = sampleStars(stars);

  // It's possible by extreme chance some samples match; assert not all equal
  const allEqual = a.every((v, i) => JSON.stringify(v) === JSON.stringify(b[i]));
  expect(allEqual).toBe(false);
});
