import { describe, expect, it } from 'vite-plus/test';
import { computeNextDpr } from '../../src/components/DynamicResScaler.js';

const defaults = {
  minDpr: 0.5,
  maxDpr: 2,
  initialDpr: 0.5,
  targetFps: 60,
  lowerFps: 30,
  step: 0.25,
  smoothing: 0.08,
  adjustIntervalMs: 500,
};

describe('computeNextDpr', () => {
  it('increases dpr when emaFps is well above target', () => {
    const current = 0.5;
    const next = computeNextDpr(current, 72, defaults);
    expect(next).toBeGreaterThan(current);
    expect(next).toBe(0.75);
  });

  it('does not increase above maxDpr', () => {
    const current = 1.9;
    const next = computeNextDpr(current, 100, defaults);
    expect(next).toBeLessThanOrEqual(defaults.maxDpr);
  });

  it('decreases dpr when emaFps is at or below lowerFps', () => {
    const current = 1.0;
    const next = computeNextDpr(current, 28, defaults);
    expect(next).toBeLessThan(current);
    expect(next).toBe(0.75);
  });

  it('does nothing when fps in hysteresis range', () => {
    const current = 1.0;
    const next = computeNextDpr(current, 50, defaults);
    expect(next).toBe(current);
  });
});
