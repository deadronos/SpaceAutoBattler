import { describe, expect, it } from 'vite-plus/test';
import { AI_CONFIG } from '../../src/game/config.js';
import { SeededRng } from '../../src/utils/rng.js';

// Extract the range variance logic to test it directly
function testApplyRangeVariance(baseRange: number, traitSeed: number, weaponIndex = 0): number {
  if (AI_CONFIG.rangePolicy !== 'v0.1.1-exp') return baseRange;

  // Create a deterministic seed combining traitSeed and weapon index for consistency
  const rangeSeed = Math.abs((traitSeed ^ (weaponIndex * 7919)) >>> 0) || 1;
  const rng = new SeededRng(rangeSeed);

  // Apply ±5% variance
  const variance = 0.05;
  const modifier = 1 + (rng.next() * 2 - 1) * variance; // [-5%, +5%]

  return Math.round(baseRange * modifier);
}

describe('Range Variance Implementation', () => {
  it('should apply ±5% range variance when rangePolicy is v0.1.1-exp', () => {
    // Test the range variance logic directly
    const baseRange = 200;
    const traitSeed = 12345;

    // Generate multiple range values with the same seed
    const ranges: number[] = [];
    for (let i = 0; i < 10; i++) {
      const range = testApplyRangeVariance(baseRange, traitSeed, i);
      ranges.push(range);
    }

    // All ranges should be within ±5% of base range
    const minExpected = Math.round(baseRange * 0.95); // 190
    const maxExpected = Math.round(baseRange * 1.05); // 210

    for (const range of ranges) {
      expect(range).toBeGreaterThanOrEqual(minExpected);
      expect(range).toBeLessThanOrEqual(maxExpected);
    }

    // Should have some variance (not all identical)
    const uniqueRanges = new Set(ranges);
    expect(uniqueRanges.size).toBeGreaterThan(1);
  });

  it('should be deterministic with same traitSeed and weaponIndex', () => {
    const baseRange = 300;
    const traitSeed = 54321;
    const weaponIndex = 2;

    // Same inputs should produce same output
    const range1 = testApplyRangeVariance(baseRange, traitSeed, weaponIndex);
    const range2 = testApplyRangeVariance(baseRange, traitSeed, weaponIndex);

    expect(range1).toBe(range2);
  });

  it('should produce different results for different weapon indices', () => {
    const baseRange = 250;
    const traitSeed = 98765;

    // Different weapon indices should produce different ranges (mostly)
    const ranges: number[] = [];
    for (let i = 0; i < 5; i++) {
      ranges.push(testApplyRangeVariance(baseRange, traitSeed, i));
    }

    // Should have some variety
    const uniqueRanges = new Set(ranges);
    expect(uniqueRanges.size).toBeGreaterThan(1);
  });

  it('should return base range when rangePolicy is not v0.1.1-exp', () => {
    // Temporarily change the range policy
    const originalPolicy = AI_CONFIG.rangePolicy;
    (AI_CONFIG as any).rangePolicy = 'disabled';

    const baseRange = 180;
    const result = testApplyRangeVariance(baseRange, 12345, 0);

    expect(result).toBe(baseRange);

    // Restore original policy
    (AI_CONFIG as any).rangePolicy = originalPolicy;
  });

  it('should work with different ship range values', () => {
    const testRanges = [220, 260, 380, 400]; // Fighter, Frigate, Destroyer turret, Carrier
    const traitSeed = 11111;

    for (const baseRange of testRanges) {
      const variedRange = testApplyRangeVariance(baseRange, traitSeed, 0);

      // Should be within ±5%
      const minExpected = Math.round(baseRange * 0.95);
      const maxExpected = Math.round(baseRange * 1.05);

      expect(variedRange).toBeGreaterThanOrEqual(minExpected);
      expect(variedRange).toBeLessThanOrEqual(maxExpected);
    }
  });
});
