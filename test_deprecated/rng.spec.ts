import { describe, it, expect } from 'vitest';
import { srand, srandom, srange, srangeInt } from '../../src/rng';

describe('rng.ts', () => {
  it('produces deterministic sequence after seeding', () => {
    srand(12345);
    const a = [srandom(), srandom(), srandom()];
    srand(12345);
    const b = [srandom(), srandom(), srandom()];
    expect(a).toEqual(b);
  });

  it('srange and srangeInt are within bounds', () => {
    srand(1);
    for (let i = 0; i < 10; i++) {
      const v = srange(-5, 5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(5);
      const vi = srangeInt(0, 10);
      expect(vi).toBeGreaterThanOrEqual(0);
      expect(vi).toBeLessThan(10);
    }
  });
});
