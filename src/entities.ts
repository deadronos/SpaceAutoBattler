import { getShipConfig, getDefaultShipType, BULLET_DEFAULTS } from "./config/entitiesConfig";
import { TEAM_DEFAULT } from "./config/teamsConfig";
import type { ShipConfigMap, ShipSpec } from "./types/index";

let nextId = 1;
export function genId(): number {
  return nextId++;
}

export type Cannon = {
  damage: number;
  rate: number;
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
  team?: string;
  xp?: number;
  level?: number;
  cannons?: Cannon[];
  accel?: number; // max acceleration from config
  currentAccel?: number; // dynamic, set by AI/gamemanager, 0..accel
  throttle?: number; // 0..1, set by AI/gamemanager
  steering?: number; // -1..1, set by AI/gamemanager
  turnRate?: number;
  radius?: number;
  angle?: number; // heading in radians
  friction?: number; // velocity damping factor (default 0.98)
  maxSpeed?: number; // max speed override for tests/simulation
  // optional AI runtime slot used by tests and behavior logic
  __ai?: any;
  // Renderer/simulation convenience fields
  hpPercent?: number;
  shieldPercent?: number;
  shieldRegen?: number;
  trail?: { x: number; y: number }[];
  turrets?: Array<{
    position: [number, number];
    kind: string;
    targeting?: string;
    cooldown?: number;
    lastFired?: number;
  }>;
};

export function createShip(
  type: string | undefined = undefined,
  x = 0,
  y = 0,
  team = TEAM_DEFAULT,
): Ship {
  const shipCfg = getShipConfig() as ShipConfigMap;
  const availableTypes = Object.keys(shipCfg || {});
  const resolvedType =
    type && shipCfg[type]
      ? type
      : availableTypes.length
        ? availableTypes[0]
        : getDefaultShipType();
  const cfg = (shipCfg[resolvedType] ||
    shipCfg[getDefaultShipType()]) as Partial<ShipSpec>;
  return {
    id: genId(),
    type: resolvedType,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: cfg.maxHp,
    maxHp: cfg.maxHp,
    shield: cfg.maxShield || 0,
    maxShield: cfg.maxShield || 0,
    team,
    xp: 0,
    level: 1,
    cannons: JSON.parse(JSON.stringify(cfg.cannons || [])),
    accel: cfg.accel || 0,
    currentAccel: 0, // start at rest, AI/gamemanager sets this
    throttle: 0, // start at rest, AI/gamemanager sets this
    steering: 0, // start straight, AI/gamemanager sets this
    turnRate: cfg.turnRate || 0,
    radius: cfg.radius || 6,
    maxSpeed: cfg.maxSpeed || undefined,
    angle: 0,
  } as Ship;
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
};

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
  return {
    id: genId(),
    x,
    y,
    vx,
    vy,
    team,
    ownerId,
    damage,
    ttl,
  } as Bullet;
}

export type GameState = {
  t: number;
  ships: Ship[];
  bullets: Bullet[];
  explosions: any[];
  shieldHits: any[];
  healthHits: any[];
  engineTrailsEnabled?: boolean;
  starCanvas?: HTMLCanvasElement;
  assetPool: {
    textures: Map<string, WebGLTexture[]>;
    sprites: Map<string, any[]>;
    effects: Map<string, any[]>;
    // Total allocated per key (in-use + free). Used to enforce max capacity.
    counts?: {
      textures: Map<string, number>;
      sprites: Map<string, number>;
      effects: Map<string, number>;
    };
    config: {
      texturePoolSize: number;
      spritePoolSize: number;
      effectPoolSize: number;
      // Overflow strategy when pool capacity is exceeded
      // - 'discard-oldest': trim extra free entries on release by disposing oldest
      // - 'grow': allow pool to expand beyond configured size
      // - 'error': throw on acquire when exhausted; on release, do not retain extra
      textureOverflowStrategy?: 'discard-oldest' | 'grow' | 'error';
      spriteOverflowStrategy?: 'discard-oldest' | 'grow' | 'error';
      effectOverflowStrategy?: 'discard-oldest' | 'grow' | 'error';
    };
  };
};

export function makeInitialState(): GameState {
  return {
    t: 0,
    ships: [],
    bullets: [],
    explosions: [],
    shieldHits: [],
    healthHits: [],
    engineTrailsEnabled: true,
    assetPool: {
      textures: new Map<string, WebGLTexture[]>(),
      sprites: new Map<string, any[]>(),
      effects: new Map<string, any[]>(),
      counts: {
        textures: new Map<string, number>(),
        sprites: new Map<string, number>(),
        effects: new Map<string, number>(),
      },
      config: {
        texturePoolSize: 128,
        spritePoolSize: 256,
        effectPoolSize: 128,
        textureOverflowStrategy: 'discard-oldest',
        spriteOverflowStrategy: 'discard-oldest',
        effectOverflowStrategy: 'discard-oldest',
      },
    },
  };
}

// Pooled object interface: objects that can be reset when reused from pool
export interface Pooled {
  reset?: (initArgs?: any) => void;
}

// A factory that creates pooled objects and optionally knows how to reset them.
// - create: returns a fresh object instance (not yet pooled)
// - reset?: resets an existing instance when reused from the pool
export type PooledFactory<T extends object> = {
  create: () => T;
  // Optional reset function receives (obj, initArgs) and should rehydrate obj
  reset?: (obj: T, initArgs?: any) => void;
};

/**
 * Helper to author pooled factories easily. Accepts either a createFn and
 * optional resetFn, or a single factory object, and returns a normalized
 * PooledFactory<T> that callers (like acquireSprite/acquireEffect) can use.
 */
export function createPooledFactory<T extends object>(
  createOrFactory: (() => T) | PooledFactory<T>,
  resetFn?: (obj: T, initArgs?: any) => void,
): PooledFactory<T> {
  if (typeof createOrFactory === 'function') {
    return { create: createOrFactory as () => T, reset: resetFn };
  }
  // assume it's already a factory-like object
  const f = createOrFactory as PooledFactory<T>;
  return { create: f.create, reset: f.reset };
}

/*
Usage example:

// Create a small factory where reset rehydrates position when reused
const bulletFactory = createPooledFactory(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, alive: true }),
  (obj, initArgs) => {
    obj.x = initArgs?.x ?? 0;
    obj.y = initArgs?.y ?? 0;
    obj.vx = initArgs?.vx ?? 0;
    obj.vy = initArgs?.vy ?? 0;
    obj.alive = true;
  },
);

// When handing to pooling helpers, use factory.create to allocate and
// makePooled(factory.create(), factory.reset) to ensure the object has a
// callable reset method for reuse. The pooling helpers will call reset(initArgs)
// on reuse, or shallow-assign initArgs if reset is not present.
*/

/**
 * Wrap an object and ensure it satisfies the Pooled contract by attaching
 * a reset method if one is not present. The resetFn receives (obj, initArgs)
 * and should mutate obj to rehydrate it.
 */
export function makePooled<T extends object>(obj: T, resetFn?: (obj: T, initArgs?: any) => void): T & Pooled {
  const o = obj as T & Pooled;
  if (typeof o.reset !== 'function') {
    if (typeof resetFn === 'function') {
      o.reset = function (initArgs?: any) { try { resetFn(o, initArgs); } catch {} };
    } else {
      o.reset = function (initArgs?: any) { if (initArgs && typeof initArgs === 'object') Object.assign(o, initArgs); };
    }
  }
  return o;
}

    // --- Asset Pooling Helpers ---
    // Utilities
    function _getStrategy(v: any, def: 'discard-oldest'|'grow'|'error'): 'discard-oldest'|'grow'|'error' {
      return v === 'grow' || v === 'error' || v === 'discard-oldest' ? v : def;
    }
    function _incCount(map: Map<string, number>, key: string, delta: number) {
      const cur = map.get(key) || 0;
      const next = cur + delta;
      if (next <= 0) map.delete(key);
      else map.set(key, next);
    }

    // Acquire a texture from the pool. Create new if none free and under policy.
    export function acquireTexture(
      state: GameState,
      key: string,
      createFn: () => WebGLTexture,
    ): WebGLTexture {
      const freeMap = state.assetPool.textures;
      const counts = state.assetPool.counts?.textures || new Map<string, number>();
      if (!state.assetPool.counts) {
        state.assetPool.counts = {
          textures: counts,
          sprites: new Map<string, number>(),
          effects: new Map<string, number>(),
        };
      }
      const free = freeMap.get(key) || [];
      if (free.length) {
        return free.pop()!;
      }
      const max = state.assetPool.config.texturePoolSize || 128;
      const strategy = _getStrategy(state.assetPool.config.textureOverflowStrategy, 'discard-oldest');
      const total = counts.get(key) || 0;
      if (total < max || strategy === 'grow') {
        const tex = createFn();
        _incCount(counts, key, 1);
        return tex;
      }
      // Exhausted
      if (strategy === 'error') {
        throw new Error(`Texture pool exhausted for key "${key}" (max=${max})`);
      }
      // discard-oldest cannot reclaim an in-use resource on acquire; fallback to grow
      const tex = createFn();
      _incCount(counts, key, 1);
      return tex;
    }

    // Release a texture back to the pool. Optionally dispose extras via disposer.
    export function releaseTexture(
      state: GameState,
      key: string,
      tex: WebGLTexture,
      disposeFn?: (t: WebGLTexture) => void,
    ) {
      const freeMap = state.assetPool.textures;
      let free = freeMap.get(key);
      if (!free) {
        free = [];
        freeMap.set(key, free);
      }
      if (!free.includes(tex)) free.push(tex);

      const max = state.assetPool.config.texturePoolSize || 128;
      const strategy = _getStrategy(state.assetPool.config.textureOverflowStrategy, 'discard-oldest');
      const counts = state.assetPool.counts?.textures || new Map<string, number>();
      if (!state.assetPool.counts) {
        state.assetPool.counts = {
          textures: counts,
          sprites: new Map<string, number>(),
          effects: new Map<string, number>(),
        };
      }
      // Enforce capacity on the free list
      if (strategy === 'grow') return;
      while (free.length > max) {
        // Discard oldest (FIFO) to keep most-recent resources hot
        const victim = strategy === 'discard-oldest' ? free.shift()! : free.pop()!;
        try { disposeFn && victim && disposeFn(victim); } catch {}
        _incCount(counts, key, -1);
      }
      if (strategy === 'error' && free.length > max) {
        // Ensure we don't exceed capacity even in edge cases
        const victim = free.pop()!;
        try { disposeFn && victim && disposeFn(victim); } catch {}
        _incCount(counts, key, -1);
      }
    }

    // Acquire a sprite from the pool
  // acquireSprite now accepts optional initArgs. If the created/reused object
  // implements a `reset(initArgs)` method, it will be called. Otherwise, if
  // initArgs is an object, its properties are shallow-copied onto the object.
  export function acquireSprite(state: GameState, key: string, createFn: () => any, initArgs?: any): any {
      const freeMap = state.assetPool.sprites;
      const counts = state.assetPool.counts?.sprites || new Map<string, number>();
      if (!state.assetPool.counts) {
        state.assetPool.counts = {
          textures: new Map<string, number>(),
          sprites: counts,
          effects: new Map<string, number>(),
        };
      }
      const free = freeMap.get(key) || [];
      if (free.length) {
        const obj = free.pop()!;
        try {
          if (typeof (obj as any).reset === 'function') (obj as any).reset(initArgs);
          else if (initArgs && typeof initArgs === 'object') Object.assign(obj, initArgs);
        } catch {}
        return obj;
      }
      const max = state.assetPool.config.spritePoolSize || 256;
      const strategy = _getStrategy(state.assetPool.config.spriteOverflowStrategy, 'discard-oldest');
      const total = counts.get(key) || 0;
      if (total < max || strategy === 'grow') {
        const s = createFn();
        try {
          if (typeof (s as any).reset === 'function') (s as any).reset(initArgs);
          else if (initArgs && typeof initArgs === 'object') Object.assign(s, initArgs);
        } catch {}
        _incCount(counts, key, 1);
        return s;
      }
      if (strategy === 'error') throw new Error(`Sprite pool exhausted for key "${key}" (max=${max})`);
      const s = createFn();
      _incCount(counts, key, 1);
      return s;
    }

  export function releaseSprite(state: GameState, key: string, sprite: any, disposeFn?: (s: any) => void) {
      const freeMap = state.assetPool.sprites;
      let free = freeMap.get(key);
      if (!free) { free = []; freeMap.set(key, free); }
      if (!free.includes(sprite)) free.push(sprite);
      const max = state.assetPool.config.spritePoolSize || 256;
      const strategy = _getStrategy(state.assetPool.config.spriteOverflowStrategy, 'discard-oldest');
      const counts = state.assetPool.counts?.sprites || new Map<string, number>();
      if (!state.assetPool.counts) {
        state.assetPool.counts = {
          textures: new Map<string, number>(),
          sprites: counts,
          effects: new Map<string, number>(),
        };
      }
      if (strategy === 'grow') return;
      while (free.length > max) {
        const victim = strategy === 'discard-oldest' ? free.shift()! : free.pop()!;
        try { disposeFn && victim && disposeFn(victim); } catch {}
        _incCount(counts, key, -1);
      }
      if (strategy === 'error' && free.length > max) {
        const victim = free.pop()!;
        try { disposeFn && victim && disposeFn(victim); } catch {}
        _incCount(counts, key, -1);
      }
    }

    // Acquire an effect from the pool
  export function acquireEffect(state: GameState, key: string, createFn: () => any, initArgs?: any): any {
      const freeMap = state.assetPool.effects;
      const counts = state.assetPool.counts?.effects || new Map<string, number>();
      if (!state.assetPool.counts) {
        state.assetPool.counts = {
          textures: new Map<string, number>(),
          sprites: new Map<string, number>(),
          effects: counts,
        };
      }
      const free = freeMap.get(key) || [];
      if (free.length) {
        const obj = free.pop()!;
        try {
          if (typeof (obj as any).reset === 'function') (obj as any).reset(initArgs);
          else if (initArgs && typeof initArgs === 'object') Object.assign(obj, initArgs);
        } catch {}
        return obj;
      }
      const max = state.assetPool.config.effectPoolSize || 128;
      const strategy = _getStrategy(state.assetPool.config.effectOverflowStrategy, 'discard-oldest');
      const total = counts.get(key) || 0;
      if (total < max || strategy === 'grow') {
        const e = createFn();
        try {
          if (typeof (e as any).reset === 'function') (e as any).reset(initArgs);
          else if (initArgs && typeof initArgs === 'object') Object.assign(e, initArgs);
        } catch {}
        _incCount(counts, key, 1);
        return e;
      }
      if (strategy === 'error') throw new Error(`Effect pool exhausted for key "${key}" (max=${max})`);
      const e = createFn();
      _incCount(counts, key, 1);
      return e;
    }

    export function releaseEffect(state: GameState, key: string, effect: any, disposeFn?: (e: any) => void) {
      const freeMap = state.assetPool.effects;
      let free = freeMap.get(key);
      if (!free) { free = []; freeMap.set(key, free); }
      if (!free.includes(effect)) free.push(effect);
      const max = state.assetPool.config.effectPoolSize || 128;
      const strategy = _getStrategy(state.assetPool.config.effectOverflowStrategy, 'discard-oldest');
      const counts = state.assetPool.counts?.effects || new Map<string, number>();
      if (!state.assetPool.counts) {
        state.assetPool.counts = {
          textures: new Map<string, number>(),
          sprites: new Map<string, number>(),
          effects: counts,
        };
      }
      if (strategy === 'grow') return;
      while (free.length > max) {
        const victim = strategy === 'discard-oldest' ? free.shift()! : free.pop()!;
        try { disposeFn && victim && disposeFn(victim); } catch {}
        _incCount(counts, key, -1);
      }
      if (strategy === 'error' && free.length > max) {
        const victim = free.pop()!;
        try { disposeFn && victim && disposeFn(victim); } catch {}
        _incCount(counts, key, -1);
      }
    }
export default { createShip, createBullet, makeInitialState };
