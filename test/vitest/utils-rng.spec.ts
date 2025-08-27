import { describe, test, expect, beforeEach } from 'vitest';
import { createRNG } from '../../src/utils/rng.js';
import type { RNG } from '../../src/types/index.js';

describe('RNG Utility', () => {
  let rng: RNG;

  beforeEach(() => {
    rng = createRNG('test-seed');
  });

  describe('RNG Creation', () => {
    test('should create RNG with seed', () => {
      const testRng = createRNG('my-seed');
      expect(testRng).toHaveProperty('seed');
      expect(testRng).toHaveProperty('next');
      expect(testRng).toHaveProperty('int');
      expect(testRng).toHaveProperty('pick');
      expect(testRng.seed).toBe('my-seed');
    });

    test('should create different RNGs with different seeds', () => {
      const rng1 = createRNG('seed1');
      const rng2 = createRNG('seed2');

      // Generate a few numbers from each
      const nums1 = Array.from({ length: 5 }, () => rng1.next());
      const nums2 = Array.from({ length: 5 }, () => rng2.next());

      // They should be different (with very high probability)
      expect(nums1).not.toEqual(nums2);
    });

    test('should create identical RNGs with same seed', () => {
      const rng1 = createRNG('same-seed');
      const rng2 = createRNG('same-seed');

      // Generate the same sequence
      const nums1 = Array.from({ length: 10 }, () => rng1.next());
      const nums2 = Array.from({ length: 10 }, () => rng2.next());

      expect(nums1).toEqual(nums2);
    });
  });

  describe('next() method', () => {
    test('should return values between 0 and 1', () => {
      for (let i = 0; i < 100; i++) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    test('should produce different values', () => {
      const values = Array.from({ length: 100 }, () => rng.next());
      const uniqueValues = new Set(values);

      // Should have mostly unique values (allowing for some collisions)
      expect(uniqueValues.size).toBeGreaterThan(50);
    });

    test('should be deterministic with same seed', () => {
      const rng1 = createRNG('deterministic-test');
      const rng2 = createRNG('deterministic-test');

      const sequence1 = Array.from({ length: 20 }, () => rng1.next());
      const sequence2 = Array.from({ length: 20 }, () => rng2.next());

      expect(sequence1).toEqual(sequence2);
    });

    test('should have uniform distribution', () => {
      const values = Array.from({ length: 1000 }, () => rng.next());
      const buckets = new Array(10).fill(0);

      // Count values in each decile
      values.forEach(value => {
        const bucket = Math.floor(value * 10);
        buckets[bucket]++;
      });

      // Each bucket should have roughly 100 values (with some tolerance)
      buckets.forEach(count => {
        expect(count).toBeGreaterThan(70); // Allow 30% variance
        expect(count).toBeLessThan(130);
      });
    });
  });

  describe('int() method', () => {
    test('should return integers within range', () => {
      for (let i = 0; i < 100; i++) {
        const value = rng.int(5, 15);
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThanOrEqual(15);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    test('should handle min equals max', () => {
      const value = rng.int(10, 10);
      expect(value).toBe(10);
    });

    test('should be deterministic', () => {
      const rng1 = createRNG('int-test');
      const rng2 = createRNG('int-test');

      const values1 = Array.from({ length: 10 }, () => rng1.int(1, 100));
      const values2 = Array.from({ length: 10 }, () => rng2.int(1, 100));

      expect(values1).toEqual(values2);
    });

    test('should cover full range', () => {
      const min = 1;
      const max = 10;
      const values = new Set<number>();

      // Generate enough values to likely cover the range
      for (let i = 0; i < 1000; i++) {
        values.add(rng.int(min, max));
      }

      // Should have seen most values in range
      expect(values.size).toBeGreaterThan(5); // At least half the range
      expect(values.has(min)).toBe(true);
      expect(values.has(max)).toBe(true);
    });
  });

  describe('pick() method', () => {
    test('should return elements from array', () => {
      const array = ['a', 'b', 'c', 'd'];
      const picked = rng.pick(array);

      expect(array).toContain(picked);
    });

    test('should handle single element array', () => {
      const array = ['only'];
      const picked = rng.pick(array);

      expect(picked).toBe('only');
    });

    test('should handle empty array', () => {
      const array: string[] = [];
      expect(() => rng.pick(array)).toThrow();
    });

    test('should be deterministic', () => {
      const rng1 = createRNG('pick-test');
      const rng2 = createRNG('pick-test');
      const array = ['red', 'blue', 'green', 'yellow'];

      const picks1 = Array.from({ length: 10 }, () => rng1.pick(array));
      const picks2 = Array.from({ length: 10 }, () => rng2.pick(array));

      expect(picks1).toEqual(picks2);
    });

    test('should distribute picks uniformly', () => {
      const array = ['A', 'B', 'C', 'D'];
      const counts = { A: 0, B: 0, C: 0, D: 0 };

      // Generate many picks
      for (let i = 0; i < 400; i++) {
        const pick = rng.pick(array);
        counts[pick as keyof typeof counts]++;
      }

      // Each option should be picked roughly 100 times
      Object.values(counts).forEach(count => {
        expect(count).toBeGreaterThan(70); // Allow 30% variance
        expect(count).toBeLessThan(130);
      });
    });
  });

  describe('RNG Determinism and Reproducibility', () => {
    test('should reproduce exact sequence with same seed', () => {
      const seed = 'reproducibility-test';
      const rng1 = createRNG(seed);
      const rng2 = createRNG(seed);

      // Generate long sequence
      const sequence1 = {
        next: Array.from({ length: 50 }, () => rng1.next()),
        ints: Array.from({ length: 20 }, () => rng1.int(0, 1000)),
        picks: Array.from({ length: 15 }, () => rng1.pick(['X', 'Y', 'Z']))
      };

      // Reset and generate again
      const rng3 = createRNG(seed);
      const sequence2 = {
        next: Array.from({ length: 50 }, () => rng3.next()),
        ints: Array.from({ length: 20 }, () => rng3.int(0, 1000)),
        picks: Array.from({ length: 15 }, () => rng3.pick(['X', 'Y', 'Z']))
      };

      expect(sequence1).toEqual(sequence2);
    });

    test('should maintain determinism across different operations', () => {
      const rng1 = createRNG('mixed-ops-1');
      const rng2 = createRNG('mixed-ops-2');

      // Interleave different operations
      const operations1 = [];
      const operations2 = [];

      for (let i = 0; i < 20; i++) {
        operations1.push(rng1.next());
        operations1.push(rng1.int(0, 10));
        operations1.push(rng1.pick(['a', 'b']));

        operations2.push(rng2.next());
        operations2.push(rng2.int(0, 10));
        operations2.push(rng2.pick(['a', 'b']));
      }

      // Same seed should produce same results
      const rng1Again = createRNG('mixed-ops-1');
      const operations1Again = [];

      for (let i = 0; i < 60; i++) {
        if (i % 3 === 0) operations1Again.push(rng1Again.next());
        else if (i % 3 === 1) operations1Again.push(rng1Again.int(0, 10));
        else operations1Again.push(rng1Again.pick(['a', 'b']));
      }

      expect(operations1).toEqual(operations1Again);
      expect(operations1).not.toEqual(operations2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle extreme seeds', () => {
      const extremeSeeds = [
        '',
        'a'.repeat(100),
        'special-chars-!@#$%^&*()',
        'unicode-🚀🌟💫',
        'very-long-seed-that-might-cause-issues-with-hash-function-and-should-still-work-properly'
      ];

      extremeSeeds.forEach(seed => {
        const testRng = createRNG(seed);
        expect(() => testRng.next()).not.toThrow();
        expect(() => testRng.int(0, 1)).not.toThrow();
        expect(() => testRng.pick(['test'])).not.toThrow();
      });
    });

    test('should handle large ranges in int()', () => {
      const largeMin = -1000000;
      const largeMax = 1000000;

      for (let i = 0; i < 100; i++) {
        const value = rng.int(largeMin, largeMax);
        expect(value).toBeGreaterThanOrEqual(largeMin);
        expect(value).toBeLessThanOrEqual(largeMax);
      }
    });

    test('should handle very small ranges in int()', () => {
      for (let i = 0; i < 100; i++) {
        const value = rng.int(0, 1);
        expect([0, 1]).toContain(value);
      }
    });
  });

  describe('Statistical Properties', () => {
    test('should pass basic randomness tests', () => {
      const values = Array.from({ length: 10000 }, () => rng.next());

      // Mean should be close to 0.5
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      expect(mean).toBeCloseTo(0.5, 1);

      // Variance should be reasonable
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      expect(variance).toBeGreaterThan(0.05);
      expect(variance).toBeLessThan(0.15);
    });

    test('should not have obvious patterns', () => {
      const sequence = Array.from({ length: 1000 }, () => rng.next());

      // Check for alternating patterns (should be rare)
      let alternations = 0;
      for (let i = 1; i < sequence.length; i++) {
        if ((sequence[i] > 0.5) !== (sequence[i - 1] > 0.5)) {
          alternations++;
        }
      }

      // Should have roughly 50% alternations
      const alternationRate = alternations / (sequence.length - 1);
      expect(alternationRate).toBeGreaterThan(0.4);
      expect(alternationRate).toBeLessThan(0.6);
    });
  });
});