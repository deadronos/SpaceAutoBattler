// Centralized runtime config resolver for ESM/CJS interop safety
// Provides safe accessors used by hot paths to avoid partial module init and drift

// ESM-safe require using Node's createRequire
let __nodeRequire: any;
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const { createRequire } = require("module");
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  __nodeRequire = createRequire(typeof import.meta !== "undefined" ? (import.meta as any).url : __filename);
} catch (e) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createRequire } = require("module");
    __nodeRequire = createRequire(__filename);
  } catch (e2) {}
}

export function getRuntimeEntitiesModule(): any {
  try {
    if (__nodeRequire) return __nodeRequire("./entitiesConfig");
  } catch {}
  try {
    return __nodeRequire ? __nodeRequire("./entitiesConfig.ts") : undefined;
  } catch {}
  try {
    return __nodeRequire ? __nodeRequire("./entitiesConfig.js") : undefined;
  } catch {}
  return undefined;
}

export function getRuntimeShipConfigSafe(): any {
  // Try named getter first to ensure ranges are normalized
  try {
    const mod: any = getRuntimeEntitiesModule() || {};
    if (typeof mod.getShipConfig === "function") {
      const cfg = mod.getShipConfig();
      if (cfg && Object.keys(cfg).length) return cfg;
    }
    if (mod.ShipConfig && Object.keys(mod.ShipConfig).length) return mod.ShipConfig;
    if (mod.default && Object.keys(mod.default).length) return mod.default;
    if (mod && Object.keys(mod).length) return mod;
  } catch {}
  // Last-resort minimal set (fighter + carrier so carrier features work)
  return {
    fighter: {
      size: "small",
      maxHp: 10,
      maxShield: 8,
      shieldRegen: 1,
      accel: 100,
      turnRate: 6,
      radius: 12,
      maxSpeed: 2200,
      cannons: [{ damage: 3, rate: 3, muzzleSpeed: 260, bulletTTL: 1.1 }],
    },
    carrier: {
      size: "large",
      maxHp: 50,
      armor: 2,
      maxShield: 30,
      shieldRegen: 0.3,
      radius: 40,
      accel: 60,
      turnRate: 1.5,
      maxSpeed: 1200,
      cannons: [{ damage: 2, rate: 0.8, muzzleSpeed: 140, bulletTTL: 2.0 }],
      carrier: { fighterCooldown: 1.5, maxFighters: 6, spawnPerCooldown: 2 },
      turrets: [{ position: [2.0, 1.2], kind: "basic" }],
    },
  } as const;
}

export function getRuntimeSizeDefaultsSafe(size: "small" | "medium" | "large") {
  try {
    const mod: any = getRuntimeEntitiesModule() || {};
    if (typeof mod.getSizeDefaults === "function") return mod.getSizeDefaults(size);
    if (mod.default && typeof mod.default.getSizeDefaults === "function") return mod.default.getSizeDefaults(size);
  } catch {}
  return {};
}

export function getRuntimeBulletDefaultsSafe() {
  try {
    const mod: any = getRuntimeEntitiesModule() || {};
    if (mod && mod.BULLET_DEFAULTS) return mod.BULLET_DEFAULTS;
    if (mod && mod.default && mod.default.BULLET_DEFAULTS) return mod.default.BULLET_DEFAULTS;
  } catch {}
  return { damage: 1, ttl: 2.0, radius: 1.5, muzzleSpeed: 24, range: 300 };
}

// Shared helper: choose a default ship type safely across module systems.
// Returns the first key of the runtime ship config map, or 'fighter' as a fallback.
export function getDefaultShipTypeSafe(): string {
  try {
    const cfg: any = getRuntimeShipConfigSafe();
    const keys = Object.keys(cfg || {});
    return keys.length ? keys[0] : "fighter";
  } catch (e) {
    return "fighter";
  }
}
