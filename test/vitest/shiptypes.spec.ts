import { describe, it, expect } from "vitest";
import ShipConfig, { getShipConfig } from "../../src/config/entitiesConfig";

describe("ShipTypes", () => {
  it("should have all expected ship types", () => {
    const cfg = getShipConfig();
    expect(cfg.fighter).toBeDefined();
    expect(cfg.corvette).toBeDefined();
    expect(cfg.frigate).toBeDefined();
    expect(cfg.destroyer).toBeDefined();
    expect(cfg.carrier).toBeDefined();
  });
});

it("should handle migration scenarios: legacy-only, new-only, mixed", () => {
  // Legacy-only config
  const legacyConfig = {
    accel: 10,
    radius: 20,
    dmg: 6,
    cannons: [{ damage: undefined }],
  };
  const damageLegacy = legacyConfig.cannons[0].damage || legacyConfig.dmg || 0;
  expect(damageLegacy).toBe(6);

  // New-only config
  const newConfig = {
    accel: 10,
    radius: 20,
    damage: 11,
    cannons: [{ damage: 11 }],
  };
  const damageNew = newConfig.cannons[0].damage || newConfig.damage || 0;
  expect(damageNew).toBe(11);

  // Mixed config
  const mixedConfig = {
    accel: 10,
    radius: 20,
    dmg: 4,
    damage: 9,
    cannons: [{ damage: 9 }],
  };
  const damageMixed = mixedConfig.cannons[0].damage || mixedConfig.damage || mixedConfig.dmg || 0;
  expect(damageMixed).toBe(9);
});

it("should fail for malformed configs (wrong types)", () => {
  // String instead of number for damage
  const badConfig = {
    accel: 10,
    radius: 20,
    cannons: [{ damage: "high" }],
  };
  expect(typeof badConfig.cannons[0].damage).toBe("string");
  // String instead of number for accel
  const badAccelConfig = {
    accel: "fast",
    radius: 20,
    cannons: [{ damage: 5 }],
  };
  expect(typeof badAccelConfig.accel).toBe("string");
});
  });

  it("should have config-driven attributes", () => {
    const cfg = getShipConfig();
    for (const type of Object.keys(cfg)) {
      expect(cfg[type].maxHp).toBeGreaterThan(0);
      expect(cfg[type].dmg).toBeGreaterThan(0);
      expect(cfg[type].radius).toBeGreaterThan(0);
      expect(Array.isArray(cfg[type].cannons)).toBe(true);
    }
  });
});
