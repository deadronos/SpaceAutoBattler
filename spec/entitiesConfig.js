// Configurable ship-type defaults for SpaceAutoBattler
// Keep numbers conservative and deterministic; tests may rely on prior defaults
export const ShipConfig = {
  fighter: {
    maxHp: 15,
    armor: 0,
    maxShield: 8,
    shieldRegen: 1.0,
    dmg: 3,
    radius: 4,
    cannons: [
      // single light cannon
      { damage: 3, rate: 3, spread: 0.1, muzzleSpeed: 300, bulletRadius: 1.5, bulletTTL: 1.2 }
    ],
    accel: 600, // thrust/acceleration (affects responsiveness/turn)
    turnRate: 6,
  },
  corvette: {
    maxHp: 50,
    armor: 0,
    maxShield: Math.round(50 * 0.6),
    shieldRegen: 0.5,
    dmg: 5,
    radius: 8,
    cannons: [ { damage: 6, rate: 1.2, spread: 0.05, muzzleSpeed: 220, bulletRadius: 2, bulletTTL: 2.0 } ],
    accel: 200,
    turnRate: 3,
  },
  frigate: {
    maxHp: 80,
    armor: 1,
    maxShield: Math.round(80 * 0.6),
    shieldRegen: 0.4,
    dmg: 8,
    radius: 12,
    cannons: [ { damage: 8, rate: 1.0, spread: 0.06, muzzleSpeed: 200, bulletRadius: 2.5, bulletTTL: 2.2 } ],
    accel: 120,
    turnRate: 2.2,
  },
  destroyer: {
    maxHp: 120,
    armor: 2,
    maxShield: Math.round(120 * 0.6),
    shieldRegen: 0.3,
    dmg: 12,
    radius: 16,
    // multiple turrets
    cannons: new Array(6).fill(0).map(() => ({ damage: 6, rate: 0.8, spread: 0.08, muzzleSpeed: 240, bulletRadius: 2.5, bulletTTL: 2.4 })),
    accel: 80,
    turnRate: 1.6,
  },
  carrier: {
    maxHp: 200,
    armor: 3,
    maxShield: Math.round(200 * 0.6),
    shieldRegen: 0.2,
    dmg: 2,
    radius: 24,
    // carriers have defensive turrets and internal fighter bays
    cannons: new Array(4).fill(0).map(() => ({ damage: 4, rate: 0.6, spread: 0.12, muzzleSpeed: 180, bulletRadius: 3, bulletTTL: 2.8 })),
    accel: 40,
    turnRate: 0.8,
    // carrier-specific: fighter bay settings
    carrier: { fighterCooldown: 1.5, maxFighters: 6, spawnPerCooldown: 2 }
  }
};

export default ShipConfig;

// Runtime helpers: allow safe merging of runtime tuning values into ShipConfig
// setShipConfig(newCfg) will recursively merge primitive values and arrays from
// newCfg into the existing ShipConfig. This is intentionally permissive but
// avoids blindly assigning non-plain objects.
export function setShipConfig(newCfg = {}) {
  function merge(target, src) {
    for (const k of Object.keys(src)) {
      const sv = src[k];
      if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
        if (!target[k] || typeof target[k] !== 'object') target[k] = {};
        merge(target[k], sv);
      } else if (Array.isArray(sv)) {
        // shallow-clone arrays so callers can pass new arrays safely
        target[k] = sv.map(item => (item && typeof item === 'object' ? Object.assign({}, item) : item));
      } else if (['number', 'string', 'boolean'].includes(typeof sv)) {
        target[k] = sv;
      }
      // ignore other types (functions, undefined, null) to be safe
    }
  }
  if (sv === undefined) {
    // noop guard - nothing to merge
  }
  merge(ShipConfig, newCfg);
}

export function getShipConfig() {
  // return a deep copy to avoid accidental external mutation
  return JSON.parse(JSON.stringify(ShipConfig));
}
