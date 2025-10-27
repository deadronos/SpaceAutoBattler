import { describe, expect, it } from 'vitest';
import {
  clamp01,
  deriveBoundaryUniform,
  deriveHazeUniform,
} from '../../src/renderer/starDisk/uniforms.js';

describe('starDisk uniform helpers', () => {
  it('clamp01 bounds numbers between 0 and 1', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.42)).toBeCloseTo(0.42);
    expect(clamp01(2)).toBe(1);
  });

  it('deriveBoundaryUniform clamps invalid inputs into safe ranges', () => {
    const result = deriveBoundaryUniform({
      featherStart: -5,
      featherExponent: 100,
      alphaFloor: -0.25,
    });
    expect(result.start).toBeCloseTo(0.6);
    expect(result.exponent).toBeCloseTo(6);
    expect(result.alphaFloor).toBeCloseTo(0);
    expect(result.reserved).toBe(0);
  });

  it('deriveBoundaryUniform falls back to defaults when values are NaN', () => {
    const result = deriveBoundaryUniform({
      featherStart: Number.NaN,
      featherExponent: Number.NaN,
      alphaFloor: Number.NaN,
    });
    expect(result.start).toBeCloseTo(0.875);
    expect(result.exponent).toBeCloseTo(1.75);
    expect(result.alphaFloor).toBeCloseTo(0.05);
  });

  it('deriveHazeUniform handles invalid facing cosine and out-of-range config', () => {
    const result = deriveHazeUniform(Number.NaN, {
      taperStrength: -10,
      edgeFadeThreshold: 5,
      edgeExponent: 500,
    });
    expect(result.edgeThreshold).toBeLessThanOrEqual(0.9);
    expect(result.edgeExponent).toBeLessThanOrEqual(6);
    expect(result.fade).toBeGreaterThanOrEqual(0);
    expect(result.fade).toBeLessThanOrEqual(1.1);
  });

  it('deriveHazeUniform respects view alignment when facing away from the disk', () => {
    const result = deriveHazeUniform(-0.25, {
      taperStrength: 0.8,
      edgeFadeThreshold: 0.3,
      edgeExponent: 2,
    });
    expect(result.fade).toBeGreaterThanOrEqual(0);
    expect(result.fade).toBeLessThanOrEqual(1.1);
    expect(result.edgeThreshold).toBeCloseTo(0.3);
    expect(result.edgeExponent).toBeCloseTo(2);
  });
});
