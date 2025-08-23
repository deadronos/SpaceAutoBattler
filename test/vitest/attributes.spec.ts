import { describe, it, expect } from 'vitest';
import ShipConfig, { getShipConfig } from '../../src/config/entitiesConfig';

describe('Attributes', () => {
  it('should have health, damage, xp attributes from config', () => {
    const cfg = getShipConfig();
    for (const type of Object.keys(cfg)) {
      expect(cfg[type].maxHp).toBeGreaterThan(0);
      expect(cfg[type].dmg).toBeGreaterThan(0);
      expect(cfg[type].damage).toBeGreaterThan(0);
      expect(cfg[type].radius).toBeGreaterThan(0);
    }
  });

  it('should have config-driven cannon attributes', () => {
    const cfg = getShipConfig();
    for (const type of Object.keys(cfg)) {
      for (const cannon of cfg[type].cannons || []) {
        expect(cannon.damage).toBeGreaterThan(0);
        expect(cannon.rate).toBeGreaterThan(0);
      }
    }
  });
});
