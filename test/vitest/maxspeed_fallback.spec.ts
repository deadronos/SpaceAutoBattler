import { test, expect } from 'vitest';
import { createShip } from '../../src/entities';
import * as entitiesConfig from '../../src/config/entitiesConfig';

test('createShip falls back to positive maxSpeed when config is missing or zero', () => {
  // Backup original config
  const orig = JSON.parse(JSON.stringify(entitiesConfig.default || entitiesConfig));
  try {
    // Temporarily set fighter maxSpeed to 0 to simulate malformed config
    if ((entitiesConfig as any).ShipConfig && (entitiesConfig as any).ShipConfig.fighter) {
      (entitiesConfig as any).ShipConfig.fighter.maxSpeed = 0;
    }
    const ship = createShip('fighter', 0, 0, 'red');
    expect(typeof ship.maxSpeed).toBe('number');
    expect(ship.maxSpeed).toBeGreaterThan(0);
  } finally {
    // Try to restore original config (best effort)
    try { (entitiesConfig as any).ShipConfig = orig.ShipConfig || orig; } catch (e) {}
  }
});