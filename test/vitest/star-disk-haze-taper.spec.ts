import { describe, expect, it } from 'vitest';
import { deriveHazeUniform } from '../../src/renderer/starDiskMaterial.js';

describe('deriveHazeUniform', () => {
  it('returns near-unity fade when facing the disk head-on', () => {
    const result = deriveHazeUniform(1, {
      taperStrength: 0.85,
      edgeFadeThreshold: 0.3,
      edgeExponent: 2,
    });

    expect(result.fade).toBeCloseTo(1, 3);
    expect(result.edgeThreshold).toBeCloseTo(0.3, 3);
    expect(result.edgeExponent).toBeCloseTo(2, 3);
  });

  it('collapses haze toward zero at grazing angles with full strength', () => {
    const result = deriveHazeUniform(0.05, {
      taperStrength: 1,
      edgeFadeThreshold: 0.4,
      edgeExponent: 2,
    });

    expect(result.fade).toBeLessThan(0.05);
    expect(result.edgeThreshold).toBeCloseTo(0.4, 3);
  });

  it('clamps invalid inputs and caps fade amplification', () => {
    const result = deriveHazeUniform(Number.NaN, {
      taperStrength: -1,
      edgeFadeThreshold: 2,
      edgeExponent: 12,
    });

    expect(result.fade).toBeGreaterThanOrEqual(0);
    expect(result.fade).toBeLessThanOrEqual(1.1);
    expect(result.edgeThreshold).toBeCloseTo(0.9, 3);
    expect(result.edgeExponent).toBeCloseTo(6, 3);
  });
});
