import { describe, it, expect } from 'vitest';
import { srand, srandom, srange, srangeInt, unseed } from '../src/rng.js';

describe('RNG deterministic behavior', () => {
  it('produces deterministic sequence with seed', () => {
    srand(42);
    const a = [srandom(), srandom(), srandom()];
    srand(42);
    const b = [srandom(), srandom(), srandom()];
    expect(a).toEqual(b);
  });

  it('srangeInt produces values within bounds', () => {
    srand(123);
    for (let i = 0; i < 50; i++) {
      const v = srangeInt(1, 5);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(5);
    }
    unseed();
  });
});
