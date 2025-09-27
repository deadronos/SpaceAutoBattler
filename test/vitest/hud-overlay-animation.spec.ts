import { describe, expect, it } from 'vitest';
import { lerpBySeed, smoothingFactorFromSeed } from '../../src/utils/deterministicLerp.js';

describe('deterministic overlay animation', () => {
  it('produces stable smoothing factors for identical seeds', () => {
    const a = smoothingFactorFromSeed(42);
    const b = smoothingFactorFromSeed(42);
    expect(a).toBeCloseTo(b);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
  });

  it('approaches the target deterministically based on seed', () => {
    const first = lerpBySeed(1337, 0.1, 0.9);
    const second = lerpBySeed(1337, first, 0.9);
    expect(first).toBeGreaterThan(0.1);
    expect(second).toBeGreaterThan(first);
    const differentSeed = lerpBySeed(99, 0.1, 0.9);
    expect(differentSeed).not.toBe(first);
  });

  it('returns target immediately when previous is NaN', () => {
    expect(lerpBySeed(55, Number.NaN, 0.75)).toBe(0.75);
  });
});
