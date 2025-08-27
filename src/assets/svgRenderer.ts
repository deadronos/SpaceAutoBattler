import { applyTeamColorsToSvg, rasterizeSvgToCanvasAsync } from './svgLoader';

// Simple stable stringify for objects (sort keys) to generate deterministic mapping key
function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

// Simple djb2 hash to produce a compact hex string from input
function djb2Hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) + h) + str.charCodeAt(i); h = h & 0xffffffff; }
  // convert to unsigned and hex
  return (h >>> 0).toString(16);
}

// Cache of in-flight and completed rasterizations. Keyed by computed cacheKey.
// Each entry stores metadata so we can expose a synchronous getter and TTL info.
type CacheEntry = {
  promise: Promise<HTMLCanvasElement> | null;
  canvas?: HTMLCanvasElement;
  createdAt: number;
  lastAccess: number;
};
const rasterCache: Map<string, CacheEntry> = new Map();
let rasterCacheMaxEntries = 256;
let rasterCacheMaxAgeMS = 0; // 0 means disabled

function ensureCacheLimit() {
  try {
    const now = Date.now();
    // Evict by TTL first
    if (rasterCacheMaxAgeMS > 0) {
      for (const [k, v] of Array.from(rasterCache.entries())) {
        if (now - v.lastAccess > rasterCacheMaxAgeMS || now - v.createdAt > rasterCacheMaxAgeMS) {
          rasterCache.delete(k);
        }
      }
    }
    // Then evict oldest entries until under limit
    while (rasterCache.size > rasterCacheMaxEntries) {
      const it = rasterCache.keys().next();
      if (it.done) break;
      rasterCache.delete(it.value);
    }
  } catch (e) {}
}

/**
 * Rasterize an SVG with team colors applied.
 * svgText: original svg source
 * mapping: { role: color }
 * outW,outH: output canvas size
 * options: { applyTo?: 'fill'|'stroke'|'both', assetKey?: string }
 * If options.assetKey is provided, it is used as the stable asset identifier in the cache key.
 */
export async function rasterizeSvgWithTeamColors(svgText: string, mapping: Record<string, string>, outW: number, outH: number, options?: { applyTo?: 'fill' | 'stroke' | 'both', assetKey?: string }): Promise<HTMLCanvasElement> {
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
      const ctx = (probe.getContext && probe.getContext('2d')) as CanvasRenderingContext2D | null;
      if (!ctx) headlessNoCtx = true;
    }
  } catch (e) { headlessNoCtx = true; }
  // compute mapping hash and asset identifier
  const mappingStable = stableStringify(mapping || {});
  const mappingHash = djb2Hash(mappingStable);
  const assetId = options && options.assetKey ? options.assetKey : djb2Hash(stableStringify(svgText || ''));
  const cacheKey = `${assetId}:${mappingHash}:${outW}x${outH}`;

  if (rasterCache.has(cacheKey)) {
    const entry = rasterCache.get(cacheKey)!;
    // update lastAccess and promote to MRU
    try {
      entry.lastAccess = Date.now();
      rasterCache.delete(cacheKey);
      rasterCache.set(cacheKey, entry);
    } catch (e) {}
    // If a resolved canvas is present, return it quickly
    if (entry.canvas) return Promise.resolve(entry.canvas);
    // otherwise return the in-flight promise
    if (entry.promise) return entry.promise;
  }

  const entry: CacheEntry = {
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
            const resp = await fetch(sourceSvg);
            if (resp && resp.ok) {
              const txt = await resp.text();
              if (txt && /<svg[\s>]/i.test(txt)) sourceSvg = txt;
            } else {
              try {
                const isProd = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production');
                const isTest = (typeof process !== 'undefined' && process.env && (process.env.VITEST || process.env.VITEST_WORKER_ID)) || (typeof (globalThis as any).vitest !== 'undefined');
                if (!isProd && !isTest) {
                  // eslint-disable-next-line no-console
                  console.warn(`[svgRenderer] fetch failed for SVG url '${sourceSvg}'. Status: ${resp && (resp as any).status}`);
                }
              } catch (e) {}
            }
          } catch (e) {
            try {
              const isProd = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production');
              const isTest = (typeof process !== 'undefined' && process.env && (process.env.VITEST || process.env.VITEST_WORKER_ID)) || (typeof (globalThis as any).vitest !== 'undefined');
              if (!isProd && !isTest) {
                // eslint-disable-next-line no-console
                console.warn(`[svgRenderer] fetch threw for '${sourceSvg}', continuing with original string`, e);
              }
            } catch (ee) {}
            // ignore fetch errors and continue with original string
          }
        }
      } catch (e) {}

      const recolored = applyTeamColorsToSvg(sourceSvg, mapping, options && { applyTo: options?.applyTo });
      if (headlessNoCtx) {
        // create a placeholder canvas and cache it so subsequent calls return same instance
        const ph = ((): HTMLCanvasElement => {
          try {
            const c = document.createElement('canvas');
            c.width = outW || 1; c.height = outH || 1; return c;
          } catch (e) {
            // as a last resort, create a minimal object that looks like a canvas
            const obj: any = { width: outW || 1, height: outH || 1 }; return obj as unknown as HTMLCanvasElement;
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
    } catch (e) {
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
  } catch (e) {
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
export function cacheCanvasForAsset(assetKey: string, mapping: Record<string, string>, outW: number, outH: number, canvas: HTMLCanvasElement) {
  const mappingStable = stableStringify(mapping || {});
  const mappingHash = djb2Hash(mappingStable);
  const assetId = assetKey || djb2Hash(stableStringify(''));
  const cacheKey = `${assetId}:${mappingHash}:${outW}x${outH}`;
  // Insert and promote to MRU, storing metadata for sync reads
  try {
    if (rasterCache.has(cacheKey)) rasterCache.delete(cacheKey);
  } catch (e) {}
  const entry: CacheEntry = {
    promise: Promise.resolve(canvas),
    canvas,
    createdAt: Date.now(),
    lastAccess: Date.now(),
  };
  rasterCache.set(cacheKey, entry);
  ensureCacheLimit();
}

// Test helper: return current cache keys in insertion order (oldest -> newest)
export function _getRasterCacheKeysForTest(): string[] {
  return Array.from(rasterCache.keys());
}

export function setRasterCacheMaxEntries(n: number) {
  // Allow small sizes for tests; enforce at least 1 entry
  rasterCacheMaxEntries = Math.max(1, Math.floor(n) || 256);
  ensureCacheLimit();
}

/**
 * Set maximum age for cache entries in milliseconds. 0 disables TTL.
 */
export function setRasterCacheMaxAge(ms: number) {
  rasterCacheMaxAgeMS = Math.max(0, Math.floor(ms) || 0);
  ensureCacheLimit();
}

/**
 * Synchronous getter: return an already-resolved canvas for the given key if present.
 * This allows renderers to prefer cached canvases without awaiting a Promise.
 */
export function getCanvasFromCache(assetKey: string, mapping: Record<string, string>, outW: number, outH: number): HTMLCanvasElement | undefined {
  const mappingStable = stableStringify(mapping || {});
  const mappingHash = djb2Hash(mappingStable);
  const assetId = assetKey || djb2Hash(stableStringify(''));
  const cacheKey = `${assetId}:${mappingHash}:${outW}x${outH}`;
  const entry = rasterCache.get(cacheKey);
  if (!entry) return undefined;
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
  } catch (e) {}
  return entry.canvas;
}

// Named convenience export for clearer imports
export function getCanvas(assetKey: string, mapping: Record<string, string>, outW: number, outH: number) {
  return getCanvasFromCache(assetKey, mapping, outW, outH);
}

export default {
  rasterizeSvgWithTeamColors,
  _clearRasterCache,
  cacheCanvasForAsset,
  setRasterCacheMaxEntries,
  setRasterCacheMaxAge,
  getCanvasFromCache,
  // synchronous alias for convenience: prefer calling svgRenderer.getCanvas(...)
  getCanvas(assetKey: string, mapping: Record<string, string>, outW: number, outH: number) {
    return getCanvasFromCache(assetKey, mapping, outW, outH);
  },
};
