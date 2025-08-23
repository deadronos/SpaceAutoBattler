import { describe, it, expect } from 'vitest';
import ShipConfig, { getShipConfig } from '../../src/config/entitiesConfig';

describe('ShipTypes', () => {
  it('should have all expected ship types', () => {
    const cfg = getShipConfig();
    expect(cfg.fighter).toBeDefined();
    expect(cfg.corvette).toBeDefined();
    expect(cfg.frigate).toBeDefined();
    expect(cfg.destroyer).toBeDefined();
    expect(cfg.carrier).toBeDefined();
  });

  it('should have config-driven attributes', () => {
    const cfg = getShipConfig();
    for (const type of Object.keys(cfg)) {
      expect(cfg[type].maxHp).toBeGreaterThan(0);
      expect(cfg[type].dmg).toBeGreaterThan(0);
      expect(cfg[type].radius).toBeGreaterThan(0);
      expect(Array.isArray(cfg[type].cannons)).toBe(true);
    }
  });
});
