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

  it('never exceeds a shrunken maxDpr ceiling after the preset shrinks', () => {
    // Ramped up to 2.0 under `high`, then the preset switches to `low` (maxDpr 1.0).
    const shrunken = { ...defaults, maxDpr: 1.0 };
    const current = 2.0;

    // Downscale branch must clamp to the new ceiling, not `current - step`.
    expect(computeNextDpr(current, 28, shrunken)).toBe(1.0);
    // Dead-zone branch must also clamp.
    expect(computeNextDpr(current, 50, shrunken)).toBeLessThanOrEqual(1.0);
    // Upscale branch must stay under the ceiling.
    expect(computeNextDpr(current, 100, shrunken)).toBeLessThanOrEqual(1.0);
  });

  it('never drops below minDpr', () => {
    const next = computeNextDpr(0.5, 28, defaults);
    expect(next).toBeGreaterThanOrEqual(defaults.minDpr);
  });
});
