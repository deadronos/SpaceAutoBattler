import { test, expect, vi } from 'vitest';
import * as rng from '../src/rng.js';
import { Ship, getClassConfig, createShipWithConfig } from '../src/entities.js';

// This test asserts that Ship construction consumes only a small, bounded number
// of srange calls depending on the chosen type. It does this by temporarily
// replacing rng.srange with a counter wrapper.

test('Ship constructor RNG consumption per type is bounded', () => {
  const origSrange = rng.srange;
  let calls = 0;
  const spy = vi.spyOn(rng, 'srange').mockImplementation((...args) => { calls++; return origSrange(...args); });

  // corvette: expect 3 srange calls in getClassConfig (maxSpeed, hp, reload)
  calls = 0;
  // construct corvette by precomputing cfg
  const cfg1 = getClassConfig('corvette');
  const s1 = createShipWithConfig(0, 0, 0, 'corvette', cfg1);
  expect(calls).toBeGreaterThanOrEqual(3);
  expect(calls).toBeLessThanOrEqual(6);

  // carrier: should consume slightly more (launchBase + launchCooldown/amount)
  calls = 0;
  const cfg2 = getClassConfig('carrier');
  const s2 = createShipWithConfig(0, 0, 0, 'carrier', cfg2);
  expect(calls).toBeGreaterThanOrEqual(4);
  expect(calls).toBeLessThanOrEqual(8);

  // restore
  spy.mockRestore();
});
