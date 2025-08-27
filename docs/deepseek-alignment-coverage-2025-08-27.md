# DeepSeek SVG → Canvas/WebGL2 Alignment — Coverage & Actions (2025-08-27)

This document maps our current codebase against the recommendations in `docs/deepseek3.1svg2webglconsiderations.md`, with evidence and a minimal set of actions to close the biggest gaps.

## 1) Checklist extracted from DeepSeek doc

A. Asset preparation and management

- SVG optimization via SVGO/tiny compressors; strip metadata
- Consistent coordinate systems and sizing
- Layered assets (ships, weapons, effects)

B. Conversion approaches

- Rasterization path (Canvas/OffscreenCanvas + createImageBitmap)
- Vector-to-mesh path (triangulation: earcut/cdt2d or similar)

C. Automation pipeline

- Build-time preprocessing scripts for batch conversion
- Runtime caching (in-memory + persistent e.g., IndexedDB)
- Worker offloading for heavy conversions

D. WebGL2 integration

- Texture uploads from Canvas/ImageBitmap (texImage2D)
- Mipmapping for zoomed views
- Instanced rendering (drawArraysInstanced/drawElementsInstanced)

E. Optimization strategies

- LOD variants (bitmap resolutions / mesh simplification)
- Texture atlas packing to reduce binds/draws

F. Advanced techniques

- Procedural SVG generation for backgrounds
- Shader-driven effects on meshes (vertex anims, shields, glows)

G. Challenges & mitigations

- Aliasing/quality (MSAA/mipmaps, higher-res precompute)
- CPU cost (workers, precompute)
- Compatibility & security (sanitize SVG, CORS)

## 2) Evidence scan (repository)

- Workers and messaging
  - Present: simulation worker + tests
    - `src/createSimWorker.ts`, `src/simWorker.ts`
    - Tests: `test/vitest/worker_snapshot_render.spec.ts`, `test/vitest/teamcounts.spec.ts`
  - Not found in src: OffscreenCanvas/createImageBitmap usage for rasterization

- WebGL2 usage
  - Context acquisition present:
    - `src/webglrenderer.ts` (getContext('webgl2'|'webgl'))
  - Texture pipeline present (Canvas → texture):
    - `gl.pixelStorei(UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0)`; `texImage2D`; linear filters; clamp wrap
    - Evidence: `src/webglrenderer.ts` lines ~259-264, dist bundles mirror this
  - Instancing: Not present in src (only in docs)

- SVG parsing/geometry
  - `src/assets/svgToPolylines.ts` implemented with in-memory cache and robust tests
  - `src/assets/svgLoader.ts` browser-safe; hull extraction path present

- Rasterization
  - Dev scripts for offline/inline raster data URLs
    - e.g., `scripts/test_raster_inline.mjs`, `scripts/dump_hull.mjs`
  - No runtime OffscreenCanvas/worker raster path in src

- Atlases/LOD
  - Concept referenced in docs
  - No implementation found in src

- Persistent caching
  - No IndexedDB/CacheStorage/idb-keyval/localforage usage in src

- Security/sanitization
  - No DOMPurify/SVGO runtime sanitization in src; SVGO not in deps
  - `corser` present (dev server CORS), but not SVG sanitizer

## 3) Coverage matrix (status + notes)

- Asset optimization (SVGO) — Missing
  - Notes: Recommended in docs; no build step or dep present

- Consistent coords/layers — Partial
  - Notes: Codebase uses normalized shapes/polygons; layering exists in render flows; not formally codified per-asset

- Rasterization (Canvas/Offscreen, ImageBitmap) — Partial
  - Notes: Canvas uploads exist; no OffscreenCanvas/createImageBitmap in src; dev scripts show raster experiments

- Vector-to-mesh (triangulation) — Missing
  - Notes: Only polylines/polygons; no earcut/cdt2d triangulation path implemented

- Build-time preprocessing — Partial
  - Notes: Several `scripts/*.mjs` utilities; no automated SVGO/atlas/mesh pipeline

- Runtime caching (memory + IndexedDB) — Partial
  - Notes: In-memory cache for svgToPolylines with TTL exists; no persistent cache

- Worker offloading — Partial
  - Notes: Simulation worker in place; no rasterization/triangulation worker

- Texture uploads (texImage2D) — Covered
  - Notes: Implemented with sensible defaults; premultiplied alpha disabled for upload

- Mipmapping — Missing
  - Notes: Only LINEAR min/mag; no generateMipmap or anisotropic filtering

- Instanced rendering — Missing
  - Notes: Mentioned in docs; not present in renderer

- LOD — Missing
  - Notes: Not implemented for bitmaps or meshes

- Texture atlas — Missing
  - Notes: No atlas manager or bin packer in src

- Procedural SVG backgrounds — Missing
  - Notes: No code paths; optional future enhancement

- Shader-driven mesh effects — Missing
  - Notes: No mesh pipeline yet

- Security/sanitization — Missing
  - Notes: No SVGO/DOMPurify; recommend sanitize + safe subset enforcement

Overall alignment score (rough): 40% (Covered: texture upload + svg polylines cache; Partial: worker infra (non-render), raster via Canvas incomplete; Missing: instancing, mipmaps, atlas, LOD, persistent cache, sanitization, mesh path)

## 4) Targeted action plan (small, high-ROI steps)

Phase 1 — Raster + cache foundation

1. Add `src/assets/svgRasterWorker.ts` (OffscreenCanvas)

- Contract: rasterize(svgText: string, width: number, height: number, opts?) → Promise<ImageBitmap | OffscreenCanvas | {transferable bitmap}>
- Use `OffscreenCanvas(width, height)`; draw via 2D context; return `canvas.transferToImageBitmap()` if available; fallback to `canvas` and let caller upload
- Message schema: { type: 'raster', id, svg, width, height, options } → { type: 'raster:done', id, bitmap }

1. Add `src/assets/svgRaster.ts` (main-thread helper)

- `rasterizeSvgToBitmap(svgText, size, opts): Promise<ImageBitmap>`
- Internally spawn/keep a worker; detect lack of OffscreenCanvas and fallback to `createImageBitmap(dataURL)` on main thread

1. Persistent cache (idb-keyval)

- Add `idb-keyval` dependency; cache by key: hash(svgText or assetId) + size + style; TTL + version
- Wire through `svgRaster.ts` to check/get/put

1. Minimal Playwright smoke test

- Load a small page that calls `rasterizeSvgToBitmap` for a known SVG (triangle)
- Assert a few pixel color counts (simple heuristic) or just that a non-zero bitmap is returned

Phase 2 — Texture improvements

1. Texture upload path improvements in `webglrenderer.ts`

- If POT or allow, `gl.generateMipmap(gl.TEXTURE_2D)`; set MIN_FILTER to LINEAR_MIPMAP_LINEAR
- Try EXT_texture_filter_anisotropic for zoom clarity
- Support `ImageBitmap` upload fast path

Phase 3 — Draw efficiency

1. Instanced renderer scaffold `src/webgl/instancedRenderer.ts`

- Quad-based sprite instancing for ships/projectiles; per-instance transform + UV rect; batch draws per atlas

1. Texture atlas MVP

- Simple shelf/bin packing; atlas textures sized power-of-two; update UVs for instanced sprites

Phase 4 — Optional/next

1. Mesh triangulation worker (earcut/cdt2d) for hull-quality meshes
1. LOD variants (multi-res bitmaps; mesh simplification)
1. Build-time SVGO pass and SVG sanitization (DOMPurify for runtime-imported SVG)

## 5) Acceptance notes & risks

- Keep determinism: hash assetId + params for caching; ensure same seed yields same visuals
- Security: sanitize external SVG; block foreignObject, remote hrefs; prefer data: URLs from trusted text
- Performance: lift uploads out of hot paths; batch raster/atlas work during loading; cap worker concurrency
- Testing: add 1-2 vitest units for cache keying and a Playwright smoke for raster worker

## 6) Quick references

- Present code anchors
  - WebGL2 context + texture upload: `src/webglrenderer.ts`
  - SVG polylines cache: `src/assets/svgToPolylines.ts`
  - Worker infra patterns: `src/createSimWorker.ts`, tests under `test/vitest/worker_*`
- Docs to align
  - `docs/context7canvas-best-practices.md`
  - `docs/context7webgl-best-practices.md`
  - `docs/deepseek3.1svg2webglconsiderations.md`
