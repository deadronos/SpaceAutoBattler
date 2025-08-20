import { describe, it, expect } from 'vitest';
import { srand, unseed, srandom, srange, srangeInt } from '../src/rng.js';

describe('rng (minimal)', () => {
  it('srand produces deterministic sequence', () => {
    srand(1234);
    const a = srandom();
    srand(1234);
    const b = srandom();
    expect(a).toBeCloseTo(b);
  });

  it('srangeInt returns within bounds', () => {
    srand(42);
    const v = srangeInt(1, 3);
    expect([1,2,3]).toContain(v);
  });

  it('unseed falls back to Math.random', () => {
    unseed();
    const v = srandom();
    expect(typeof v).toBe('number');
  });
});
