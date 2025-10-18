import { describe, expect, it } from 'vitest';
import { deriveBoundaryUniform } from '../../src/renderer/starMaterial.js';

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const span = Math.max(edge1 - edge0, 1e-6);
  const t = Math.min(Math.max((x - edge0) / span, 0), 1);
  return t * t * (3 - 2 * t);
};

const evaluateBoundaryFeather = (radius: number, params: ReturnType<typeof deriveBoundaryUniform>): number => {
  if (params.start >= 0.999 || params.alphaFloor >= 0.999) {
    return 1;
  }
  const start = Math.min(Math.max(params.start, 0.6), 0.999);
  const exponent = Math.max(params.exponent, 0.5);
  const floor = Math.min(Math.max(params.alphaFloor, 0), 1);
  const clampedRadius = Math.min(Math.max(radius, 0), 1);
  const rimMix = smoothstep(start, 1, clampedRadius);
  const mixFactor = Math.pow(Math.min(Math.max(rimMix, 0), 1), exponent);
  const feather = 1 - mixFactor * (1 - floor);
  return Math.min(Math.max(feather, 0), 1);
};

describe('deriveBoundaryUniform', () => {
  it('returns default parameters when no input is provided', () => {
    const params = deriveBoundaryUniform();
    expect(params.start).toBeCloseTo(0.875, 2);
    expect(params.exponent).toBeCloseTo(1.75, 2);
    expect(params.alphaFloor).toBeCloseTo(0.05, 3);
    expect(params.reserved).toBe(0);
  });

  it('clamps inputs into the supported range', () => {
    const params = deriveBoundaryUniform({ featherStart: 0.4, featherExponent: 12, alphaFloor: 0.6 });
    expect(params.start).toBeCloseTo(0.6, 3);
    expect(params.exponent).toBeCloseTo(6, 3);
    expect(params.alphaFloor).toBeCloseTo(0.3, 3);
  });

  it('returns legacy parameters when feathering is disabled', () => {
    const params = deriveBoundaryUniform({ featherStart: 1, alphaFloor: 1, featherExponent: 3 });
    expect(params.start).toBeCloseTo(0.999, 3);
    expect(params.exponent).toBeCloseTo(1, 3);
    expect(params.alphaFloor).toBeCloseTo(1, 3);
  });

  it('produces a monotonic attenuation curve without discontinuities', () => {
    const params = deriveBoundaryUniform({ featherStart: 0.82, featherExponent: 3.5, alphaFloor: 0.05 });
    let previous = 1;
    for (let step = 0; step <= 20; step += 1) {
      const radius = step / 20;
      const value = evaluateBoundaryFeather(radius, params);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeLessThanOrEqual(previous + 1e-4);
      previous = value;
    }
    expect(previous).toBeLessThanOrEqual(0.06);
  });

  it('avoids NaNs for extreme exponent and radius combinations', () => {
    const params = deriveBoundaryUniform({ featherStart: 0.95, featherExponent: 6, alphaFloor: 0 });
    const values = [0, 0.5, 0.9, 0.99, 1];
    for (const radius of values) {
      const value = evaluateBoundaryFeather(radius, params);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
