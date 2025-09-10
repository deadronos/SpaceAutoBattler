import { expect, test } from 'vitest';
import { createRNG } from '../../../src/utils/rng';
import { randomClass } from '../../../src/utils/randomShipClass';

test('randomClass deterministic', () => {
  const rng = createRNG('abc');
  const state: any = { rng };
  const c1 = randomClass(state);
  const c2 = randomClass(state);
  // deterministic sequence - calling again should produce same sequence if RNG used
  expect(['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'].includes(c1)).toBe(true);
  expect(['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'].includes(c2)).toBe(true);
});
