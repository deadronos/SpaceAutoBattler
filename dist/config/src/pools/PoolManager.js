// Lightweight PoolManager helpers. These are intentionally small and
// runtime-friendly so they can be used in both renderer and simulation code.
export const DEFAULT_CONFIG = {
    max: undefined,
    strategy: 'discard-oldest',
    min: 0,
};
function _incCount(map, key, delta) {
    if (!map)
        return;
    const cur = map.get(key) || 0;
    const next = cur + delta;
    if (next <= 0)
        map.delete(key);
    else
        map.set(key, next);
}
export function makePoolEntry(opts) {
    return {
        freeList: [],
        allocated: 0,
        config: Object.assign({}, DEFAULT_CONFIG, opts?.config || {}),
        disposer: opts?.disposer,
    };
}
export function ensureEntryForKey(map, key, opts) {
    let e = map.get(key);
    if (!e) {
        e = makePoolEntry(opts);
        map.set(key, e);
    }
    return e;
}
// Simple helper to release all freeList items via disposer (if present)
// and clear freeList. Returns number of disposed items.
export async function clearEntryFreeList(entry) {
    const list = entry.freeList.splice(0);
    let disposed = 0;
    if (entry.disposer) {
        for (const it of list) {
            await entry.disposer(it);
            disposed++;
        }
    }
    return disposed;
}
// Generic acquire/release helpers implementing overflow semantics.
export function acquireItem(params) {
    const { map, counts, key, createFn, globalMax, globalStrategy, initFn, initArgs } = params;
    let entry = map.get(key);
    if (!entry) {
        entry = makePoolEntry({ config: { max: globalMax, strategy: globalStrategy } });
        map.set(key, entry);
    }
    const free = entry.freeList;
    if (free.length) {
        const obj = free.pop();
        try {
            if (initFn)
                initFn(obj, initArgs);
            else if (initArgs && typeof obj === 'object')
                Object.assign(obj, initArgs);
        }
        catch { }
        return obj;
    }
    const max = (entry.config && typeof entry.config.max === 'number') ? entry.config.max : (globalMax ?? Infinity);
    const strategy = entry.config?.strategy ?? globalStrategy ?? 'discard-oldest';
    const total = entry.allocated || (counts ? counts.get(key) || 0 : 0);
    if (total < (max || Infinity) || strategy === 'grow') {
        const e = createFn();
        try {
            if (initFn)
                initFn(e, initArgs);
            else if (initArgs && typeof e === 'object')
                Object.assign(e, initArgs);
        }
        catch { }
        entry.allocated = (entry.allocated || 0) + 1;
        if (counts)
            _incCount(counts, key, 1);
        return e;
    }
    if (strategy === 'error')
        throw new Error(`Pool exhausted for key "${key}" (max=${max})`);
    const e = createFn();
    entry.allocated = (entry.allocated || 0) + 1;
    if (counts)
        _incCount(counts, key, 1);
    return e;
}
export function releaseItem(params) {
    const { map, counts, key, item, disposeFn, globalMax, globalStrategy } = params;
    let entry = map.get(key);
    if (!entry) {
        entry = makePoolEntry({ config: { max: globalMax, strategy: globalStrategy } });
        map.set(key, entry);
    }
    const free = entry.freeList;
    if (!free.includes(item))
        free.push(item);
    const max = (entry.config && typeof entry.config.max === 'number') ? entry.config.max : (globalMax ?? Infinity);
    const strategy = entry.config?.strategy ?? globalStrategy ?? 'discard-oldest';
    if (strategy === 'grow')
        return;
    const countsMap = counts || undefined;
    while (free.length > (max || Infinity)) {
        const victim = strategy === 'discard-oldest' ? free.shift() : free.pop();
        try {
            if (entry.disposer)
                entry.disposer(victim);
            else if (disposeFn)
                disposeFn(victim);
        }
        catch { }
        if (countsMap)
            _incCount(countsMap, key, -1);
        entry.allocated = Math.max(0, (entry.allocated || 0) - 1);
    }
    if (strategy === 'error' && free.length > (max || Infinity)) {
        const victim = free.pop();
        try {
            if (entry.disposer)
                entry.disposer(victim);
            else if (disposeFn)
                disposeFn(victim);
        }
        catch { }
        if (countsMap)
            _incCount(countsMap, key, -1);
        entry.allocated = Math.max(0, (entry.allocated || 0) - 1);
    }
}
export default {
    DEFAULT_CONFIG,
    makePoolEntry,
    ensureEntryForKey,
    clearEntryFreeList,
};
