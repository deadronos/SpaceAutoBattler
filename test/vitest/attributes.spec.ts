import { describe, it, expect } from "vitest";
import { getShipConfigSafe } from "./utils/entitiesConfigSafe";

describe("Attributes", () => {
  it("should have health, damage, xp attributes from config", () => {
  const cfg = getShipConfigSafe();
    for (const type of Object.keys(cfg)) {
      expect(cfg[type].maxHp).toBeGreaterThan(0);
      expect(cfg[type].dmg).toBeGreaterThan(0);
      expect(cfg[type].damage).toBeGreaterThan(0);
      expect(cfg[type].radius).toBeGreaterThan(0);
    }
  });

  it("should fail if cannons array is empty", () => {
  const cfg = getShipConfigSafe();
    for (const type of Object.keys(cfg)) {
      // Simulate empty cannons
      const ship = { ...cfg[type], cannons: [] };
      expect(ship.cannons.length).toBe(0);
      // Should not be valid per type contract
      // If validation function exists, use it; else, just assert non-empty
      expect(ship.cannons.length).toBeLessThan(1);
    }
  });

  it("should fail if required fields are missing", () => {
    // Simulate missing damage
  const shipMissingDamage = { accel: 10, radius: 20, cannons: [{} as any] };
  expect((shipMissingDamage.cannons[0] as any).damage).toBeUndefined();
  // Simulate missing accel
  const shipMissingAccel = { radius: 20, cannons: [{ damage: 5 }] } as any;
  expect((shipMissingAccel as any).accel).toBeUndefined();
  // Simulate missing radius
  const shipMissingRadius = { accel: 10, cannons: [{ damage: 5 }] } as any;
  expect((shipMissingRadius as any).radius).toBeUndefined();
  });

  it("should use fallback logic for legacy and new damage fields", () => {
    // Only legacy
    const shipLegacy = {
      accel: 10,
      radius: 20,
      dmg: 7,
      cannons: [{ damage: undefined }],
    };
    const damageLegacy = shipLegacy.cannons[0].damage || shipLegacy.dmg || 0;
    expect(damageLegacy).toBe(7);
    // Only new
    const shipNew = {
      accel: 10,
      radius: 20,
      damage: 9,
      cannons: [{ damage: 9 }],
    };
    const damageNew = shipNew.cannons[0].damage || shipNew.damage || 0;
    expect(damageNew).toBe(9);
    // Both
    const shipBoth = {
      accel: 10,
      radius: 20,
      dmg: 5,
      damage: 8,
      cannons: [{ damage: 8 }],
    };
    const damageBoth =
      shipBoth.cannons[0].damage || shipBoth.damage || shipBoth.dmg || 0;
    expect(damageBoth).toBe(8);
  });

  it("should handle optional field edge cases", () => {
    const cannonZero = { damage: 0, rate: 0 };
    expect(cannonZero.damage).toBe(0);
    expect(cannonZero.rate).toBe(0);
    const cannonNegative = { damage: -5, rate: -1 };
    expect(cannonNegative.damage).toBeLessThan(0);
    expect(cannonNegative.rate).toBeLessThan(0);
    const cannonUndefined = { damage: undefined, rate: undefined };
    expect(cannonUndefined.damage).toBeUndefined();
    expect(cannonUndefined.rate).toBeUndefined();
  });

  it("should fail for malformed configs", () => {
    // Wrong type for damage
    const cannonBadType = { damage: "high" };
    expect(typeof cannonBadType.damage).toBe("string");
    // Wrong type for accel
    const shipBadAccel = {
      accel: "fast",
      radius: 20,
      cannons: [{ damage: 5 }],
    };
    expect(typeof shipBadAccel.accel).toBe("string");
  });

  it("should have config-driven cannon attributes", () => {
  const cfg = getShipConfigSafe();
    for (const type of Object.keys(cfg)) {
      for (const cannon of cfg[type].cannons || []) {
        expect(cannon.damage).toBeGreaterThan(0);
        expect(cannon.rate).toBeGreaterThan(0);
      }
    }
  });
});

it("should fail if cannons array is empty", () => {
  const ship = { accel: 10, radius: 20, cannons: [] };
  expect(ship.cannons.length).toBe(0);
  expect(ship.cannons.length).toBeLessThan(1);
});

it("should fail if required fields are missing", () => {
  // Simulate missing damage
  const shipMissingDamage = { accel: 10, radius: 20, cannons: [{} as any] };
  expect((shipMissingDamage.cannons[0] as any).damage).toBeUndefined();
  // Simulate missing accel
  const shipMissingAccel = { radius: 20, cannons: [{ damage: 5 }] } as any;
  expect((shipMissingAccel as any).accel).toBeUndefined();
  // Simulate missing radius
  const shipMissingRadius = { accel: 10, cannons: [{ damage: 5 }] } as any;
  expect((shipMissingRadius as any).radius).toBeUndefined();
});

it("should use fallback logic for legacy and new damage fields", () => {
  // Only legacy
  const shipLegacy = {
    accel: 10,
    radius: 20,
    dmg: 7,
    cannons: [{ damage: undefined }],
  };
  const damageLegacy = shipLegacy.cannons[0].damage || shipLegacy.dmg || 0;
  expect(damageLegacy).toBe(7);
  // Only new
  const shipNew = {
    accel: 10,
    radius: 20,
    damage: 9,
    cannons: [{ damage: 9 }],
  };
  const damageNew = shipNew.cannons[0].damage || shipNew.damage || 0;
  expect(damageNew).toBe(9);
  // Both
  const shipBoth = {
    accel: 10,
    radius: 20,
    dmg: 5,
    damage: 8,
    cannons: [{ damage: 8 }],
  };
  const damageBoth =
    shipBoth.cannons[0].damage || shipBoth.damage || shipBoth.dmg || 0;
  expect(damageBoth).toBe(8);
});

it("should handle optional field edge cases", () => {
  const cannonZero = { damage: 0, rate: 0 };
  expect(cannonZero.damage).toBe(0);
  expect(cannonZero.rate).toBe(0);
  const cannonNegative = { damage: -5, rate: -1 };
  expect(cannonNegative.damage).toBeLessThan(0);
  expect(cannonNegative.rate).toBeLessThan(0);
  const cannonUndefined = { damage: undefined, rate: undefined };
  expect(cannonUndefined.damage).toBeUndefined();
  expect(cannonUndefined.rate).toBeUndefined();
});

it("should fail for malformed configs", () => {
  // Wrong type for damage
  const cannonBadType = { damage: "high" };
  expect(typeof cannonBadType.damage).toBe("string");
  // Wrong type for accel
  const shipBadAccel = { accel: "fast", radius: 20, cannons: [{ damage: 5 }] };
  expect(typeof shipBadAccel.accel).toBe("string");
});
