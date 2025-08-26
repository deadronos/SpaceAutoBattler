import type { GameState } from "./types";
// Lazily resolve entitiesConfig to avoid partial module initialization during test interop.
// Support ESM environments by creating a CommonJS-like require.
let __nodeRequire: any;
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Node ESM global
  const { createRequire } = require("module");
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - import.meta in TS transpiled output
  __nodeRequire = createRequire(typeof import.meta !== "undefined" ? (import.meta as any).url : __filename);
} catch (e) {
  try {
    // Fallback if native require exists (CJS paths)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createRequire } = require("module");
    __nodeRequire = createRequire(__filename);
  } catch (e2) {}
}
function __resolveEntitiesConfigModule(): any {
  try {
    if (__nodeRequire) return __nodeRequire("./config/entitiesConfig");
  } catch {}
  try {
    const mod = __nodeRequire ? __nodeRequire("./config/entitiesConfig.ts") : undefined;
    if (mod) return mod;
  } catch {}
  try {
    // As a last resort, attempt ESM namespace import already transpiled
    // Note: In many bundlers, this path will be rewritten; keep as safety.
    return __nodeRequire ? __nodeRequire("./config/entitiesConfig.js") : undefined;
  } catch {}
  return undefined;
}

function getShipConfigSafe() {
  // Attempt multiple shapes from a freshly-resolved module each call.
  const mod: any = __resolveEntitiesConfigModule() || {};
  // 1) Named getter
  if (typeof mod.getShipConfig === "function") {
    try {
      const cfg = mod.getShipConfig();
      if (cfg && Object.keys(cfg).length) return cfg;
    } catch {}
  }
  // 2) Named object export
  if (mod.ShipConfig && typeof mod.ShipConfig === "object") {
    try {
      if (Object.keys(mod.ShipConfig).length) return mod.ShipConfig;
    } catch {}
  }
  // 3) Default export object
  if (mod && typeof mod.default === "object" && mod.default) {
    try {
      if (Object.keys(mod.default).length) return mod.default;
    } catch {}
  }
  // 4) Namespace itself (some CJS transpile shapes)
  if (mod && typeof mod === "object") {
    try {
      if (Object.keys(mod).length) return mod;
    } catch {}
  }
  // 5) Minimal seed to keep engine functional in worst-case interop edge
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
    // Provide a minimal carrier so carrier-spawn logic remains functional even if
    // module resolution fails in certain ESM/CJS interop scenarios.
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
  } as any;
}

function getDefaultShipTypeSafe() {
  const config = getShipConfigSafe();
  const keys = Object.keys(config);
  return keys.length ? keys[0] : "fighter";
}
function getSizeDefaultsSafe(size: "small" | "medium" | "large") {
  const mod: any = __resolveEntitiesConfigModule() || {};
  if (typeof mod.getSizeDefaults === "function") return mod.getSizeDefaults(size);
  if (mod.default && typeof mod.default.getSizeDefaults === "function") return mod.default.getSizeDefaults(size);
  return {};
}
// (Removed duplicate getShipConfigSafe)
// pooling helpers moved to src/pools; importers should use that module now
import { TEAM_DEFAULT } from "./config/teamsConfig";
import type { ShipConfigMap, ShipSpec } from "./types";
import Pool from "./pools/pool";

// Pooling helpers were moved to `src/pools` — import from there directly.

let nextId = 1;
export function genId(): number {
  return nextId++;
}

export type Cannon = {
  damage: number;
  rate: number;
  // runtime cooldown (internal) - optional
  __cd?: number;
  // optional range used by behavior logic
  range?: number;
  spread?: number;
  muzzleSpeed?: number;
  bulletRadius?: number;
  bulletTTL?: number;
};

export type Ship = {
  id: number;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  shield?: number;
  maxShield?: number;
  angle: number;
  team?: string;
  xp?: number;
  level?: number;
  cannons?: Cannon[];
  accel?: number;
  currentAccel?: number;
  throttle?: number;
  steering?: number;
  turnRate?: number;
  radius?: number;
  maxSpeed?: number;
  trail?: { x: number; y: number }[];
  shieldRegen?: number;
  shieldPercent?: number;
  hpPercent?: number;
  armor?: number;
  size?: "small" | "medium" | "large";
  // parentId is set on ships spawned by other entities (e.g. fighters launched by a carrier)
  parentId?: number;
  // Internal carrier timer accumulator (seconds). Not serialized.
  _carrierTimer?: number;
  // Turrets attached to the ship. Normalized via normalizeTurrets -> each turret
  // is an object { position: [x,y], angle, targetAngle, spread, barrel, cooldown }
  // Accept either normalized turret objects or shorthand [x,y] arrays for
  // backwards compatibility with saved snapshots and concise configs.
  turrets?: Array<
    | [number, number]
    | {
        position: [number, number];
        angle?: number;
        targetAngle?: number;
        spread?: number;
        barrel?: number;
        cooldown?: number;
        kind?: string;
      }
  >;
};

export function createShip(
  type: string | undefined = undefined,
  x = 0,
  y = 0,
  team = TEAM_DEFAULT,
): Ship {
  const shipCfg = getShipConfigSafe() as ShipConfigMap;
  const availableTypes = Object.keys(shipCfg || {});
  const resolvedType =
    type && shipCfg[type]
      ? type
      : availableTypes.length
        ? availableTypes[0]
  : getDefaultShipTypeSafe();
  const rawCfg = (shipCfg[resolvedType] ||
  shipCfg[getDefaultShipTypeSafe()]) as Partial<ShipSpec>;
  // Merge in per-size defaults for any fields not explicitly provided by the
  // ship type config. This keeps configs concise while ensuring sensible
  // defaults for armor/shields per size class.
  const sizeVal =
    (rawCfg as any).size ||
    (rawCfg.radius && rawCfg.radius >= 36
      ? "large"
      : rawCfg.radius && rawCfg.radius >= 20
        ? "medium"
        : "small");
  const sizeDefaults = getSizeDefaultsSafe(sizeVal as "small" | "medium" | "large");
  const cfg = Object.assign({}, sizeDefaults, rawCfg) as Partial<ShipSpec>;
  const ship = {
    id: genId(),
    type: resolvedType,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: cfg.maxHp ?? 0,
    maxHp: cfg.maxHp ?? 0,
    shield: cfg.maxShield ?? 0,
    maxShield: cfg.maxShield ?? 0,
    shieldRegen: cfg.shieldRegen ?? 0,
    armor: cfg.armor ?? 0,
    size: (cfg as any).size || sizeVal,
    team,
    xp: 0,
    level: 1,
    cannons: JSON.parse(JSON.stringify(cfg.cannons || [])),
    // Keep raw turret defs here for now; we'll normalize below via helper so
    // normalization logic is centralized and reusable by snapshot handlers.
    turrets: cfg.turrets || [],
    accel: cfg.accel || 0,
    currentAccel: 0,
    throttle: 0,
    steering: 0,
    turnRate: cfg.turnRate || 0,
    radius: cfg.radius || 6,
    // Ensure maxSpeed is always a sensible positive number. Some saved state
    // or malformed configs may have maxSpeed omitted or set to 0 which causes
    // ships to never translate (they can still rotate/fire). Prefer the
    // configured value but fall back to a safe default > 0.
    maxSpeed:
      typeof cfg.maxSpeed === "number" && cfg.maxSpeed > 0 ? cfg.maxSpeed : 120,
    angle: 0,
    trail: undefined,
    shieldPercent: 1,
    hpPercent: 1,
  } as Ship;
  // Ensure turrets are normalized to the object shape (idempotent)
  try {
    normalizeTurrets(ship as any);
  } catch (e) {}
  return ship as Ship;
}

// normalizeTurrets
// Converts turret shorthand arrays ([x,y]) into normalized turret objects
// with default runtime fields. This function is idempotent and safe to call
// on ships coming from snapshots or network/worker messages.
export function normalizeTurrets(ship: any): void {
  try {
    if (!ship) return;
    const tarr = ship.turrets;
    if (!Array.isArray(tarr)) return;
    ship.turrets = tarr.map((t: any) => {
      if (Array.isArray(t) && t.length === 2) {
        return {
          position: t,
          angle: 0,
          targetAngle: 0,
          kind: "basic",
          spread: 0,
          barrel: 0,
          cooldown: 1.0,
        };
      }
      // If it's already an object turret, shallow-copy and ensure runtime defaults
      if (t && typeof t === "object") {
        const copy = Object.assign({}, t);
        if (typeof copy.angle !== "number") copy.angle = 0;
        if (typeof copy.targetAngle !== "number") copy.targetAngle = 0;
        if (typeof copy.spread !== "number") copy.spread = 0;
        if (typeof copy.barrel !== "number") copy.barrel = 0;
        if (typeof copy.cooldown !== "number")
          copy.cooldown = copy.cooldown || 1.0;
        return copy;
      }
      return t;
    });
  } catch (e) {}
}

// normalizeStateShips
// Normalizes turrets for every ship in the provided state, rebuilds a
// shipMap for quick lookups and recomputes teamCounts (keeps red/blue keys).
export function normalizeStateShips(state: any): void {
  if (!state || typeof state !== "object") return;
  try {
    const ships = Array.isArray(state.ships) ? state.ships : [];
    // Normalize each ship's turret defs
    for (const s of ships) {
      try {
        normalizeTurrets(s);
      } catch (e) {}
    }
    // Rebuild shipMap
    try {
      (state as any).shipMap = new Map<number, any>();
      for (const s of ships)
        if (s && typeof s.id !== "undefined")
          (state as any).shipMap.set(s.id, s);
    } catch (e) {}
    // Recompute teamCounts, preserve red/blue keys default
    try {
      const counts: Record<string, number> = { red: 0, blue: 0 };
      for (const s of ships) {
        try {
          const t = String((s && (s as any).team) || "");
          if (t) counts[t] = (counts[t] || 0) + 1;
        } catch (e) {}
      }
      state.teamCounts = counts;
    } catch (e) {}
  } catch (e) {}
}

export type Bullet = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: string;
  ownerId?: number | null;
  damage: number;
  ttl: number;
  radius?: number;
  bulletRadius?: number;
  bulletTTL?: number;
  kind?: string;
  alive?: boolean;
  prevX?: number;
  prevY?: number;
  _prevX?: number;
  _prevY?: number;
};

const bulletPool = new Pool<Bullet>(
  () => ({
    id: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    team: TEAM_DEFAULT,
    ownerId: null,
    damage: 0,
    ttl: 0,
    prevX: 0,
    prevY: 0,
    _prevX: 0,
    _prevY: 0,
  }),
  (b) => {
    /* reset */ b.id = 0;
    b.x = 0;
    b.y = 0;
    b.vx = 0;
    b.vy = 0;
    b.team = TEAM_DEFAULT;
    b.ownerId = null;
    b.damage = 0;
    b.ttl = 0;
    b.prevX = 0;
    b.prevY = 0;
    b._prevX = 0;
    b._prevY = 0;
  },
);

export function createBullet(
  x: number,
  y: number,
  vx: number,
  vy: number,
  team = TEAM_DEFAULT,
  ownerId: number | null = null,
  damage = 1,
  ttl = 2.0,
): Bullet {
  const b = bulletPool.acquire();
  b.id = genId();
  b.x = x;
  b.y = y;
  b.vx = vx;
  b.vy = vy;
  b.team = team;
  b.ownerId = ownerId;
  b.damage = damage;
  b.ttl = ttl;
  b.prevX = x;
  b.prevY = y;
  b._prevX = x;
  b._prevY = y;
  b.alive = true;
  return b;
}

export function releaseBullet(b: Bullet) {
  try {
    b.alive = false;
  } catch {}
  bulletPool.release(b);
}

export interface ExplosionEffect {
  x: number;
  y: number;
  r?: number;
  alive?: boolean;
  _pooled?: boolean;
  [key: string]: unknown;
}
export interface ShieldHitEffect {
  x: number;
  y: number;
  magnitude?: number;
  alive?: boolean;
  _pooled?: boolean;
  [key: string]: unknown;
}
export interface HealthHitEffect {
  x: number;
  y: number;
  amount?: number;
  alive?: boolean;
  _pooled?: boolean;
  [key: string]: unknown;
}

export function createExplosionEffect(
  init?: Partial<ExplosionEffect>,
): ExplosionEffect {
  return {
    x: init?.x ?? 0,
    y: init?.y ?? 0,
    r: init?.r,
    alive: true,
    _pooled: false,
    ...init,
  };
}
export function resetExplosionEffect(
  obj: ExplosionEffect,
  init?: Partial<ExplosionEffect>,
) {
  obj.x = init?.x ?? 0;
  obj.y = init?.y ?? 0;
  obj.r = init?.r;
  obj.alive = true;
  obj._pooled = false;
  Object.assign(obj, init);
}
export function createShieldHitEffect(
  init?: Partial<ShieldHitEffect>,
): ShieldHitEffect {
  return {
    x: init?.x ?? 0,
    y: init?.y ?? 0,
    magnitude: init?.magnitude,
    alive: true,
    _pooled: false,
    ...init,
  };
}
export function resetShieldHitEffect(
  obj: ShieldHitEffect,
  init?: Partial<ShieldHitEffect>,
) {
  obj.x = init?.x ?? 0;
  obj.y = init?.y ?? 0;
  obj.magnitude = init?.magnitude;
  obj.alive = true;
  obj._pooled = false;
  Object.assign(obj, init);
}
export function createHealthHitEffect(
  init?: Partial<HealthHitEffect>,
): HealthHitEffect {
  return {
    x: init?.x ?? 0,
    y: init?.y ?? 0,
    amount: init?.amount,
    alive: true,
    _pooled: false,
    ...init,
  };
}
export function resetHealthHitEffect(
  obj: HealthHitEffect,
  init?: Partial<HealthHitEffect>,
) {
  obj.x = init?.x ?? 0;
  obj.y = init?.y ?? 0;
  obj.amount = init?.amount;
  obj.alive = true;
  obj._pooled = false;
  Object.assign(obj, init);
}

import type { PoolEntry, TexturePoolEntry } from "./types/pool";
// Provide a default initial GameState for simulation and tests
export function makeInitialState(): GameState {
  return {
    t: 0,
    ships: [],
    // fast lookup map kept in sync with ships[] where possible
    shipMap: new Map<number, Ship>(),
    // Cached counts per team to avoid per-frame filter allocations
    teamCounts: { red: 0, blue: 0 },
    bullets: [],
    explosions: [],
    shieldHits: [],
    healthHits: [],
    // optional event arrays used by GameState contract
    particles: [],
    flashes: [],
    shieldFlashes: [],
    healthFlashes: [],
    engineTrailsEnabled: true,
    assetPool: {
      textures: new Map<string, PoolEntry<WebGLTexture>>(),
      sprites: new Map<string, PoolEntry<any>>(),
      effects: new Map<string, PoolEntry<any>>(),
      counts: {
        textures: new Map<string, number>(),
        sprites: new Map<string, number>(),
        effects: new Map<string, number>(),
      },
      config: {
        texturePoolSize: 128,
        spritePoolSize: 256,
        effectPoolSize: 128,
        textureOverflowStrategy: "discard-oldest",
        spriteOverflowStrategy: "discard-oldest",
        effectOverflowStrategy: "discard-oldest",
      },
    },
  };
}

// Update team counts safely. oldTeam/newTeam may be undefined when adding or removing.
export function updateTeamCount(
  state: GameState,
  oldTeam?: string,
  newTeam?: string,
) {
  try {
    if (oldTeam) {
      state.teamCounts[oldTeam] = Math.max(
        0,
        (state.teamCounts[oldTeam] || 0) - 1,
      );
    }
    if (newTeam) {
      state.teamCounts[newTeam] = (state.teamCounts[newTeam] || 0) + 1;
    }
  } catch (e) {}
}
