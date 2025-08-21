import { test, expect } from 'vitest';
import { srand, unseed, srandom, srange, srangeInt, isSeeded } from '../src/rng.js';

test('srand(0) normalizes to seeded state and isSeeded true', () => {
  srand(0);
  expect(isSeeded()).toBe(true);
  const a = srandom();
  const b = srandom();
  expect(a).not.toBe(b);
  unseed();
  expect(isSeeded()).toBe(false);
});

test('srangeInt handles inverted args and inclusive bounds', () => {
  srand(12345);
  const vals = new Set();
  for (let i = 0; i < 100; i++) vals.add(srangeInt(5, 3));
  // values must be within [3,5]
  for (const v of vals) expect(v).toBeGreaterThanOrEqual(3) && expect(v).toBeLessThanOrEqual(5);
});

test('srange returns values in half-open interval [a,b)', () => {
  srand(42);
  for (let i = 0; i < 20; i++) {
    const v = srange(-1, 1);
    expect(v).toBeGreaterThanOrEqual(-1);
    expect(v).toBeLessThan(1);
  }
});
