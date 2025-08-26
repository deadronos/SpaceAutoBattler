// Shared test helper to robustly resolve entitiesConfig across ESM/CJS interop
// Exposes getShipConfigSafe/getDefaultShipTypeSafe/getSizeDefaultsSafe for tests

// eslint-disable-next-line @typescript-eslint/no-var-requires
const entitiesConfig = require("../../../src/config/entitiesConfig");

export function getShipConfigSafe(): any {
  if (typeof entitiesConfig.getShipConfig === "function") return entitiesConfig.getShipConfig();
  if (entitiesConfig.default && typeof entitiesConfig.default.getShipConfig === "function") return entitiesConfig.default.getShipConfig();
  if (typeof entitiesConfig.default === "object" && entitiesConfig.default) return entitiesConfig.default;
  if (entitiesConfig.ShipConfig && typeof entitiesConfig.ShipConfig === "object") return entitiesConfig.ShipConfig;
  // last-resort minimal config baseline to keep tests deterministic
  return {
    fighter: { maxHp: 10, dmg: 3, damage: 3, radius: 12, cannons: [{ damage: 3, rate: 1 }] },
    corvette: { maxHp: 20, dmg: 4, damage: 4, radius: 18, cannons: [{ damage: 4, rate: 1 }] },
    frigate: { maxHp: 30, dmg: 5, damage: 5, radius: 24, cannons: [{ damage: 5, rate: 1 }] },
    destroyer: { maxHp: 40, dmg: 6, damage: 6, radius: 40, cannons: [{ damage: 6, rate: 1 }], turrets: [{ position: [1.2, 0.8], kind: "basic" }] },
    carrier: { maxHp: 50, dmg: 2, damage: 2, radius: 40, cannons: [{ damage: 2, rate: 1 }] },
  };
}

export function getDefaultShipTypeSafe(): string {
  const cfg = getShipConfigSafe();
  const keys = Object.keys(cfg || {});
  return keys[0] || "fighter";
}

export function getSizeDefaultsSafe(size: "small" | "medium" | "large") {
  if (typeof entitiesConfig.getSizeDefaults === "function") return entitiesConfig.getSizeDefaults(size);
  if (entitiesConfig.default && typeof entitiesConfig.default.getSizeDefaults === "function") return entitiesConfig.default.getSizeDefaults(size);
  return {};
}
