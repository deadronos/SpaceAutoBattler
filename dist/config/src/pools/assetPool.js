import { acquireItem, releaseItem } from './PoolManager';
function _getStrategy(v, def) {
    return v === "grow" || v === "error" || v === "discard-oldest"
        ? v
        : def;
}
function _incCount(map, key, delta) {
    const cur = map.get(key) || 0;
    const next = cur + delta;
    if (next <= 0)
        map.delete(key);
    else
        map.set(key, next);
}
// Helper: prefer per-entry config.max if set, otherwise use the named global config
function entryConfigOr(state, key, globalName) {
    const poolMap = (globalName === 'texturePoolSize' ? state.assetPool.textures : globalName === 'spritePoolSize' ? state.assetPool.sprites : state.assetPool.effects);
    const entry = poolMap && poolMap.get ? poolMap.get(key) : undefined;
    if (entry && entry.config && typeof entry.config.max === 'number')
        return entry.config.max;
    return state.assetPool.config ? state.assetPool.config[globalName] : undefined;
}
function entryStrategyOr(state, key, globalName) {
    const poolMap = (globalName === 'textureOverflowStrategy' ? state.assetPool.textures : globalName === 'spriteOverflowStrategy' ? state.assetPool.sprites : state.assetPool.effects);
    const entry = poolMap && poolMap.get ? poolMap.get(key) : undefined;
    if (entry && entry.config && entry.config.strategy)
        return entry.config.strategy;
    return state.assetPool.config ? state.assetPool.config[globalName] : undefined;
}
export function makePooled(obj, resetFn) {
    const o = obj;
    if (typeof o.reset !== "function") {
        if (typeof resetFn === "function") {
            o.reset = function (initArgs) {
                try {
                    resetFn(o, initArgs);
                }
                catch { }
            };
        }
        else {
            o.reset = function (initArgs) {
                if (initArgs && typeof initArgs === "object")
                    Object.assign(o, initArgs);
            };
        }
    }
    return o;
}
export function createPooledFactory(createOrFactory, resetFn) {
    if (typeof createOrFactory === "function")
        return { create: createOrFactory, reset: resetFn };
    const f = createOrFactory;
    return { create: f.create, reset: f.reset };
}
// Ensure state.assetPool shape exists and has sensible defaults
export function ensureAssetPool(state) {
    if (!state)
        return;
    if (!state.assetPool || typeof state.assetPool !== "object") {
        state.assetPool = {
            textures: new Map(),
            sprites: new Map(),
            effects: new Map(),
            counts: {
                textures: new Map(),
                sprites: new Map(),
                effects: new Map(),
            },
            config: {
                texturePoolSize: 128,
                spritePoolSize: 256,
                effectPoolSize: 128,
                textureOverflowStrategy: "discard-oldest",
                spriteOverflowStrategy: "discard-oldest",
                effectOverflowStrategy: "discard-oldest",
            },
        };
    }
    else {
        state.assetPool.textures = state.assetPool.textures || new Map();
        state.assetPool.sprites = state.assetPool.sprites || new Map();
        state.assetPool.effects = state.assetPool.effects || new Map();
        state.assetPool.counts = state.assetPool.counts || {
            textures: new Map(),
            sprites: new Map(),
            effects: new Map(),
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
export function acquireEffect(state, key, createFn, initArgs) {
    ensureAssetPool(state);
    // Delegate to PoolManager.acquireItem to centralize overflow semantics
    const poolMap = state.assetPool.effects;
    state.assetPool.counts = state.assetPool.counts || { textures: new Map(), sprites: new Map(), effects: new Map() };
    const counts = state.assetPool.counts.effects;
    return acquireItem({
        map: poolMap,
        counts,
        key,
        createFn: createFn,
        globalMax: state.assetPool.config.effectPoolSize,
        globalStrategy: _getStrategy(state.assetPool.config.effectOverflowStrategy, 'discard-oldest'),
        initFn: (obj, args) => {
            try {
                if (typeof obj.reset === 'function')
                    obj.reset(args);
                else if (args && typeof args === 'object')
                    Object.assign(obj, args);
            }
            catch { }
        },
        initArgs,
    });
}
export function releaseEffect(state, key, effect, disposeFn) {
    ensureAssetPool(state);
    const poolMap = state.assetPool.effects;
    state.assetPool.counts = state.assetPool.counts || { textures: new Map(), sprites: new Map(), effects: new Map() };
    const counts = state.assetPool.counts.effects;
    return releaseItem({
        map: poolMap,
        counts,
        key,
        item: effect,
        disposeFn: disposeFn,
        globalMax: state.assetPool.config.effectPoolSize,
        globalStrategy: _getStrategy(state.assetPool.config.effectOverflowStrategy, 'discard-oldest'),
    });
}
export function acquireTexture(state, key, createFn) {
    ensureAssetPool(state);
    const poolMap = state.assetPool.textures;
    state.assetPool.counts = state.assetPool.counts || { textures: new Map(), sprites: new Map(), effects: new Map() };
    const counts = state.assetPool.counts.textures;
    return acquireItem({
        map: poolMap,
        counts,
        key,
        createFn: createFn,
        globalMax: entryConfigOr(state, key, 'texturePoolSize'),
        globalStrategy: entryStrategyOr(state, key, 'textureOverflowStrategy'),
    });
}
export function releaseTexture(state, key, tex, disposeFn) {
    ensureAssetPool(state);
    const poolMap = state.assetPool.textures;
    state.assetPool.counts = state.assetPool.counts || { textures: new Map(), sprites: new Map(), effects: new Map() };
    const counts = state.assetPool.counts.textures;
    return releaseItem({
        map: poolMap,
        counts,
        key,
        item: tex,
        disposeFn: disposeFn,
        globalMax: entryConfigOr(state, key, 'texturePoolSize'),
        globalStrategy: entryStrategyOr(state, key, 'textureOverflowStrategy'),
    });
}
export function acquireSprite(state, key, createFn, initArgs) {
    ensureAssetPool(state);
    state.assetPool.counts = state.assetPool.counts || { textures: new Map(), sprites: new Map(), effects: new Map() };
    const poolMap = state.assetPool.sprites;
    const counts = state.assetPool.counts.sprites;
    return acquireItem({
        map: poolMap,
        counts,
        key,
        createFn: createFn,
        globalMax: state.assetPool.config.spritePoolSize,
        globalStrategy: _getStrategy(state.assetPool.config.spriteOverflowStrategy, 'discard-oldest'),
        initFn: (obj, args) => {
            try {
                if (typeof obj.reset === 'function')
                    obj.reset(args);
                else if (args && typeof args === 'object')
                    Object.assign(obj, args);
            }
            catch { }
        },
        initArgs,
    });
}
export function releaseSprite(state, key, sprite, disposeFn) {
    ensureAssetPool(state);
    state.assetPool.counts = state.assetPool.counts || { textures: new Map(), sprites: new Map(), effects: new Map() };
    const poolMap = state.assetPool.sprites;
    const counts = state.assetPool.counts.sprites;
    return releaseItem({
        map: poolMap,
        counts,
        key,
        item: sprite,
        disposeFn: disposeFn,
        globalMax: state.assetPool.config.spritePoolSize,
        globalStrategy: _getStrategy(state.assetPool.config.spriteOverflowStrategy, 'discard-oldest'),
    });
}
export default {};
