import { applyTeamColorsToSvg, rasterizeSvgToCanvasAsync, stripHullOnly } from './svgLoader';
// Simple stable stringify for objects (sort keys) to generate deterministic mapping key
function stableStringify(obj) {
    if (obj === null || typeof obj !== 'object')
        return JSON.stringify(obj);
    if (Array.isArray(obj))
        return '[' + obj.map(stableStringify).join(',') + ']';
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}
// Simple djb2 hash to produce a compact hex string from input
function djb2Hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h) + str.charCodeAt(i);
        h = h & 0xffffffff;
    }
    // convert to unsigned and hex
    return (h >>> 0).toString(16);
}
// Map key -> CacheEntry. Map preserves insertion order so we can evict LRU
const rasterCache = new Map();
// Configurable limits (tests may tweak these)
let rasterCacheMaxEntries = 256;
let rasterCacheMaxAgeMS = 0; // 0 disables TTL
function ensureCacheLimit() {
    try {
        if (rasterCacheMaxAgeMS > 0) {
            const now = Date.now();
            for (const [k, e] of Array.from(rasterCache.entries())) {
                try {
                    if (now - e.lastAccess > rasterCacheMaxAgeMS || now - e.createdAt > rasterCacheMaxAgeMS) {
                        rasterCache.delete(k);
                    }
                }
                catch (ee) { }
            }
        }
        while (rasterCache.size > rasterCacheMaxEntries) {
            const it = rasterCache.keys();
            const oldest = it.next().value;
            if (!oldest)
                break;
            rasterCache.delete(oldest);
        }
    }
    catch (e) {
        // swallow; cache is best-effort
    }
}
/**
 * Rasterize an SVG with team colors applied.
 * svgText: original svg source
 * mapping: { role: color }
 * outW,outH: output canvas size
 * options: { applyTo?: 'fill'|'stroke'|'both', assetKey?: string }
 * If options.assetKey is provided, it is used as the stable asset identifier in the cache key.
 */
export async function rasterizeSvgWithTeamColors(svgText, mapping, outW, outH, options) {
    // Fast-path for headless/test environments: if a 2D canvas context is
    // not available, return a blank canvas immediately. This avoids waiting
    // on image onload handlers that may never fire in environments like
    // happy-dom or partial DOM shims used in tests.
    // Detect headless/partial DOM where 2D context is unavailable. Don't return early;
    // instead handle via cacheKey below so repeated calls with same key return the same placeholder.
    let headlessNoCtx = false;
    try {
        if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
            const probe = document.createElement('canvas');
            const ctx = (probe.getContext && probe.getContext('2d'));
            if (!ctx)
                headlessNoCtx = true;
        }
    }
    catch (e) {
        headlessNoCtx = true;
    }
    // compute mapping hash and asset identifier
    const mappingStable = stableStringify(mapping || {});
    const mappingHash = djb2Hash(mappingStable);
    const assetId = options && options.assetKey ? options.assetKey : djb2Hash(stableStringify(svgText || ''));
    const cacheKey = `${assetId}:${mappingHash}:${outW}x${outH}`;
    if (rasterCache.has(cacheKey)) {
        const entry = rasterCache.get(cacheKey);
        // update lastAccess and promote to MRU
        try {
            entry.lastAccess = Date.now();
            rasterCache.delete(cacheKey);
            rasterCache.set(cacheKey, entry);
        }
        catch (e) { }
        // If a resolved canvas is present, return it quickly
        if (entry.canvas)
            return Promise.resolve(entry.canvas);
        // otherwise return the in-flight promise
        if (entry.promise)
            return entry.promise;
    }
    const entry = {
        promise: null,
        canvas: undefined,
        createdAt: Date.now(),
        lastAccess: Date.now(),
    };
    const p = (async () => {
        try {
            // If caller passed a path/URL instead of inline SVG markup, try to fetch it
            let sourceSvg = svgText || '';
            try {
                if (!/<svg[\s>]/i.test(sourceSvg) && typeof fetch === 'function') {
                    try {
                        try {
                            if (typeof sourceSvg === 'string' && !sourceSvg.includes('/') && !sourceSvg.includes('.') && typeof console !== 'undefined' && console.warn) {
                                console.warn('[svgRenderer] fetch called with bare source string:', sourceSvg);
                            }
                        }
                        catch (e) { }
                        const resp = await fetch(sourceSvg);
                        if (resp && resp.ok) {
                            const txt = await resp.text();
                            if (txt && /<svg[\s>]/i.test(txt))
                                sourceSvg = txt;
                        }
                        else {
                            try {
                                const isProd = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production');
                                const isTest = (typeof process !== 'undefined' && process.env && (process.env.VITEST || process.env.VITEST_WORKER_ID)) || (typeof globalThis.vitest !== 'undefined');
                                if (!isProd && !isTest) {
                                    // eslint-disable-next-line no-console
                                    console.warn(`[svgRenderer] fetch failed for SVG url '${sourceSvg}'. Status: ${resp && resp.status}`);
                                }
                            }
                            catch (e) { }
                        }
                    }
                    catch (e) {
                        try {
                            const isProd = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production');
                            const isTest = (typeof process !== 'undefined' && process.env && (process.env.VITEST || process.env.VITEST_WORKER_ID)) || (typeof globalThis.vitest !== 'undefined');
                            if (!isProd && !isTest) {
                                // eslint-disable-next-line no-console
                                console.warn(`[svgRenderer] fetch threw for '${sourceSvg}', continuing with original string`, e);
                            }
                        }
                        catch (ee) { }
                        // ignore fetch errors and continue with original string
                    }
                }
            }
            catch (e) { }
            const recolored = applyTeamColorsToSvg(sourceSvg, mapping, options && { applyTo: options?.applyTo });
            if (headlessNoCtx) {
                // create a placeholder canvas and cache it so subsequent calls return same instance
                const ph = (() => {
                    try {
                        const c = document.createElement('canvas');
                        c.width = outW || 1;
                        c.height = outH || 1;
                        return c;
                    }
                    catch (e) {
                        // as a last resort, create a minimal object that looks like a canvas
                        const obj = { width: outW || 1, height: outH || 1 };
                        return obj;
                    }
                })();
                entry.canvas = ph;
                entry.promise = Promise.resolve(ph);
                entry.lastAccess = Date.now();
                rasterCache.set(cacheKey, entry);
                ensureCacheLimit();
                return ph;
            }
            const canvas = await rasterizeSvgToCanvasAsync(recolored, outW, outH);
            // store resolved canvas for synchronous reads
            entry.canvas = canvas;
            entry.promise = Promise.resolve(canvas);
            entry.lastAccess = Date.now();
            return canvas;
        }
        catch (e) {
            const canvas = await rasterizeSvgToCanvasAsync(svgText, outW, outH);
            entry.canvas = canvas;
            entry.promise = Promise.resolve(canvas);
            entry.lastAccess = Date.now();
            return canvas;
        }
    })();
    entry.promise = p;
    rasterCache.set(cacheKey, entry);
    ensureCacheLimit();
    try {
        const res = await p;
        return res;
    }
    catch (e) {
        // on error, remove from cache so future attempts can retry
        rasterCache.delete(cacheKey);
        throw e;
    }
}
export function _clearRasterCache() {
    rasterCache.clear();
}
/**
 * Store an already-rendered canvas into the raster cache for the given asset/mapping/size.
 * Useful for synchronous renderer code that produces canvases and wants them cached for later reuse.
 */
export function cacheCanvasForAsset(assetKey, mapping, outW, outH, canvas) {
    const mappingStable = stableStringify(mapping || {});
    const mappingHash = djb2Hash(mappingStable);
    const assetId = assetKey || djb2Hash(stableStringify(''));
    const cacheKey = `${assetId}:${mappingHash}:${outW}x${outH}`;
    // Insert and promote to MRU, storing metadata for sync reads
    try {
        if (rasterCache.has(cacheKey))
            rasterCache.delete(cacheKey);
    }
    catch (e) { }
    const entry = {
        promise: Promise.resolve(canvas),
        canvas,
        createdAt: Date.now(),
        lastAccess: Date.now(),
    };
    rasterCache.set(cacheKey, entry);
    ensureCacheLimit();
    try {
        if (typeof globalThis.window !== 'undefined' && globalThis.window.__SAB_DEBUG_SVG) {
            // eslint-disable-next-line no-console
            console.debug('[svgRenderer] cacheCanvasForAsset set', { assetKey, mappingHash, outW, outH });
        }
    }
    catch (e) { }
}
// Test helper: return current cache keys in insertion order (oldest -> newest)
export function _getRasterCacheKeysForTest() {
    return Array.from(rasterCache.keys());
}
export function setRasterCacheMaxEntries(n) {
    // Allow small sizes for tests; enforce at least 1 entry
    rasterCacheMaxEntries = Math.max(1, Math.floor(n) || 256);
    ensureCacheLimit();
}
/**
 * Set maximum age for cache entries in milliseconds. 0 disables TTL.
 */
export function setRasterCacheMaxAge(ms) {
    rasterCacheMaxAgeMS = Math.max(0, Math.floor(ms) || 0);
    ensureCacheLimit();
}
/**
 * Synchronous getter: return an already-resolved canvas for the given key if present.
 * This allows renderers to prefer cached canvases without awaiting a Promise.
 */
export function getCanvasFromCache(assetKey, mapping, outW, outH) {
    const mappingStable = stableStringify(mapping || {});
    const mappingHash = djb2Hash(mappingStable);
    const assetId = assetKey || djb2Hash(stableStringify(''));
    const cacheKey = `${assetId}:${mappingHash}:${outW}x${outH}`;
    const entry = rasterCache.get(cacheKey);
    try {
        if (typeof globalThis.window !== 'undefined' && globalThis.window.__SAB_DEBUG_SVG) {
            // eslint-disable-next-line no-console
            console.debug('[svgRenderer] getCanvasFromCache lookup', { assetKey, mappingHash, outW, outH, present: !!entry });
        }
    }
    catch (e) { }
    if (!entry)
        return undefined;
    // Evict if expired
    if (rasterCacheMaxAgeMS > 0) {
        const now = Date.now();
        if (now - entry.lastAccess > rasterCacheMaxAgeMS || now - entry.createdAt > rasterCacheMaxAgeMS) {
            rasterCache.delete(cacheKey);
            return undefined;
        }
    }
    entry.lastAccess = Date.now();
    // Promote to MRU
    try {
        rasterCache.delete(cacheKey);
        rasterCache.set(cacheKey, entry);
    }
    catch (e) { }
    return entry.canvas;
}
// Named convenience export for clearer imports
export function getCanvas(assetKey, mapping, outW, outH) {
    return getCanvasFromCache(assetKey, mapping, outW, outH);
}
// (previous default export removed to avoid duplicate exports)
// Create a stable API object so bundlers can't easily tree-shake the bridge.
// Export it as default and also attach it to globalThis under a known name
// so different module instances can share the same raster cache at runtime.
const svgRendererAPI = {
    rasterizeSvgWithTeamColors,
    _clearRasterCache,
    cacheCanvasForAsset,
    setRasterCacheMaxEntries,
    setRasterCacheMaxAge,
    getCanvasFromCache,
    getCanvas(assetKey, mapping, outW, outH) {
        return getCanvasFromCache(assetKey, mapping, outW, outH);
    },
    /**
     * Test helper: wait for an asset (assetKey + mapping + size) to be rasterized
     * and present in the cache as a non-placeholder canvas. Resolves to the
     * canvas or undefined on timeout.
     */
    async _waitForAssetReady(assetKey, mapping, outW, outH, timeoutMs = 5000) {
        const start = Date.now();
        const interval = 50;
        while (Date.now() - start < timeoutMs) {
            try {
                const c = getCanvasFromCache(assetKey, mapping, outW, outH);
                if (c && !c._placeholder)
                    return c;
            }
            catch (e) { }
            await new Promise((res) => setTimeout(res, interval));
        }
        return undefined;
    },
    /**
     * Pre-warm a small set of assets into the raster cache. assetKeys are keys
     * from AssetsConfig.svgAssets (or direct SVG/URL strings). teamColors is an
     * array of color hex strings to generate tinted variants for. This helper
     * kicks off async rasterization and awaits completion so subsequent
     * synchronous getCanvas calls can find entries.
     */
    async prewarmAssets(assetKeys, teamColors = [], outW = 128, outH = 128, insertPlaceholders = false) {
        try {
            // Attempt to resolve AssetsConfig from globalThis if available; if not, try a dynamic import as a fallback
            let assetsConfig = (typeof globalThis !== 'undefined' && globalThis.AssetsConfig) ? globalThis.AssetsConfig : undefined;
            if (!assetsConfig) {
                try {
                    // dynamic import to avoid circular static imports at module eval time
                    const mod = await import('../config/assets/assetsConfig');
                    assetsConfig = mod && mod.default ? mod.default : mod;
                }
                catch (e) {
                    assetsConfig = undefined;
                }
            }
            const promises = [];
            for (const key of assetKeys) {
                try {
                    // Resolve declared rel or fall back to the provided key
                    let rel = undefined;
                    try {
                        rel = assetsConfig && assetsConfig.svgAssets && assetsConfig.svgAssets[key] ? assetsConfig.svgAssets[key] : undefined;
                    }
                    catch (e) {
                        rel = undefined;
                    }
                    if (!rel)
                        rel = key;
                    // Normalize bare keys (e.g. 'destroyer') to a relative svg path when possible
                    try {
                        if (typeof rel === 'string' && !rel.startsWith('<svg') && !rel.includes('/') && !rel.includes('.')) {
                            rel = `./svg/${rel}.svg`;
                        }
                    }
                    catch (e) { }
                    // Optionally insert a placeholder canvas synchronously so getCanvasFromCache
                    // can return a usable element immediately. Tests can disable placeholder
                    // insertion by calling prewarmAssets(..., insertPlaceholders=false).
                    try {
                        if (insertPlaceholders) {
                            const ph = (() => {
                                try {
                                    const c = document.createElement('canvas');
                                    c.width = outW || 1;
                                    c.height = outH || 1;
                                    try {
                                        c._placeholder = true;
                                    }
                                    catch (e) { }
                                    return c;
                                }
                                catch (e) {
                                    const obj = { width: outW || 1, height: outH || 1 };
                                    try {
                                        obj._placeholder = true;
                                    }
                                    catch (ee) { }
                                    return obj;
                                }
                            })();
                            try {
                                cacheCanvasForAsset(key, {}, outW, outH, ph);
                            }
                            catch (e) { }
                        }
                    }
                    catch (e) { }
                    // Kick off async rasterization to populate/replace the cache and collect promises
                    const p = (async () => {
                        try {
                            // If rel is an inline SVG string, strip turret/artwork first so
                            // the cached hull canvas contains only the hull elements.
                            let sourceForRaster = undefined;
                            try {
                                if (typeof rel === 'string' && rel.trim().startsWith('<svg')) {
                                    sourceForRaster = stripHullOnly(rel);
                                }
                                else if (typeof fetch === 'function' && typeof rel === 'string') {
                                    try {
                                        const resp = await fetch(rel);
                                        if (resp && resp.ok) {
                                            const txt = await resp.text();
                                            if (txt && /<svg[\s>]/i.test(txt)) {
                                                sourceForRaster = stripHullOnly(txt);
                                            }
                                        }
                                    }
                                    catch (e) {
                                        // ignore fetch errors and fall back to passing original rel
                                    }
                                }
                            }
                            catch (e) { }
                            const toRaster = sourceForRaster || rel;
                            const canvas = await rasterizeSvgWithTeamColors(toRaster, {}, outW, outH, { applyTo: 'both', assetKey: key });
                            try {
                                cacheCanvasForAsset(key, {}, outW, outH, canvas);
                            }
                            catch (e) { }
                        }
                        catch (e) { }
                    })();
                    promises.push(p);
                    // Rasterize tinted variants for provided team colors (placeholder then async)
                    for (const col of teamColors || []) {
                        try {
                            const mapping = { primary: col, hull: col };
                            try {
                                if (insertPlaceholders) {
                                    const ph2 = (() => {
                                        try {
                                            const c = document.createElement('canvas');
                                            c.width = outW || 1;
                                            c.height = outH || 1;
                                            try {
                                                c._placeholder = true;
                                            }
                                            catch (e) { }
                                            return c;
                                        }
                                        catch (e) {
                                            const obj = { width: outW || 1, height: outH || 1 };
                                            try {
                                                obj._placeholder = true;
                                            }
                                            catch (ee) { }
                                            return obj;
                                        }
                                    })();
                                    try {
                                        cacheCanvasForAsset(key, mapping, outW, outH, ph2);
                                    }
                                    catch (e) { }
                                }
                            }
                            catch (e) { }
                            const pt = (async () => {
                                try {
                                    // For tinted variants, prefer stripping hull first when possible
                                    let sourceForTint = undefined;
                                    try {
                                        if (typeof rel === 'string' && rel.trim().startsWith('<svg')) {
                                            sourceForTint = stripHullOnly(rel);
                                        }
                                        else if (typeof fetch === 'function' && typeof rel === 'string') {
                                            try {
                                                try {
                                                    if (typeof rel === 'string' && !rel.includes('/') && !rel.includes('.') && typeof console !== 'undefined' && console.warn) {
                                                        console.warn('[svgRenderer] prewarm tinted fetch using bare rel:', rel);
                                                    }
                                                }
                                                catch (e) { }
                                                const resp = await fetch(rel);
                                                if (resp && resp.ok) {
                                                    const txt = await resp.text();
                                                    if (txt && /<svg[\s>]/i.test(txt)) {
                                                        sourceForTint = stripHullOnly(txt);
                                                    }
                                                }
                                            }
                                            catch (e) { }
                                        }
                                    }
                                    catch (e) { }
                                    const toRasterTint = sourceForTint || rel;
                                    const canvas = await rasterizeSvgWithTeamColors(toRasterTint, mapping, outW, outH, { applyTo: 'both', assetKey: key });
                                    try {
                                        cacheCanvasForAsset(key, mapping, outW, outH, canvas);
                                    }
                                    catch (e) { }
                                }
                                catch (e) { }
                            })();
                            promises.push(pt);
                        }
                        catch (e) { }
                    }
                }
                catch (e) { }
            }
            // Await all rasterization tasks to allow callers to deterministically wait for cache population
            try {
                await Promise.all(promises);
            }
            catch (e) { }
        }
        catch (e) { }
    }
};
// Attach to globalThis explicitly. Keep this small and obvious so it survives
// bundling and executes at module eval time in the browser runtime.
try {
    if (typeof globalThis !== 'undefined') {
        globalThis.__SpaceAutoBattler_svgRenderer = globalThis.__SpaceAutoBattler_svgRenderer || {};
        Object.assign(globalThis.__SpaceAutoBattler_svgRenderer, svgRendererAPI);
    }
}
catch (e) {
    // ignore failures (older environments)
}
export default svgRendererAPI;
