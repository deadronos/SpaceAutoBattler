import { describe, it, expect } from 'vitest';
import { computeShieldFraction, shouldDisplayShield, validateShieldVisibility } from '../../../src/components/ship/shieldUtils.js';

describe('shieldUtils', () => {
  describe('computeShieldFraction', () => {
    it('should compute valid fraction for normal values', () => {
      const result = computeShieldFraction(50, 100, 1, 'fighter');
      expect(result.fraction).toBe(0.5);
      expect(result.shouldDisplay).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return 0 when maxShield is 0', () => {
      const result = computeShieldFraction(0, 0, 1, 'fighter');
      expect(result.fraction).toBe(0);
      expect(result.shouldDisplay).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn and return 0 for invalid maxShield (NaN)', () => {
      const result = computeShieldFraction(50, NaN, 1, 'fighter');
      expect(result.fraction).toBe(0);
      expect(result.shouldDisplay).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('invalid maxShield');
    });

    it('should warn and return 0 for invalid maxShield (Infinity)', () => {
      const result = computeShieldFraction(50, Infinity, 1, 'fighter');
      expect(result.fraction).toBe(0);
      expect(result.shouldDisplay).toBe(false);
      expect(result.warnings).toHaveLength(1);
    });

    it('should warn and return 0 for negative maxShield', () => {
      const result = computeShieldFraction(50, -100, 1, 'fighter');
      expect(result.fraction).toBe(0);
      expect(result.shouldDisplay).toBe(false);
      expect(result.warnings).toHaveLength(1);
    });

    it('should warn and return 0 for invalid shield (NaN)', () => {
      const result = computeShieldFraction(NaN, 100, 1, 'fighter');
      expect(result.fraction).toBe(0);
      expect(result.shouldDisplay).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('invalid shield');
    });

    it('should warn and return 0 for invalid shield (Infinity)', () => {
      const result = computeShieldFraction(Infinity, 100, 1, 'fighter');
      expect(result.fraction).toBe(0);
      expect(result.shouldDisplay).toBe(false);
      expect(result.warnings).toHaveLength(1);
    });

    it('should clamp fraction above 1 to 1', () => {
      const result = computeShieldFraction(150, 100, 1, 'fighter');
      expect(result.fraction).toBe(1);
      expect(result.shouldDisplay).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should clamp negative shield to 0', () => {
      const result = computeShieldFraction(-50, 100, 1, 'fighter');
      expect(result.fraction).toBe(0);
      expect(result.shouldDisplay).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });

    it('should respect custom minThreshold', () => {
      const result = computeShieldFraction(5, 100, 1, 'fighter', 0.1);
      expect(result.fraction).toBe(0.05);
      expect(result.shouldDisplay).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });

    it('should display when fraction equals threshold', () => {
      const result = computeShieldFraction(1, 100, 1, 'fighter', 0.01);
      expect(result.fraction).toBe(0.01);
      expect(result.shouldDisplay).toBe(true);
    });

    it('should not display when fraction is just below threshold', () => {
      const result = computeShieldFraction(0.5, 100, 1, 'fighter', 0.01);
      expect(result.fraction).toBe(0.005);
      expect(result.shouldDisplay).toBe(false);
    });
  });

  describe('shouldDisplayShield', () => {
    it('should return true when fraction meets threshold', () => {
      expect(shouldDisplayShield(0.5, 0.01)).toBe(true);
    });

    it('should return false when fraction is below threshold', () => {
      expect(shouldDisplayShield(0.005, 0.01)).toBe(false);
    });

    it('should return true when fraction equals threshold', () => {
      expect(shouldDisplayShield(0.01, 0.01)).toBe(true);
    });

    it('should handle edge case of 0 threshold', () => {
      expect(shouldDisplayShield(0, 0)).toBe(true);
    });
  });

  describe('validateShieldVisibility', () => {
    it('should return null when shield is correctly hidden', () => {
      const result = validateShieldVisibility(0.005, 0.5, 100, 0.01, 1, 'fighter');
      expect(result).toBeNull();
    });

    it('should return null when shield is correctly visible', () => {
      const result = validateShieldVisibility(0.5, 50, 100, 0.01, 1, 'fighter');
      expect(result).toBeNull();
    });

    it('should return warning when shield should be visible but is not', () => {
      const result = validateShieldVisibility(0.005, 5, 100, 0.01, 1, 'fighter');
      expect(result).not.toBeNull();
      expect(result).toContain('should be visible');
      expect(result).toContain('ship 1');
    });

    it('should return null when latest fraction indicates visibility despite stale computed fraction', () => {
      const result = validateShieldVisibility(0.008, 0.4, 24, 0.01, 3, 'fighter', 0.0167);
      expect(result).toBeNull();
    });

    it('should return null when shield is 0', () => {
      const result = validateShieldVisibility(0, 0, 100, 0.01, 1, 'fighter');
      expect(result).toBeNull();
    });

    it('should return null when maxShield is 0', () => {
      const result = validateShieldVisibility(0, 50, 0, 0.01, 1, 'fighter');
      expect(result).toBeNull();
    });
  });
});
