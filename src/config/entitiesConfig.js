// Copied from spec/entitiesConfig.js - ship-type defaults and helpers
import { getShipAsset, getBulletAsset, getTurretAsset } from './assets/assetsConfig';
/*
  Developer notes: AI, GameManager and RNG contract

  This file defines the ship type defaults and visual mapping helpers used
  throughout the simulation and renderer. It intentionally contains no
  runtime-side effects — only plain configuration objects and pure helper
  functions. When changing any numbers or shapes here, update corresponding
  unit tests that depend on ship stats (damage/HP/shield/radius) and visual
  snapshot tests where applicable.

  Important runtime contracts and interactions:

  - Simulation determinism and RNG
    * The simulation is expected to be deterministic when seeded. Calls to
      `srand(seed)` / `srandom()` are provided by the global seeded RNG
      module (`src/rng.js` / `src/rng.ts`).
    * Game manager may also use a manager-local RNG instance for
      per-manager deterministic behavior (see `createGameManager`). This
      file is configuration-only and should not rely on RNG directly. If a
      config helper needs deterministic randomness for tests, make callers
      pass the manager-local RNG in instead of calling Math.random().

  - GameManager expectations
    * The `simulateStep(state, dt, bounds)` contract is numeric-only and
      must not perform DOM or rendering actions. It may push small event
      objects onto `state.explosions`, `state.shieldHits`, and
      `state.healthHits` for the renderer to consume.
    * When gamemanager spawns ships or reinforcements it uses ship type keys
      present in `ShipConfig` and the helper `createShip(type,x,y,team)`.
    * Tests rely on `spawnShip()` recording the two random values used to
      compute spawn coordinates as `manager._internal.lastSpawnRands` for
      deterministic assertions. Do not change the shape of that diagnostic
      object without updating tests.

  - Reinforcements & continuous mode
    * The gamemanager may call `chooseReinforcementsWithManagerSeed` from
      `src/config/teamsConfig` to decide reinforcement orders. That helper
      receives a small subset of the state and an options object. If
      `chooseReinforcementsWithManagerSeed` returns an empty array the
      manager may fall back to a deterministic spawn for tests — this
      behavior is intentionally conservative and subject to review.

  - Visual mapping helpers
    * Helpers such as `getShipAssetForType` and `getBulletAssetForCannon`
      are pure mappers used by both the Canvas and WebGL renderers. They
      must remain synchronous and deterministic for snapshot tests.

  Testing notes
  - When writing tests that depend on these configs, seed the global RNG
    using `srand(seed)` and, if available, reseed the manager-local RNG
    through the manager API (e.g. `gm.reseed(seed)`) to isolate randomness.
  - Prefer creating a manager with `useWorker: false` when asserting
    deterministic behavior in unit tests to avoid worker timing nondeterminism.

  Summary: This file is configuration-driven. Keep numeric tuning here but
  avoid introducing runtime side-effects or RNG calls. If code needs
  randomness for tests, have the caller provide a seeded RNG instance.
*/
export const ShipConfig = {
  fighter: {
    maxHp: 15,
    armor: 0,
    maxShield: 8,
    shieldRegen: 1.0,
    dmg: 3,
    damage: 3,
    radius: 4,
    cannons: [
      { damage: 3, rate: 3, spread: 0.1, muzzleSpeed: 300, bulletRadius: 1.5, bulletTTL: 1.2 }
    ],
    accel: 600,
    turnRate: 6,
  },
  corvette: {
    maxHp: 50,
    armor: 0,
    maxShield: Math.round(50 * 0.6),
    shieldRegen: 0.5,
    dmg: 5,
    damage: 5,
    radius: 8,
    accel: 200,
    turnRate: 3,
    cannons: [ { damage: 6, rate: 1.2, spread: 0.05, muzzleSpeed: 220, bulletRadius: 2, bulletTTL: 2.0 } ],
  },
  frigate: {
    maxHp: 80,
    armor: 1,
    maxShield: Math.round(80 * 0.6),
    shieldRegen: 0.4,
    dmg: 8,
    damage: 8,
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
    damage: 12,
    radius: 16,
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
    damage: 2,
    radius: 24,
    cannons: new Array(4).fill(0).map(() => ({ damage: 4, rate: 0.6, spread: 0.12, muzzleSpeed: 180, bulletRadius: 3, bulletTTL: 2.8 })),
    accel: 40,
    turnRate: 0.8,
    carrier: { fighterCooldown: 1.5, maxFighters: 6, spawnPerCooldown: 2 }
  }
};

export default ShipConfig;

export function setShipConfig(newCfg = {}) {
  function merge(target, src) {
    for (const k of Object.keys(src)) {
      const sv = src[k];
      if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
        if (!target[k] || typeof target[k] !== 'object') target[k] = {};
        merge(target[k], sv);
      } else if (Array.isArray(sv)) {
        target[k] = sv.map(item => (item && typeof item === 'object' ? Object.assign({}, item) : item));
      } else if (['number', 'string', 'boolean'].includes(typeof sv)) {
        target[k] = sv;
      }
    }
  }
  merge(ShipConfig, newCfg);
}

export function getShipConfig() {
  return JSON.parse(JSON.stringify(ShipConfig));
}

// Visual mapping configuration and helpers
export const VisualMappingConfig = {
  // thresholds to map bulletRadius to an asset kind
  bulletRadiusThresholds: [
    { threshold: 0.22, kind: 'small' },
    { threshold: 0.32, kind: 'medium' },
    { threshold: Infinity, kind: 'large' }
  ],
  defaultTurretKind: 'basic',
  shipAssetKey: {
    fighter: 'fighter',
    corvette: 'corvette',
    frigate: 'frigate',
    destroyer: 'destroyer',
    carrier: 'carrier'
  }
};

export function bulletKindForRadius(r = 0.2) {
  for (const t of VisualMappingConfig.bulletRadiusThresholds) {
    if (r <= t.threshold) return t.kind;
  }
  return 'small';
}

export function getBulletAssetForCannon(cannon = {}) {
  const r = typeof cannon.bulletRadius === 'number' ? cannon.bulletRadius : (typeof cannon.radius === 'number' ? cannon.radius : 0.2);
  const kind = bulletKindForRadius(r);
  return getBulletAsset(kind);
}

export function getShipAssetForType(type) {
  const t = type || getDefaultShipType();
  const key = VisualMappingConfig.shipAssetKey[t] || t;
  return getShipAsset(key);
}

export function getTurretAssetForShip(_shipType) {
  return getTurretAsset(VisualMappingConfig.defaultTurretKind);
}

export function getVisualsForShipType(type, cannon = undefined) {
  return {
    hull: getShipAssetForType(type),
    turret: getTurretAssetForShip(type),
    bullet: getBulletAssetForCannon(cannon)
  };
}

export function getDefaultShipType() {
  const keys = Object.keys(ShipConfig || {});
  return keys.length ? keys[0] : 'fighter';
}
