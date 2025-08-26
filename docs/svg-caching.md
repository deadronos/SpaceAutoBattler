---
title: SVG caching and assetId guidelines
---

This document explains how the project's SVG -> polylines pipeline caches parsed/flattened contours, how to control cache keying with `assetId`, and best practices for preparing SVG assets for stable runtime caching.

Why caching exists
------------------

Parsing SVGs, resolving transforms, and flattening Bézier curves/arcs into polylines is CPU- and memory-intensive. The project keeps an in-memory cache to avoid repeated work at runtime for frequently-used assets (for example: ships, turrets, and projectiles).

How the cache is keyed
----------------------

- If you pass an `assetId` option to `svgToPolylines(svgString, { assetId })`, the cache key will be the string `${assetId}::${tolerance}`. Use this when your build pipeline or loader can provide a stable identifier for the asset (for example, the asset filename, URL, or a content hash generated at build time).
- If `assetId` is not provided, the implementation falls back to hashing the SVG content together with the tolerance value. This avoids accidental collisions when multiple different SVG contents are parsed with the same tolerance but is more expensive at runtime (the fallback hash must be computed on every call).

TTL and eviction
-----------------

- Cache entries have a time-to-live (TTL) of 1 hour by default (see `CACHE_MAX_AGE_MS` in `src/assets/svgToPolylines.ts`). After TTL expiration a lookup behaves like a cache miss and the content will be re-parsed and re-cached.
- The cache has a maximum capacity of 200 entries by default (see `CACHE_MAX_ENTRIES`). When the limit is exceeded, the implementation evicts the oldest entries first (FIFO). This simple strategy works well for this project's typical asset set; if you need stronger locality guarantees, consider switching to an LRU policy.

API helpers
-----------

The module exports a few helper functions useful for diagnostics and tests:

- `getSvgPolylinesCacheStats()` — Returns an object `{ hits, misses, entries }` with current counters and cache size.
- `resetSvgPolylinesCacheStats()` — Resets the internal hits/misses counters to zero (useful in tests).
- `clearSvgPolylinesCache()` — Clears the cache entirely.

Best practices and recommendations
---------------------------------

- Prefer providing an `assetId` from your loader (for example, the asset filename like `ships/fighter.svg` or a build-time content hash) when calling `svgToPolylines`. This avoids the need to compute a runtime hash and makes cache semantics explicit.
- If your CI/build pipeline can compute a content hash (SHA1/SHA256) for each asset at build time, use that as the `assetId`. That makes cache invalidation explicit: when the file contents change, the content hash changes and a new cache key will be used.
- If you cannot provide `assetId`, the runtime will hash the SVG content; this is safe but slower. Keep calls to `svgToPolylines` cached at the loader layer (call once per asset and reuse the returned contours) rather than re-parsing the same string repeatedly.
- For editing and rapid iteration during development, disable aggressive caching by calling `clearSvgPolylinesCache()` or temporarily reducing TTL while you iterate.

Invalidation patterns
---------------------

- Build-time: Prefer invalidation via content-hashed `assetId`. When the build outputs a new file with a new content hash, the loader will call `svgToPolylines` with a different `assetId` and the cache automatically treats it as a new entry.
- Runtime: Use `clearSvgPolylinesCache()` to forcibly clear all entries (useful for hot-reload tooling in development). For selective invalidation you can call `clearSvgPolylinesCache()` and rewarm the cache by re-loading your changed assets.

When to avoid caching
---------------------

- Extremely large or procedural SVGs that change every frame or per-instance should not be fed into `svgToPolylines` repeatedly; instead generate contours once per unique shape and reuse the contours.
- If memory is at a premium and you only use a small number of assets, you may lower `CACHE_MAX_ENTRIES` or rely on your loader to keep a small memoization map instead of the global cache.

Notes for integrators
---------------------

- The contours returned by `svgToPolylines` are normalized into a viewBox-centered unit space; multiply by the entity radius/scale when using for rendering or collision.
- Transforms on groups and elements (translate, rotate, scale, skew) are applied before normalization, so rotated/scaled elements produce correct contours.
- The cache key includes the `tolerance` parameter (curve flattening and simplification tolerance) — different tolerances produce different contours and are cached separately.

If you have questions or want the cache policy to be configurable at runtime (TTL, capacity, eviction policy), open an issue or PR and we can add a small configuration API to the module.

Migration checklist (build-time content hashing)
------------------------------------------------

Use this quick checklist to compute stable content-based `assetId`s at build time and wire them into the loader:

1. Compute a short content hash for each SVG (recommended: SHA-1 or SHA-256, base36/base62 or hex) during your build step. Keep the hash reasonably short (8-12 chars) for readability.

  Node.js example (build script):

```js
// scripts/hash-assets.js
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const folder = path.join(__dirname, '..', 'src', 'config', 'assets', 'svg');
const out = {};
for (const f of fs.readdirSync(folder)) {
  if (!f.endsWith('.svg')) continue;
  const data = fs.readFileSync(path.join(folder, f));
  const h = crypto.createHash('sha1').update(data).digest('hex').slice(0, 10);
  out[f] = h;
}
fs.writeFileSync(path.join(folder, 'svg-hashes.json'), JSON.stringify(out, null, 2));
```

2. Emit or commit the mapping file (`svg-hashes.json`) alongside your assets, or embed the mapping into the game's asset manifest that the loader reads at runtime.

3. Wire the `assetId` into the loader call. If your loader knows both the original asset path and the computed content hash, call `svgToPolylines(svgString, { assetId: `${pathOrName}::${hash}` })` or simply `${hash}` depending on your preference.

  Example (pseudo):

```ts
const mapping = require('./svg-hashes.json');
const svgString = fs.readFileSync(assetPath, 'utf8');
const assetId = `${assetFilename}::${mapping[assetFilename]}`;
const contours = svgToPolylines(svgString, { assetId });
```

4. For CI/production: ensure that any change to an SVG file results in a new content hash so the loader will generate a new cache key and the system will re-parse and re-cache the updated contours.

5. Development tip: during active editing you can either clear the cache programmatically (`clearSvgPolylinesCache()`) or shorten the TTL while you iterate rapidly.

If you'd like, I can add a small utility script that computes the mapping and demonstrates wiring into the existing asset loader in this repo — tell me whether you prefer a Node script, a PowerShell snippet, or a cross-platform npm script and I'll add it.
