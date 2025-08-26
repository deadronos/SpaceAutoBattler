import type { GameState } from "../types";
import { acquireItem, releaseItem } from './PoolManager';

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

// Helper: prefer per-entry config.max if set, otherwise use the named global config
function entryConfigOr(state: any, key: string, globalName: 'texturePoolSize' | 'spritePoolSize' | 'effectPoolSize') {
  const poolMap = (globalName === 'texturePoolSize' ? state.assetPool.textures : globalName === 'spritePoolSize' ? state.assetPool.sprites : state.assetPool.effects) as Map<string, PoolEntry<any>>;
  const entry = poolMap && poolMap.get ? poolMap.get(key) : undefined;
  if (entry && entry.config && typeof entry.config.max === 'number') return entry.config.max;
  return state.assetPool.config ? state.assetPool.config[globalName] : undefined;
}

function entryStrategyOr(state: any, key: string, globalName: 'textureOverflowStrategy' | 'spriteOverflowStrategy' | 'effectOverflowStrategy') {
  const poolMap = (globalName === 'textureOverflowStrategy' ? state.assetPool.textures : globalName === 'spriteOverflowStrategy' ? state.assetPool.sprites : state.assetPool.effects) as Map<string, PoolEntry<any>>;
  const entry = poolMap && poolMap.get ? poolMap.get(key) : undefined;
  if (entry && entry.config && entry.config.strategy) return entry.config.strategy;
  return state.assetPool.config ? state.assetPool.config[globalName] : undefined;
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
  // Delegate to PoolManager.acquireItem to centralize overflow semantics
  const poolMap = state.assetPool.effects as Map<string, PoolEntry<T & Pooled<T>>>;
  state.assetPool.counts = state.assetPool.counts || { textures: new Map(), sprites: new Map(), effects: new Map() } as any;
  const counts = state.assetPool.counts!.effects as Map<string, number>;
  return acquireItem<T & Pooled<T>>({
    map: poolMap,
    counts,
    key,
    createFn: createFn as any,
    globalMax: state.assetPool.config.effectPoolSize,
    globalStrategy: _getStrategy(state.assetPool.config.effectOverflowStrategy, 'discard-oldest'),
    initFn: (obj: T & Pooled<T>, args?: Partial<T>) => {
      try {
        if (typeof obj.reset === 'function') obj.reset(args);
        else if (args && typeof args === 'object') Object.assign(obj as any, args);
      } catch {}
    },
    initArgs,
  }) as T & Pooled<T>;
}

export function releaseEffect<T extends object>(
  state: GameState,
  key: string,
  effect: T & Pooled<T>,
  disposeFn?: (e: T) => void,
) {
  ensureAssetPool(state);
  const poolMap = state.assetPool.effects as Map<string, PoolEntry<T & Pooled<T>>>;
  state.assetPool.counts = state.assetPool.counts || { textures: new Map(), sprites: new Map(), effects: new Map() } as any;
  const counts = state.assetPool.counts!.effects as Map<string, number>;
  return releaseItem<T & Pooled<T>>({
    map: poolMap,
    counts,
    key,
    item: effect,
    disposeFn: disposeFn as any,
    globalMax: state.assetPool.config.effectPoolSize,
    globalStrategy: _getStrategy(state.assetPool.config.effectOverflowStrategy, 'discard-oldest'),
  });
}

export function acquireTexture(
  state: GameState,
  key: string,
  createFn: () => WebGLTexture,
): WebGLTexture {
  ensureAssetPool(state);
  const poolMap = state.assetPool.textures as Map<string, TexturePoolEntry>;
  state.assetPool.counts = state.assetPool.counts || { textures: new Map(), sprites: new Map(), effects: new Map() } as any;
  const counts = state.assetPool.counts!.textures as Map<string, number>;
  return acquireItem<WebGLTexture>({
    map: poolMap,
    counts,
    key,
    createFn: createFn as any,
    globalMax: entryConfigOr(state, key, 'texturePoolSize'),
    globalStrategy: entryStrategyOr(state, key, 'textureOverflowStrategy'),
  });
}

export function releaseTexture(
  state: GameState,
  key: string,
  tex: WebGLTexture,
  disposeFn?: (t: WebGLTexture) => void,
) {
  ensureAssetPool(state);
  const poolMap = state.assetPool.textures as Map<string, TexturePoolEntry>;
  state.assetPool.counts = state.assetPool.counts || { textures: new Map(), sprites: new Map(), effects: new Map() } as any;
  const counts = state.assetPool.counts!.textures as Map<string, number>;
  return releaseItem<WebGLTexture>({
    map: poolMap,
    counts,
    key,
    item: tex,
    disposeFn: disposeFn as any,
    globalMax: entryConfigOr(state, key, 'texturePoolSize'),
    globalStrategy: entryStrategyOr(state, key, 'textureOverflowStrategy'),
  });
}

export function acquireSprite<T extends object>(
  state: GameState,
  key: string,
  createFn: () => T & Pooled<T>,
  initArgs?: Partial<T>,
): T & Pooled<T> {
  ensureAssetPool(state);
  state.assetPool.counts = state.assetPool.counts || { textures: new Map(), sprites: new Map(), effects: new Map() } as any;
  const poolMap = state.assetPool.sprites as Map<string, PoolEntry<T & Pooled<T>>>;
  const counts = state.assetPool.counts!.sprites as Map<string, number>;
  return acquireItem<T & Pooled<T>>({
    map: poolMap,
    counts,
    key,
    createFn: createFn as any,
    globalMax: state.assetPool.config.spritePoolSize,
    globalStrategy: _getStrategy(state.assetPool.config.spriteOverflowStrategy, 'discard-oldest'),
    initFn: (obj: T & Pooled<T>, args?: Partial<T>) => {
      try {
        if (typeof obj.reset === 'function') obj.reset(args);
        else if (args && typeof args === 'object') Object.assign(obj as any, args);
      } catch {}
    },
    initArgs,
  }) as T & Pooled<T>;
}

export function releaseSprite<T extends object>(
  state: GameState,
  key: string,
  sprite: T & Pooled<T>,
  disposeFn?: (s: T) => void,
) {
  ensureAssetPool(state);
  state.assetPool.counts = state.assetPool.counts || { textures: new Map(), sprites: new Map(), effects: new Map() } as any;
  const poolMap = state.assetPool.sprites as Map<string, PoolEntry<T & Pooled<T>>>;
  const counts = state.assetPool.counts!.sprites as Map<string, number>;
  return releaseItem<T & Pooled<T>>({
    map: poolMap,
    counts,
    key,
    item: sprite,
    disposeFn: disposeFn as any,
    globalMax: state.assetPool.config.spritePoolSize,
    globalStrategy: _getStrategy(state.assetPool.config.spriteOverflowStrategy, 'discard-oldest'),
  });
}

export default {} as any;
