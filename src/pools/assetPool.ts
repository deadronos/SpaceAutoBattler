import type { GameState } from "../types";

// PoolEntry and Pooled types
export type PoolEntry<T> = {
  freeList: T[];
  allocated: number;
  config?: { max?: number; strategy?: "discard-oldest" | "grow" | "error" };
  disposer?: (item: T) => void;
};
export type TexturePoolEntry = PoolEntry<WebGLTexture>;

export interface Pooled<T = Record<string, unknown>> {
  reset?: (initArgs?: Partial<T>) => void;
}

function _getStrategy(v: unknown, def: "discard-oldest" | "grow" | "error") {
  return v === "grow" || v === "error" || v === "discard-oldest"
    ? (v as "discard-oldest" | "grow" | "error")
    : def;
}
function _incCount(map: Map<string, number>, key: string, delta: number) {
  const cur = map.get(key) || 0;
  const next = cur + delta;
  if (next <= 0) map.delete(key);
  else map.set(key, next);
}

export function makePooled<T extends object>(
  obj: T,
  resetFn?: (obj: T, initArgs?: Partial<T>) => void,
): T & Pooled<T> {
  const o = obj as T & Pooled<T>;
  if (typeof o.reset !== "function") {
    if (typeof resetFn === "function") {
      o.reset = function (initArgs?: Partial<T>) {
        try {
          resetFn(o, initArgs);
        } catch {}
      };
    } else {
      o.reset = function (initArgs?: Partial<T>) {
        if (initArgs && typeof initArgs === "object") Object.assign(o, initArgs);
      };
    }
  }
  return o;
}

export type PooledFactory<T extends object> = {
  create: () => T;
  reset?: (obj: T, initArgs?: Partial<T>) => void;
};
export function createPooledFactory<T extends object>(
  createOrFactory: (() => T) | PooledFactory<T>,
  resetFn?: (obj: T, initArgs?: Partial<T>) => void,
): PooledFactory<T> {
  if (typeof createOrFactory === "function")
    return { create: createOrFactory as () => T, reset: resetFn };
  const f = createOrFactory as PooledFactory<T>;
  return { create: f.create, reset: f.reset };
}

// Ensure state.assetPool shape exists and has sensible defaults
export function ensureAssetPool(state: any) {
  if (!state) return;
  if (!state.assetPool || typeof state.assetPool !== "object") {
    state.assetPool = {
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
    } as any;
  } else {
    state.assetPool.textures = state.assetPool.textures || new Map();
    state.assetPool.sprites = state.assetPool.sprites || new Map();
    state.assetPool.effects = state.assetPool.effects || new Map();
    state.assetPool.counts = state.assetPool.counts || {
      textures: new Map<string, number>(),
      sprites: new Map<string, number>(),
      effects: new Map<string, number>(),
    };
    state.assetPool.config = state.assetPool.config || {
      texturePoolSize: 128,
      spritePoolSize: 256,
      effectPoolSize: 128,
      textureOverflowStrategy: "discard-oldest",
      spriteOverflowStrategy: "discard-oldest",
      effectOverflowStrategy: "discard-oldest",
    };
  }
}

export function acquireEffect<T extends object>(
  state: GameState,
  key: string,
  createFn: () => T & Pooled<T>,
  initArgs?: Partial<T>,
): T & Pooled<T> {
  ensureAssetPool(state);
  const poolMap = state.assetPool.effects as Map<string, PoolEntry<T & Pooled<T>>>;
  const counts = state.assetPool.counts?.effects || new Map<string, number>();
  if (!state.assetPool.counts)
    state.assetPool.counts = {
      textures: new Map(),
      sprites: new Map(),
      effects: counts,
    };
  let entry = poolMap.get(key);
  if (!entry) {
    entry = { freeList: [], allocated: 0 };
    poolMap.set(key, entry);
  }
  const free = entry.freeList as Array<T & Pooled<T>>;
  if (free.length) {
    const obj = free.pop()! as T & Pooled<T>;
    try {
      if (typeof obj.reset === "function") obj.reset(initArgs);
      else if (initArgs && typeof initArgs === "object") Object.assign(obj, initArgs);
    } catch {}
    return obj;
  }
  const max = state.assetPool.config.effectPoolSize || 128;
  const strategy = _getStrategy(state.assetPool.config.effectOverflowStrategy, "discard-oldest");
  const total = entry.allocated || counts.get(key) || 0;
  if (total < max || strategy === "grow") {
    const e = createFn() as T & Pooled<T>;
    try {
      if (typeof e.reset === "function") e.reset(initArgs);
      else if (initArgs && typeof initArgs === "object") Object.assign(e, initArgs);
    } catch {}
    entry.allocated = (entry.allocated || 0) + 1;
    _incCount(counts, key, 1);
    return e;
  }
  if (strategy === "error") throw new Error(`Effect pool exhausted for key "${key}" (max=${max})`);
  const e = createFn() as T & Pooled<T>;
  entry.allocated = (entry.allocated || 0) + 1;
  _incCount(counts, key, 1);
  return e;
}

export function releaseEffect<T extends object>(
  state: GameState,
  key: string,
  effect: T & Pooled<T>,
  disposeFn?: (e: T) => void,
) {
  ensureAssetPool(state);
  const poolMap = state.assetPool.effects as Map<string, PoolEntry<T & Pooled<T>>>;
  const counts = state.assetPool.counts?.effects || new Map<string, number>();
  if (!state.assetPool.counts)
    state.assetPool.counts = {
      textures: new Map(),
      sprites: new Map(),
      effects: counts,
    };
  let entry = poolMap.get(key);
  if (!entry) {
    entry = { freeList: [], allocated: 0 };
    poolMap.set(key, entry);
  }
  const free = entry.freeList as Array<T & Pooled<T>>;
  if (!free.includes(effect)) free.push(effect as T & Pooled<T>);
  const max = state.assetPool.config.effectPoolSize || 128;
  const strategy = _getStrategy(state.assetPool.config.effectOverflowStrategy, "discard-oldest");
  if (strategy === "grow") return;
  while (free.length > max) {
    const victim = strategy === "discard-oldest" ? free.shift()! : free.pop()!;
    try {
      if (disposeFn) disposeFn(victim as any);
    } catch {}
    _incCount(counts, key, -1);
  }
  if (strategy === "error" && free.length > max) {
    const victim = free.pop()!;
    try {
      if (disposeFn) disposeFn(victim as any);
    } catch {}
    _incCount(counts, key, -1);
  }
}

export function acquireTexture(
  state: GameState,
  key: string,
  createFn: () => WebGLTexture,
): WebGLTexture {
  ensureAssetPool(state);
  const poolMap = state.assetPool.textures as Map<string, TexturePoolEntry>;
  const counts = state.assetPool.counts?.textures || new Map<string, number>();
  let entry = poolMap.get(key);
  if (!entry) {
    entry = { freeList: [], allocated: 0 };
    poolMap.set(key, entry);
  }
  const free = entry.freeList;
  if (free.length) return free.pop()!;
  const max = (entry.config?.max ?? state.assetPool.config.texturePoolSize) || 128;
  const strategy = entry.config?.strategy ?? _getStrategy(state.assetPool.config.textureOverflowStrategy, "discard-oldest");
  const total = entry.allocated || counts.get(key) || 0;
  if (total < max || strategy === "grow") {
    const tex = createFn();
    entry.allocated = (entry.allocated || 0) + 1;
    _incCount(counts, key, 1);
    return tex;
  }
  if (strategy === "error") throw new Error(`Texture pool exhausted for key "${key}" (max=${max})`);
  const tex = createFn();
  entry.allocated = (entry.allocated || 0) + 1;
  _incCount(counts, key, 1);
  return tex;
}

export function releaseTexture(
  state: GameState,
  key: string,
  tex: WebGLTexture,
  disposeFn?: (t: WebGLTexture) => void,
) {
  ensureAssetPool(state);
  const poolMap = state.assetPool.textures as Map<string, TexturePoolEntry>;
  const counts = state.assetPool.counts?.textures || new Map<string, number>();
  let entry = poolMap.get(key);
  if (!entry) {
    entry = { freeList: [], allocated: 0 };
    poolMap.set(key, entry);
  }
  const free = entry.freeList;
  if (!free.includes(tex)) free.push(tex);
  const max = (entry.config?.max ?? state.assetPool.config.texturePoolSize) || 128;
  const strategy = entry.config?.strategy ?? _getStrategy(state.assetPool.config.textureOverflowStrategy, "discard-oldest");
  const countsMap = state.assetPool.counts?.textures || new Map<string, number>();
  if (strategy === "grow") return;
  while (free.length > max) {
    const victim = strategy === "discard-oldest" ? free.shift()! : free.pop()!;
    try {
      if (entry!.disposer) entry!.disposer(victim as any);
      else if (disposeFn) disposeFn(victim as any);
    } catch {}
    _incCount(countsMap, key, -1);
    entry.allocated = Math.max(0, (entry.allocated || 0) - 1);
  }
  if (strategy === "error" && free.length > max) {
    const victim = free.pop()!;
    try {
      if (entry!.disposer) entry!.disposer(victim as any);
      else if (disposeFn) disposeFn(victim as any);
    } catch {}
    _incCount(countsMap, key, -1);
    entry.allocated = Math.max(0, (entry.allocated || 0) - 1);
  }
}

export function acquireSprite<T extends object>(
  state: GameState,
  key: string,
  createFn: () => T & Pooled<T>,
  initArgs?: Partial<T>,
): T & Pooled<T> {
  ensureAssetPool(state);
  const poolMap = state.assetPool.sprites as Map<string, PoolEntry<T & Pooled<T>>>;
  const counts = state.assetPool.counts?.sprites || new Map<string, number>();
  if (!state.assetPool.counts)
    state.assetPool.counts = {
      textures: new Map(),
      sprites: counts,
      effects: new Map(),
    };
  let entry = poolMap.get(key);
  if (!entry) {
    entry = { freeList: [], allocated: 0 };
    poolMap.set(key, entry);
  }
  const free = entry.freeList as Array<T & Pooled<T>>;
  if (free.length) {
    const obj = free.pop()! as T & Pooled<T>;
    try {
      if (typeof obj.reset === "function") obj.reset(initArgs);
      else if (initArgs && typeof initArgs === "object") Object.assign(obj, initArgs);
    } catch {}
    return obj;
  }
  const max = state.assetPool.config.spritePoolSize || 256;
  const strategy = _getStrategy(state.assetPool.config.spriteOverflowStrategy, "discard-oldest");
  const total = entry.allocated || counts.get(key) || 0;
  if (total < max || strategy === "grow") {
    const s = createFn() as T & Pooled<T>;
    try {
      if (typeof s.reset === "function") s.reset(initArgs);
      else if (initArgs && typeof initArgs === "object") Object.assign(s, initArgs);
    } catch {}
    entry.allocated = (entry.allocated || 0) + 1;
    _incCount(counts, key, 1);
    return s;
  }
  if (strategy === "error") throw new Error(`Sprite pool exhausted for key "${key}" (max=${max})`);
  const s = createFn() as T & Pooled<T>;
  entry.allocated = (entry.allocated || 0) + 1;
  _incCount(counts, key, 1);
  return s;
}

export function releaseSprite<T extends object>(
  state: GameState,
  key: string,
  sprite: T & Pooled<T>,
  disposeFn?: (s: T) => void,
) {
  ensureAssetPool(state);
  const poolMap = state.assetPool.sprites as Map<string, PoolEntry<T & Pooled<T>>>;
  const counts = state.assetPool.counts?.sprites || new Map<string, number>();
  if (!state.assetPool.counts)
    state.assetPool.counts = {
      textures: new Map(),
      sprites: counts,
      effects: new Map(),
    };
  let entry = poolMap.get(key);
  if (!entry) {
    entry = { freeList: [], allocated: 0 };
    poolMap.set(key, entry);
  }
  const free = entry.freeList as Array<T & Pooled<T>>;
  if (!free.includes(sprite)) free.push(sprite as T & Pooled<T>);
  const max = state.assetPool.config.spritePoolSize || 256;
  const strategy = _getStrategy(state.assetPool.config.spriteOverflowStrategy, "discard-oldest");
  if (strategy === "grow") return;
  while (free.length > max) {
    const victim = strategy === "discard-oldest" ? free.shift()! : free.pop()!;
    try {
      if (disposeFn) disposeFn(victim as any);
    } catch {}
    _incCount(counts, key, -1);
  }
  if (strategy === "error" && free.length > max) {
    const victim = free.pop()!;
    try {
      if (disposeFn) disposeFn(victim as any);
    } catch {}
    _incCount(counts, key, -1);
  }
}

export default {} as any;
