import { describe, it, expect } from 'vitest';
import { validateShipConfig, validateConfigOrThrow, validateTeamsConfig, validateProgressionConfig } from '../../src/config/validateConfig';

describe('validateConfig helpers', () => {
  it('validateShipConfig accepts a minimal valid config', () => {
    const cfg = {
      fighter: { maxHp: 10, accel: 100, cannons: [{ damage: 1 }] }
    };
    const errs = validateShipConfig(cfg as any);
    expect(errs.length).toBe(0);
  });

  it('validateShipConfig reports missing/invalid fields', () => {
    const bad = {
      badShip: { maxHp: 0, accel: -1, cannons: [] }
    };
    const errs = validateShipConfig(bad as any);
    expect(errs.length).toBeGreaterThanOrEqual(3);
    expect(errs.some(e => e.includes('maxHp'))).toBeTruthy();
    expect(errs.some(e => e.includes('accel'))).toBeTruthy();
    expect(errs.some(e => e.includes('cannon'))).toBeTruthy();
  });

  it('validateTeamsConfig accepts default TeamsConfig shape', () => {
    const cfg = {
      teams: { red: { id: 'red', color: '#fff' } },
      defaultFleet: { counts: { fighter: 1 }, spacing: 20 },
      continuousReinforcement: { enabled: true, scoreMargin: 0.1, perTick: 1 }
    };
    const errs = validateTeamsConfig(cfg as any);
    expect(errs.length).toBe(0);
  });

  it('validateTeamsConfig reports problems', () => {
    const bad = { teams: null };
    const errs = validateTeamsConfig(bad as any);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('validateProgressionConfig accepts default shape', () => {
    const cfg = { xpPerDamage: 1, xpPerKill: 50, xpToLevel: (l: number) => 100, hpPercentPerLevel: 0.1, dmgPercentPerLevel: 0.08, shieldPercentPerLevel: 0.06 };
    const errs = validateProgressionConfig(cfg as any);
    expect(errs.length).toBe(0);
  });

  it('validateProgressionConfig reports problems', () => {
    const bad = { xpPerDamage: 'nope' };
    const errs = validateProgressionConfig(bad as any);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('validateConfigOrThrow throws in CI mode', () => {
    const origCI = process.env.CI;
    process.env.CI = 'true';
    try {
      const bad = { fighter: { maxHp: 0, accel: -1, cannons: [] } };
      expect(() => validateConfigOrThrow(bad as any)).toThrow();
    } finally {
      if (typeof origCI === 'undefined') delete process.env.CI; else process.env.CI = origCI;
    }
  });
});
