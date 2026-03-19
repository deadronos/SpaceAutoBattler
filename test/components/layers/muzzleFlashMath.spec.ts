import { describe, it, expect } from 'vite-plus/test';
import { computeMuzzleFlashVisuals } from '../../../src/components/layers/muzzleFlashMath.js';

describe('computeMuzzleFlashVisuals', () => {
  it('returns full fade and base scale at time zero', () => {
    const result = computeMuzzleFlashVisuals({
      baseScale: 2,
      amplitude: 1,
      lifetime: 0.25,
      elapsed: 0,
    });
    expect(result.fade).toBeCloseTo(1);
    expect(result.scale).toBeCloseTo(2); // 0.6 + 0.4 * 1 = 1
    expect(result.intensity).toBeCloseTo(1);
  });

  it('decays scale and intensity over time', () => {
    const result = computeMuzzleFlashVisuals({
      baseScale: 1,
      amplitude: 1,
      lifetime: 1,
      elapsed: 0.5,
    });
    expect(result.fade).toBeCloseTo(0.5);
    expect(result.scale).toBeCloseTo(0.8); // 1 * (0.6 + 0.4 * 0.5)
    expect(result.intensity).toBeCloseTo(0.7 + 0.3 * 0.5);
  });

  it('clamps elapsed beyond lifetime', () => {
    const result = computeMuzzleFlashVisuals({
      baseScale: 1,
      amplitude: 2,
      lifetime: 0.3,
      elapsed: 2,
    });
    expect(result.fade).toBeCloseTo(0);
    expect(result.scale).toBeCloseTo(1 * 2 * 0.6);
    expect(result.intensity).toBeCloseTo(0.7);
  });

  it('guards against negative amplitude', () => {
    const result = computeMuzzleFlashVisuals({
      baseScale: 1,
      amplitude: -3,
      lifetime: 1,
      elapsed: 0,
    });
    expect(result.scale).toBe(0);
  });
});
