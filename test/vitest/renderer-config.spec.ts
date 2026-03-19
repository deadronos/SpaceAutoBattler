import { describe, expect, it } from 'vite-plus/test';
import { getShieldVisuals } from '../../src/config/renderer.js';

describe('renderer shield visuals config', () => {
  const hulls = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'] as const;
  it('returns required fields for every hull', () => {
    for (const h of hulls) {
      const v = getShieldVisuals(h);
      expect(typeof v.margin).toBe('number');
      expect(typeof v.hexScale).toBe('number');
      expect(typeof v.edgeWidth).toBe('number');
      expect(v.margin).toBeGreaterThan(1.0);
    }
  });
});
