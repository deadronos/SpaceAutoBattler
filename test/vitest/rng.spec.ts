import { describe, it, expect } from 'vite-plus/test';
import { SeededRng } from '../../src/utils/rng.js';

describe('SeededRng', () => {
  it('produces deterministic sequence for same seed', () => {
    const a = new SeededRng(123);
    const b = new SeededRng(123);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('treats seed 0 as non-zero and matches seed 1 sequence', () => {
    const zero = new SeededRng(0);
    const one = new SeededRng(1);
    const seq0 = [zero.next(), zero.next(), zero.next()];
    const seq1 = [one.next(), one.next(), one.next()];
    expect(seq0).toEqual(seq1);
    // and values are within (0,1)
    for (const v of seq0) expect(v).toBeGreaterThan(0);
  });

  it('range(min,max) returns values within [min, max)', () => {
    const rng = new SeededRng(42);
    for (let i = 0; i < 100; i++) {
      const v = rng.range(-5, 7.5);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(7.5);
    }
  });

  it('int(min,max) returns inclusive integers', () => {
    const rng = new SeededRng(999);
    const seen = new Set<number>();
    const min = 2;
    const max = 5;
    for (let i = 0; i < 200; i++) seen.add(rng.int(min, max));
    // Should only contain integers in [min,max]
    for (const v of seen) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
    }
    // Likely to have seen all values in small range
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  it('pick() chooses from provided array deterministically', () => {
    const rngA = new SeededRng(321);
    const rngB = new SeededRng(321);
    const values = ['a', 'b', 'c', 'd'] as const;
    const seqA = [rngA.pick(values), rngA.pick(values), rngA.pick(values)];
    const seqB = [rngB.pick(values), rngB.pick(values), rngB.pick(values)];
    expect(seqA).toEqual(seqB);
    for (const v of seqA) expect(values.includes(v as any)).toBe(true);
  });
});
