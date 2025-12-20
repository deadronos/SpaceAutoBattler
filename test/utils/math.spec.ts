import { describe, it, expect } from 'vitest';
import { clamp, clamp01, clampRatio, shortestAngle } from '../../src/utils/math.js';

describe('math utils', () => {
  describe('clamp', () => {
    it('clamps value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('clamp01', () => {
    it('clamps value between 0 and 1', () => {
      expect(clamp01(0.5)).toBe(0.5);
      expect(clamp01(-0.5)).toBe(0);
      expect(clamp01(1.5)).toBe(1);
    });

    it('handles NaN', () => {
      expect(clamp01(NaN)).toBe(0);
    });
  });

  describe('clampRatio', () => {
    it('clamps value between 0 and 1', () => {
      expect(clampRatio(0.5)).toBe(0.5);
      expect(clampRatio(-0.5)).toBe(0);
      expect(clampRatio(1.5)).toBe(1);
    });

    it('handles non-finite values', () => {
      expect(clampRatio(NaN)).toBe(0);
      expect(clampRatio(Infinity)).toBe(0);
      expect(clampRatio(-Infinity)).toBe(0);
    });
  });

  describe('shortestAngle', () => {
    it('returns 0 for same angle', () => {
      expect(shortestAngle(0, 0)).toBe(0);
      expect(shortestAngle(Math.PI, Math.PI)).toBe(0);
    });

    it('returns positive diff', () => {
      expect(shortestAngle(0, 0.5)).toBeCloseTo(0.5);
      expect(shortestAngle(0, Math.PI - 0.1)).toBeCloseTo(Math.PI - 0.1);
    });

    it('returns negative diff', () => {
      expect(shortestAngle(0, -0.5)).toBeCloseTo(-0.5);
      expect(shortestAngle(0, -Math.PI + 0.1)).toBeCloseTo(-Math.PI + 0.1);
    });

    it('wraps around PI', () => {
      expect(shortestAngle(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
      expect(shortestAngle(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(-0.2);
    });

    it('handles large angles', () => {
      expect(Math.abs(shortestAngle(0, Math.PI * 3))).toBeCloseTo(Math.PI);
      expect(shortestAngle(0, Math.PI * 2 + 0.5)).toBeCloseTo(0.5);
    });
  });
});
