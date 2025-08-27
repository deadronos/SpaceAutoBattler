import type { GameState } from "./types";
import {
  getRuntimeShipConfigSafe,
  getRuntimeSizeDefaultsSafe,
  getDefaultShipTypeSafe,
} from "./config/runtimeConfigResolver";
// Lazily resolve entitiesConfig to avoid partial module initialization during test interop.
// Support ESM environments by creating a CommonJS-like require.
let __nodeRequire: any;
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Node ESM global
  const { createRequire } = require("module");
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - import.meta in TS transpiled output
  __nodeRequire = createRequire(
    typeof import.meta !== "undefined" ? (import.meta as any).url : __filename,
  );
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
    // Prefer explicit .js when available (CJS consumers / runtime that resolve to compiled files)
    if (__nodeRequire) {
      try {
        return __nodeRequire("./config/entitiesConfig.js");
      } catch {}
      try {
        return __nodeRequire("./config/entitiesConfig");
      } catch {}
    }
  } catch {}
  try {
    const mod = __nodeRequire
      ? __nodeRequire("./config/entitiesConfig.ts")
      : undefined;
    if (mod) return mod;
  } catch {}
  try {
    // As a last resort, attempt ESM namespace import already transpiled
    // Note: In many bundlers, this path will be rewritten; keep as safety.
    return __nodeRequire
      ? __nodeRequire("./config/entitiesConfig.js")
      : undefined;
  } catch {}
  return undefined;
}

// Delegate to centralized runtime resolver (memoized) to avoid repeated module work
const getShipConfigSafe = () => getRuntimeShipConfigSafe();
const getSizeDefaultsSafe = (size: "small" | "medium" | "large") =>
  getRuntimeSizeDefaultsSafe(size as any);
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
  // 2D position (legacy support)
  x: number;
  y: number;
  // 3D position
  position?: { x: number; y: number; z: number };
  // 2D velocity (legacy support)
  vx: number;
  vy: number;
  // 3D velocity
  velocity?: { x: number; y: number; z: number };
  // 3D acceleration
  acceleration?: { x: number; y: number; z: number };
  hp: number;
  maxHp: number;
  shield?: number;
  maxShield?: number;
  // 2D rotation (legacy support)
  angle: number;
  // 3D rotation
  rotation?: { x: number; y: number; z: number };
  quaternion?: { x: number; y: number; z: number; w: number };
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
  // 2D trail (legacy support)
  trail?: { x: number; y: number }[];
  // 3D trail
  trail3D?: { x: number; y: number; z: number }[];
  shieldRegen?: number;
  shieldPercent?: number;
  hpPercent?: number;
  armor?: number;
  size?: "small" | "medium" | "large";
  // parentId is set on ships spawned by other entities (e.g. fighters launched by a carrier)
  parentId?: number;
  // Internal carrier timer accumulator (seconds). Not serialized.
  _carrierTimer?: number;
  // Ship scaling
  shipScale?: number;
  baseScale?: number;
  scale?: number;
  collisionRadius?: number;
  // Component positions (3D)
  turrets?: Array<
    | [number, number, number]
    | {
        position: [number, number, number];
        angle?: number;
        targetAngle?: number;
        spread?: number;
        barrel?: number;
        cooldown?: number;
        kind?: string;
      }
  >;
  engines?: Array<{ x: number; y: number; z: number }>;
  hardpoints?: Array<{ x: number; y: number; z: number }>;
  // Turrets (legacy 2D format for backward compatibility)
  turrets2D?: Array<
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
  z = 0,
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
  const sizeDefaults = getSizeDefaultsSafe(
    sizeVal as "small" | "medium" | "large",
  );
  const cfg = Object.assign({}, sizeDefaults, rawCfg) as Partial<ShipSpec>;
  const ship = {
    id: genId(),
    type: resolvedType,
    // 2D position (legacy)
    x,
    y,
    // 3D position
    position: { x, y, z },
    // 2D velocity (legacy)
    vx: 0,
    vy: 0,
    // 3D velocity
    velocity: { x: 0, y: 0, z: 0 },
    // 3D acceleration
    acceleration: { x: 0, y: 0, z: 0 },
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
    // Shallow-clone cannons to avoid mutating config and avoid expensive JSON roundtrip
    cannons: Array.isArray(cfg.cannons)
      ? (cfg.cannons as any[]).map((c) => (c && typeof c === "object" ? { ...c } : c))
      : [],
    // Keep raw turret defs here for now; we'll normalize below via helper so
    // normalization logic is centralized and reusable by snapshot handlers.
    turrets: cfg.turrets || [],
    // Initialize 3D component positions (will be populated from config)
    engines: [],
    hardpoints: [],
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
    // 2D rotation (legacy)
    angle: 0,
    // 3D rotation
    rotation: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: 0, z: 0, w: 1 },
    // 3D trail
    trail3D: undefined,
    trail: undefined,
    shieldPercent: 1,
    hpPercent: 1,
    // Ship scaling
    shipScale: 1.0,
    baseScale: 1.0,
    scale: 1.0,
    collisionRadius: cfg.radius || 6,
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
  // 2D position (legacy support)
  x: number;
  y: number;
  // 3D position
  position?: { x: number; y: number; z: number };
  // 2D velocity (legacy support)
  vx: number;
  vy: number;
  // 3D velocity
  velocity?: { x: number; y: number; z: number };
  team: string;
  ownerId?: number | null;
  damage: number;
  ttl: number;
  radius?: number;
  bulletRadius?: number;
  bulletTTL?: number;
  kind?: string;
  alive?: boolean;
  // 2D previous position (legacy support)
  prevX?: number;
  prevY?: number;
  _prevX?: number;
  _prevY?: number;
  // 3D previous position
  prevPosition?: { x: number; y: number; z: number };
  _prevPosition?: { x: number; y: number; z: number };
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
  z: number,
  vx: number,
  vy: number,
  vz: number,
  team = TEAM_DEFAULT,
  ownerId: number | null = null,
  damage = 1,
  ttl = 2.0,
): Bullet {
  const b = bulletPool.acquire();
  b.id = genId();
  // 2D position (legacy)
  b.x = x;
  b.y = y;
  // 3D position
  b.position = { x, y, z };
  // 2D velocity (legacy)
  b.vx = vx;
  b.vy = vy;
  // 3D velocity
  b.velocity = { x: vx, y: vy, z: vz };
  b.team = team;
  b.ownerId = ownerId;
  b.damage = damage;
  b.ttl = ttl;
  // Previous positions
  b.prevX = x;
  b.prevY = y;
  b._prevX = x;
  b._prevY = y;
  b.prevPosition = { x, y, z };
  b._prevPosition = { x, y, z };
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
  // 2D position (legacy support)
  x: number;
  y: number;
  // 3D position
  position?: { x: number; y: number; z: number };
  r?: number;
  life?: number;
  ttl?: number;
  alive?: boolean;
  _pooled?: boolean;
  [key: string]: unknown;
}
export interface ShieldHitEffect {
  // 2D position (legacy support)
  x: number;
  y: number;
  // 3D position
  position?: { x: number; y: number; z: number };
  magnitude?: number;
  alive?: boolean;
  _pooled?: boolean;
  [key: string]: unknown;
}
export interface HealthHitEffect {
  // 2D position (legacy support)
  x: number;
  y: number;
  // 3D position
  position?: { x: number; y: number; z: number };
  amount?: number;
  alive?: boolean;
  _pooled?: boolean;
  [key: string]: unknown;
}

export function createExplosionEffect(
  init?: Partial<ExplosionEffect>,
): ExplosionEffect {
  return {
    // 2D position (legacy)
    x: init?.x ?? 0,
    y: init?.y ?? 0,
    // 3D position
    position: init?.position ?? { x: init?.x ?? 0, y: init?.y ?? 0, z: 0 },
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
  // 2D position (legacy)
  obj.x = init?.x ?? 0;
  obj.y = init?.y ?? 0;
  // 3D position
  obj.position = init?.position ?? { x: init?.x ?? 0, y: init?.y ?? 0, z: 0 };
  obj.r = init?.r;
  obj.alive = true;
  obj._pooled = false;
  Object.assign(obj, init);
}
export function createShieldHitEffect(
  init?: Partial<ShieldHitEffect>,
): ShieldHitEffect {
  return {
    // 2D position (legacy)
    x: init?.x ?? 0,
    y: init?.y ?? 0,
    // 3D position
    position: init?.position ?? { x: init?.x ?? 0, y: init?.y ?? 0, z: 0 },
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
  // 2D position (legacy)
  obj.x = init?.x ?? 0;
  obj.y = init?.y ?? 0;
  // 3D position
  obj.position = init?.position ?? { x: init?.x ?? 0, y: init?.y ?? 0, z: 0 };
  obj.magnitude = init?.magnitude;
  obj.alive = true;
  obj._pooled = false;
  Object.assign(obj, init);
}
export function createHealthHitEffect(
  init?: Partial<HealthHitEffect>,
): HealthHitEffect {
  return {
    // 2D position (legacy)
    x: init?.x ?? 0,
    y: init?.y ?? 0,
    // 3D position
    position: init?.position ?? { x: init?.x ?? 0, y: init?.y ?? 0, z: 0 },
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
  // 2D position (legacy)
  obj.x = init?.x ?? 0;
  obj.y = init?.y ?? 0;
  // 3D position
  obj.position = init?.position ?? { x: init?.x ?? 0, y: init?.y ?? 0, z: 0 };
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
