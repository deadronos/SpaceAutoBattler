import { describe, it, expect } from 'vitest';
import { shortestAngle, dampingFactor } from '../../src/game/systems/motion.js';

describe('Motion Math Utilities', () => {
  describe('shortestAngle', () => {
    it('calculates shortest path for small angles', () => {
      expect(shortestAngle(0, Math.PI / 4)).toBeCloseTo(Math.PI / 4, 5);
      expect(shortestAngle(Math.PI / 4, 0)).toBeCloseTo(-Math.PI / 4, 5);
    });

    it('wraps around ±π boundary correctly', () => {
      // Going from -170° to +170° shortest path is -20° (going backward)
      const from = (-170 * Math.PI) / 180;
      const to = (170 * Math.PI) / 180;
      const result = shortestAngle(from, to);
      expect(result).toBeCloseTo((-20 * Math.PI) / 180, 5);
    });

    it('wraps around π to -π boundary correctly', () => {
      // Going from +170° to -170° shortest path is +20° (going forward)
      const from = (170 * Math.PI) / 180;
      const to = (-170 * Math.PI) / 180;
      const result = shortestAngle(from, to);
      expect(result).toBeCloseTo((20 * Math.PI) / 180, 5);
    });

    it('handles exact π differences', () => {
      // 180° difference can go either way, should return exactly π
      const result = shortestAngle(0, Math.PI);
      expect(Math.abs(result)).toBeCloseTo(Math.PI, 5);
    });

    it('returns zero for identical angles', () => {
      expect(shortestAngle(1.5, 1.5)).toBeCloseTo(0, 5);
    });
  });

  describe('dampingFactor', () => {
    it('returns 1 for zero damping', () => {
      expect(dampingFactor(0, 0.016)).toBeCloseTo(1, 5);
    });

    it('approaches zero for high damping over time', () => {
      const factor = dampingFactor(10, 1.0); // Very high damping
      expect(factor).toBeLessThan(0.001);
    });

    it('decreases with time for constant damping', () => {
      const damping = 2.0;
      const shortTime = dampingFactor(damping, 0.016);
      const longTime = dampingFactor(damping, 0.1);
      
      expect(shortTime).toBeGreaterThan(longTime);
      expect(shortTime).toBeLessThan(1);
      expect(longTime).toBeGreaterThan(0);
    });

    it('produces consistent exponential decay', () => {
      const damping = 3.0;
      const dt = 0.016;
      
      // Two small steps should equal one larger step
      const twoSteps = dampingFactor(damping, dt) * dampingFactor(damping, dt);
      const oneStep = dampingFactor(damping, dt * 2);
      
      expect(twoSteps).toBeCloseTo(oneStep, 4);
    });
  });
});