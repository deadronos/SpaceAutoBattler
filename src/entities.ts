// Effect pooling helpers (typed, per-key)
export function acquireEffect<T extends object>(state: GameState, key: string, createFn: () => T & Pooled<T>, initArgs?: Partial<T>): T & Pooled<T> {
  const poolMap = state.assetPool.effects as Map<string, PoolEntry<T & Pooled<T>>>;
  const counts = state.assetPool.counts?.effects || new Map<string, number>();
  if (!state.assetPool.counts) state.assetPool.counts = { textures: new Map(), sprites: new Map(), effects: counts };
  let entry = poolMap.get(key);
  if (!entry) { entry = { freeList: [], allocated: 0 }; poolMap.set(key, entry); }
  const free = entry.freeList as Array<T & Pooled<T>>;
  if (free.length) {
    const obj = free.pop()! as T & Pooled<T>;
    try {
      if (typeof obj.reset === 'function') obj.reset(initArgs);
      else if (initArgs && typeof initArgs === 'object') Object.assign(obj, initArgs);
    } catch {}
    return obj;
  }
  const max = state.assetPool.config.effectPoolSize || 128;
  const strategy = _getStrategy(state.assetPool.config.effectOverflowStrategy, 'discard-oldest');
  const total = entry.allocated || counts.get(key) || 0;
  if (total < max || strategy === 'grow') {
    const e = createFn() as T & Pooled<T>;
    try {
      if (typeof e.reset === 'function') e.reset(initArgs);
      else if (initArgs && typeof initArgs === 'object') Object.assign(e, initArgs);
    } catch {}
    entry.allocated = (entry.allocated || 0) + 1;
    _incCount(counts, key, 1);
    return e;
  }
  if (strategy === 'error') throw new Error(`Effect pool exhausted for key "${key}" (max=${max})`);
  const e = createFn() as T & Pooled<T>;
  entry.allocated = (entry.allocated || 0) + 1;
  _incCount(counts, key, 1);
  return e;
}

export function releaseEffect<T extends object>(state: GameState, key: string, effect: T & Pooled<T>, disposeFn?: (e: T) => void) {
  const poolMap = state.assetPool.effects as Map<string, PoolEntry<T & Pooled<T>>>;
  const counts = state.assetPool.counts?.effects || new Map<string, number>();
  if (!state.assetPool.counts) state.assetPool.counts = { textures: new Map(), sprites: new Map(), effects: counts };
  let entry = poolMap.get(key);
  if (!entry) { entry = { freeList: [], allocated: 0 }; poolMap.set(key, entry); }
  const free = entry.freeList as Array<T & Pooled<T>>;
  if (!free.includes(effect)) free.push(effect as T & Pooled<T>);
  const max = state.assetPool.config.effectPoolSize || 128;
  const strategy = _getStrategy(state.assetPool.config.effectOverflowStrategy, 'discard-oldest');
  if (strategy === 'grow') return;
  while (free.length > max) {
    const victim = strategy === 'discard-oldest' ? free.shift()! : free.pop()!;
    try { if (disposeFn) disposeFn(victim as any); } catch {}
    _incCount(counts, key, -1);
  }
  if (strategy === 'error' && free.length > max) {
    const victim = free.pop()!;
    try { if (disposeFn) disposeFn(victim as any); } catch {}
    _incCount(counts, key, -1);
  }
}
// Overwrite file with a clean, consolidated implementation.
import type { GameState } from './types';
import { getShipConfig, getDefaultShipType } from './config/entitiesConfig';
import { TEAM_DEFAULT } from './config/teamsConfig';
import type { ShipConfigMap, ShipSpec } from './types';

let nextId = 1;
export function genId(): number { return nextId++; }

export type Cannon = { damage: number; rate: number; spread?: number; muzzleSpeed?: number; bulletRadius?: number; bulletTTL?: number };

export type Ship = {
  id: number; type: string; x: number; y: number; vx: number; vy: number; hp: number; maxHp: number; shield?: number; maxShield?: number; angle: number;
  team?: string; xp?: number; level?: number; cannons?: Cannon[]; accel?: number; currentAccel?: number; throttle?: number; steering?: number; turnRate?: number; radius?: number; maxSpeed?: number;
  trail?: { x: number; y: number }[];
  shieldRegen?: number;
  shieldPercent?: number;
  hpPercent?: number;
};

export function createShip(type: string | undefined = undefined, x = 0, y = 0, team = TEAM_DEFAULT): Ship {
  const shipCfg = getShipConfig() as ShipConfigMap;
  const availableTypes = Object.keys(shipCfg || {});
  const resolvedType = type && shipCfg[type] ? type : availableTypes.length ? availableTypes[0] : getDefaultShipType();
  const cfg = (shipCfg[resolvedType] || shipCfg[getDefaultShipType()]) as Partial<ShipSpec>;
  return {
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
    team,
    xp: 0,
    level: 1,
    cannons: JSON.parse(JSON.stringify(cfg.cannons || [])),
    accel: cfg.accel || 0,
    currentAccel: 0,
    throttle: 0,
    steering: 0,
    turnRate: cfg.turnRate || 0,
    radius: cfg.radius || 6,
    maxSpeed: cfg.maxSpeed,
    angle: 0,
    trail: undefined,
    shieldPercent: 1,
    hpPercent: 1,
  } as Ship;
}

export type Bullet = { id: number; x: number; y: number; vx: number; vy: number; team: string; ownerId?: number | null; damage: number; ttl: number; radius?: number; bulletRadius?: number; bulletTTL?: number; kind?: string; alive?: boolean; prevX?: number; prevY?: number };
export function createBullet(x: number, y: number, vx: number, vy: number, team = TEAM_DEFAULT, ownerId: number | null = null, damage = 1, ttl = 2.0): Bullet {
  return { id: genId(), x, y, vx, vy, team, ownerId, damage, ttl, prevX: x, prevY: y } as Bullet;
}

export interface ExplosionEffect { x: number; y: number; r?: number; alive?: boolean; _pooled?: boolean; [key: string]: unknown }
export interface ShieldHitEffect { x: number; y: number; magnitude?: number; alive?: boolean; _pooled?: boolean; [key: string]: unknown }
export interface HealthHitEffect { x: number; y: number; amount?: number; alive?: boolean; _pooled?: boolean; [key: string]: unknown }

export function createExplosionEffect(init?: Partial<ExplosionEffect>): ExplosionEffect { return { x: init?.x ?? 0, y: init?.y ?? 0, r: init?.r, alive: true, _pooled: false, ...init } }
export function resetExplosionEffect(obj: ExplosionEffect, init?: Partial<ExplosionEffect>) { obj.x = init?.x ?? 0; obj.y = init?.y ?? 0; obj.r = init?.r; obj.alive = true; obj._pooled = false; Object.assign(obj, init) }
export function createShieldHitEffect(init?: Partial<ShieldHitEffect>): ShieldHitEffect { return { x: init?.x ?? 0, y: init?.y ?? 0, magnitude: init?.magnitude, alive: true, _pooled: false, ...init } }
export function resetShieldHitEffect(obj: ShieldHitEffect, init?: Partial<ShieldHitEffect>) { obj.x = init?.x ?? 0; obj.y = init?.y ?? 0; obj.magnitude = init?.magnitude; obj.alive = true; obj._pooled = false; Object.assign(obj, init) }
export function createHealthHitEffect(init?: Partial<HealthHitEffect>): HealthHitEffect { return { x: init?.x ?? 0, y: init?.y ?? 0, amount: init?.amount, alive: true, _pooled: false, ...init } }
export function resetHealthHitEffect(obj: HealthHitEffect, init?: Partial<HealthHitEffect>) { obj.x = init?.x ?? 0; obj.y = init?.y ?? 0; obj.amount = init?.amount; obj.alive = true; obj._pooled = false; Object.assign(obj, init) }

export interface Pooled<T = Record<string, unknown>> { reset?: (initArgs?: Partial<T>) => void }
export type PooledFactory<T extends object> = { create: () => T; reset?: (obj: T, initArgs?: Partial<T>) => void }
export function createPooledFactory<T extends object>(createOrFactory: (() => T) | PooledFactory<T>, resetFn?: (obj: T, initArgs?: Partial<T>) => void): PooledFactory<T> { if (typeof createOrFactory === 'function') return { create: createOrFactory as () => T, reset: resetFn }; const f = createOrFactory as PooledFactory<T>; return { create: f.create, reset: f.reset } }
export function makePooled<T extends object>(obj: T, resetFn?: (obj: T, initArgs?: Partial<T>) => void): T & Pooled<T> { const o = obj as T & Pooled<T>; if (typeof o.reset !== 'function') { if (typeof resetFn === 'function') { o.reset = function (initArgs?: Partial<T>) { try { resetFn(o, initArgs) } catch {} } } else { o.reset = function (initArgs?: Partial<T>) { if (initArgs && typeof initArgs === 'object') Object.assign(o, initArgs) } } } return o }

export type PoolEntry<T> = { freeList: T[]; allocated: number; config?: { max?: number; strategy?: 'discard-oldest'|'grow'|'error' }; disposer?: (item: T) => void }
export type TexturePoolEntry = PoolEntry<WebGLTexture>

function _getStrategy(v: unknown, def: 'discard-oldest'|'grow'|'error') { return v === 'grow' || v === 'error' || v === 'discard-oldest' ? (v as 'discard-oldest'|'grow'|'error') : def }
function _incCount(map: Map<string, number>, key: string, delta: number) { const cur = map.get(key) || 0; const next = cur + delta; if (next <= 0) map.delete(key); else map.set(key, next) }

export function acquireTexture(state: GameState, key: string, createFn: () => WebGLTexture): WebGLTexture {
  const poolMap = state.assetPool.textures as Map<string, TexturePoolEntry>
  const counts = state.assetPool.counts?.textures || new Map<string, number>()
  if (!state.assetPool.counts) state.assetPool.counts = { textures: counts, sprites: new Map(), effects: new Map() }
  let entry = poolMap.get(key)
  if (!entry) { entry = { freeList: [], allocated: 0 }; poolMap.set(key, entry) }
  const free = entry.freeList
  if (free.length) return free.pop()!
  const max = (entry.config?.max ?? state.assetPool.config.texturePoolSize) || 128
  const strategy = entry.config?.strategy ?? _getStrategy(state.assetPool.config.textureOverflowStrategy, 'discard-oldest')
  const total = entry.allocated || counts.get(key) || 0
  if (total < max || strategy === 'grow') { const tex = createFn(); entry.allocated = (entry.allocated || 0) + 1; _incCount(counts, key, 1); return tex }
  if (strategy === 'error') throw new Error(`Texture pool exhausted for key "${key}" (max=${max})`)
  const tex = createFn(); entry.allocated = (entry.allocated || 0) + 1; _incCount(counts, key, 1); return tex
}

export function releaseTexture(state: GameState, key: string, tex: WebGLTexture, disposeFn?: (t: WebGLTexture) => void) {
  const poolMap = state.assetPool.textures as Map<string, TexturePoolEntry>
  const counts = state.assetPool.counts?.textures || new Map<string, number>()
  if (!state.assetPool.counts) state.assetPool.counts = { textures: counts, sprites: new Map(), effects: new Map() }
  let entry = poolMap.get(key)
  if (!entry) { entry = { freeList: [], allocated: 0 }; poolMap.set(key, entry); }
  const free = entry.freeList
  if (!free.includes(tex)) free.push(tex)
  const max = (entry.config?.max ?? state.assetPool.config.texturePoolSize) || 128
  const strategy = entry.config?.strategy ?? _getStrategy(state.assetPool.config.textureOverflowStrategy, 'discard-oldest')
  const countsMap = state.assetPool.counts?.textures || new Map<string, number>()
  if (strategy === 'grow') return
  while (free.length > max) {
    const victim = strategy === 'discard-oldest' ? free.shift()! : free.pop()!
    try { if (entry!.disposer) entry!.disposer(victim as any); else if (disposeFn) disposeFn(victim as any) } catch {}
    _incCount(countsMap, key, -1)
    entry.allocated = Math.max(0, (entry.allocated || 0) - 1)
  }
  if (strategy === 'error' && free.length > max) { const victim = free.pop()!; try { if (entry!.disposer) entry!.disposer(victim as any); else if (disposeFn) disposeFn(victim as any) } catch {} _incCount(countsMap, key, -1); entry.allocated = Math.max(0, (entry.allocated || 0) - 1) }
}

export function acquireSprite<T extends object>(state: GameState, key: string, createFn: () => T & Pooled<T>, initArgs?: Partial<T>): T & Pooled<T> {
  const poolMap = state.assetPool.sprites as Map<string, PoolEntry<T & Pooled<T>>>
  const counts = state.assetPool.counts?.sprites || new Map<string, number>()
  if (!state.assetPool.counts) state.assetPool.counts = { textures: new Map(), sprites: counts, effects: new Map() }
  let entry = poolMap.get(key)
  if (!entry) { entry = { freeList: [], allocated: 0 }; poolMap.set(key, entry); }
  const free = entry.freeList as Array<T & Pooled<T>>
  if (free.length) { const obj = free.pop()! as T & Pooled<T>; try { if (typeof obj.reset === 'function') obj.reset(initArgs); else if (initArgs && typeof initArgs === 'object') Object.assign(obj, initArgs) } catch {} return obj }
  const max = state.assetPool.config.spritePoolSize || 256
  const strategy = _getStrategy(state.assetPool.config.spriteOverflowStrategy, 'discard-oldest')
  const total = entry.allocated || counts.get(key) || 0
  if (total < max || strategy === 'grow') { const s = createFn() as T & Pooled<T>; try { if (typeof s.reset === 'function') s.reset(initArgs); else if (initArgs && typeof initArgs === 'object') Object.assign(s, initArgs) } catch {} entry.allocated = (entry.allocated || 0) + 1; _incCount(counts, key, 1); return s }
  if (strategy === 'error') throw new Error(`Sprite pool exhausted for key "${key}" (max=${max})`)
  const s = createFn() as T & Pooled<T>; entry.allocated = (entry.allocated || 0) + 1; _incCount(counts, key, 1); return s
}

export function releaseSprite<T extends object>(state: GameState, key: string, sprite: T & Pooled<T>, disposeFn?: (s: T) => void) {
  const poolMap = state.assetPool.sprites as Map<string, PoolEntry<T & Pooled<T>>>;
  const counts = state.assetPool.counts?.sprites || new Map<string, number>();
  if (!state.assetPool.counts) state.assetPool.counts = { textures: new Map(), sprites: counts, effects: new Map() };
  let entry = poolMap.get(key);
  if (!entry) { entry = { freeList: [], allocated: 0 }; poolMap.set(key, entry); }
  const free = entry.freeList as Array<T & Pooled<T>>;
  if (!free.includes(sprite)) free.push(sprite as T & Pooled<T>);
  const max = state.assetPool.config.spritePoolSize || 256;
  const strategy = _getStrategy(state.assetPool.config.spriteOverflowStrategy, 'discard-oldest');
  if (strategy === 'grow') return;
  while (free.length > max) {
    const victim = strategy === 'discard-oldest' ? free.shift()! : free.pop()!;
    try { if (disposeFn) disposeFn(victim as any); } catch {}
    _incCount(counts, key, -1);
  }
  if (strategy === 'error' && free.length > max) {
    const victim = free.pop()!;
    try { if (disposeFn) disposeFn(victim as any); } catch {}
    _incCount(counts, key, -1);
  }
}
// Provide a default initial GameState for simulation and tests
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
        textureOverflowStrategy: 'discard-oldest',
        spriteOverflowStrategy: 'discard-oldest',
        effectOverflowStrategy: 'discard-oldest',
      },
    },
  };
}
