import { test, expect, vi } from 'vitest';
import * as rng from '../src/rng.js';
import { Ship } from '../src/entities.js';

// This test asserts that Ship construction consumes only a small, bounded number
// of srange calls depending on the chosen type. It does this by temporarily
// replacing rng.srange with a counter wrapper.

test('Ship constructor RNG consumption per type is bounded', () => {
  const origSrange = rng.srange;
  let calls = 0;
  const spy = vi.spyOn(rng, 'srange').mockImplementation((...args) => { calls++; return origSrange(...args); });

  // corvette: expect 3 srange calls in getClassConfig (maxSpeed, hp, reload)
  calls = 0;
  // construct corvette
  const s1 = new Ship(0, 0, 0, 'corvette');
  expect(calls).toBeGreaterThanOrEqual(3);
  expect(calls).toBeLessThanOrEqual(6);

  // carrier: should consume slightly more (launchBase + launchCooldown/amount)
  calls = 0;
  const s2 = new Ship(0, 0, 0, 'carrier');
  expect(calls).toBeGreaterThanOrEqual(4);
  expect(calls).toBeLessThanOrEqual(8);

  // restore
  spy.mockRestore();
});
