import { expect, test } from 'vitest';
import { createRNG } from '../../../src/utils/rng';

test('createRNG deterministic sequence and int/pick', () => {
  const a = createRNG('seed1');
  const b = createRNG('seed1');
  // next should produce same sequence
  expect(a.next()).toBeCloseTo(b.next());
  expect(a.next()).toBeCloseTo(b.next());

  // int range
  const n = a.int(1, 10);
  expect(n).toBeGreaterThanOrEqual(1);
  expect(n).toBeLessThanOrEqual(10);

  // pick from array
  const arr = ['x', 'y', 'z'];
  const p = a.pick(arr);
  expect(arr.includes(p)).toBe(true);
});

test('pick from empty throws', () => {
  const a = createRNG('seed2');
  expect(() => a.pick([])).toThrow();
});
