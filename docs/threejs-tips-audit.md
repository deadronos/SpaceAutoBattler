# three.js Tips & Tricks Audit — SpaceAutoBattler

This document audits the repository `src/` against a curated set of three.js and WebGL best practices (performance, resource reuse, renderer/scene usage, materials, textures, lights, shadows, disposal, and asset handling). Each file is given a confidence rating (0-100) indicating how closely the implementation follows the tips in the provided checklist, followed by short rationale and concrete suggestions.

Summary (high level):
- Strengths: Good reuse of asset pools, conservative devicePixelRatio, explicit disposal paths in renderer, use of BufferGeometry and shader pooling for billboards, LRU asset pool implementation, careful SVG rasterization with caching and change detection.
- Improvement areas: Some expensive operations run on the main thread (SVG rasterization), potential DOM/Canvas resizing behavior, shader/material proliferation (materials created per-object in some places), limited texture encoding handling, minor GC pressure from frequent array/map allocations in hot loops, missing explicit texture disposal in some code paths, and a few places where spatial queries fall back to linear scans.

Rating key: 0 = not following tips at all, 100 = excellent alignment with three.js performance & correctness tips.

## Per-file ratings

| File | Score | Notes & Recommendations |
|---|---:|---|
| `src/renderer/threeRenderer.ts` | 88 | Strong: central renderer, reuses groups, pools billboard materials, caps devicePixelRatio, avoids per-frame allocation where possible, separates effects manager. Suggestions: ensure textures created from ImageBitmap set proper encoding (sRGB for color maps) and call .dispose() for any created Textures when replacing assets; avoid creating temporary Vector3/Matrix4 per-frame (they are created repeatedly in render loop). Consider caching camera direction vectors to avoid allocations. |
| `src/core/assetLoader.ts` | 86 | Good: lazy imports of GLTFLoader and caching to `state.assetPool`. Suggestion: use the provided `LRUAssetPool` consistently, and ensure GLTF <-> textures disposal when assets are no longer needed. Also consider setting texture.encoding for color maps when loading glTF materials. |
| `src/core/assetPool.ts` | 95 | Very good — efficient LRU using Map order. Suggest adding a .dispose() hook for values that need explicit cleanup (e.g., ImageBitmap, THREE.Textures, GLTF scenes). |
| `src/core/svgLoader.ts` | 72 | Conservative approach (main-thread rasterization with timeouts) improves compatibility, but rasterizing on main thread can block frames. Suggestions: enable OffscreenCanvas/worker rasterization when available; ensure createImageBitmap is used where possible; explicitly set texture.generateMipmaps / minFilter / encoding after creating textures; limit raster size and cache aggressively. Also ensure ImageBitmap.close() is called on evicted assets (already done in clearCache). |
| `src/core/svgRasterWorker.ts` | 70 | Worker exists but currently falls back to geometric fallback in worker; implies main thread rasterization used. Recommend finishing worker implementation for OffscreenCanvas + createImageBitmap and using transferable ImageBitmap to main thread to avoid blocking. Also ensure proper cache maxEntries/age tuning. |
| `src/core/gameState.ts` | 90 | Simulation code is clean and separates concerns. Recommendations: ensure heavy operations (spatial grid updates) are batched and avoid rebuilding large arrays/maps per-frame; spatial grid usage is present—ensure queries are used widely to avoid linear searches. Good use of seeded RNG and configurable behavior. |
| `src/core/physics.ts` | 85 | Good: optional Rapier worker usage in main supports in-thread fallback. Suggest exposing hooks to bulk-update bodies (avoid per-entity costly calls), and ensure world.step uses fixed dt and minimal allocations. Also guard dynamic require to fail gracefully if Rapier isn't present. |
| `src/core/systems/projectileSystem.ts` | 88 | Uses spatial index when available; falls back to linear, and separates adapter concerns. Suggest tuning collision radii constants to use config values and avoiding repeated array lookups for ship lists (cache references where safe). Good eventing model. |
| `src/main.ts` | 82 | High-level wiring is clear; uses requestAnimationFrame loop with fixed-step simulation. Suggestions: avoid JSON.stringify comparisons for shipData to detect changes for worker messages (expensive) — use cheap versioning or a dirty flag. Also avoid creating a new Worker with module URL in environments that may not support it. Consider debouncing resource-heavy operations in init. |
| `src/utils/*` (vector3, spatialGrid, rng, logger, fileWatcher) | 90 | Utilities are well scoped. `fileWatcher` integration is useful for dev hot-reload. Suggest ensuring spatialGrid query performance (use typed arrays where hot) and logger debug gates avoid work when disabled (already in place). |
| `src/renderer/effects/*` | 86 | Custom shaders for shield effects and pooling are advanced and well designed. Suggest reviewing shader loops for dynamic HIT_MAX sizing (using uniform arrays is fine) and ensuring shader compilation is minimized (e.g., avoid dynamic recompiles per-material). |

## Cross-cutting observations and concrete fixes

- Texture encoding: When creating THREE.Texture from ImageBitmap (see `threeRenderer.meshForShip`), set `texture.encoding = THREE.sRGBEncoding` for color maps and `texture.generateMipmaps = true` when using mipmaps, or explicitly disable and set filters for rasterized assets sized to powers-of-two. This ensures more accurate colors and better GPU sampling.

- Avoid main-thread SVG rasterization on the hot path: implement worker OffscreenCanvas rasterization and transfer ImageBitmap to main thread. The current `svgRasterWorker.ts` contains a fallback geometric render; finish the worker implementation and enable it when supported.

- Material reuse: Some materials are created per-ship when creating placeholders or textured parts. Consider pre-creating shared materials for common uses or cloning only when necessary. Materials used with skinning/morphs must be unique; otherwise reuse aggressively.

- Per-frame allocations: In `threeRenderer.render`, temporary Vector3/Matrix4 objects are allocated during camera basis computations. Cache these temporaries at module scope or re-use them to reduce GC churn.

- Health bar billboards: Good pooling of ShaderMaterials; ensure the pool size is bounded and materials are disposed when renderer.dispose runs (already implemented). Consider using InstancedMesh for large numbers of identical billboards for further drawcall reduction.

- Avoid expensive change detection by serializing large arrays: In `main.ts` the simWorker messaging compares shipData via JSON.stringify — expensive for larger numbers of ships. Use a simple generation counter, tick number, or shallow checksum to detect changes.

- Use proper canvas/resolution handling: `threeRenderer.resize` sets canvas.width/height directly then calls `renderer.setSize(w,h,false)`. This is fine but ensure that canvas backing store size matches CSS size and devicePixelRatio is accounted correctly (already using limited DPR). Consider using renderer.setSize(w, h, true) and letting three.js handle pixel ratio unless custom behavior is required.

- Disposal: Where textures and ImageBitmap are replaced (e.g., when SVG asset loads and a placeholder is swapped for final mesh), ensure the placeholder's geometry/material and any created textures are disposed to free GPU memory. The renderer dispose handles pooled materials, but GLTF meshes/textures loaded via GLTFLoader should be disposed or tracked in the asset pool's dispose hook.

## Next steps (low-risk improvements)

1. Add explicit texture.encoding assignments after creating THREE.Texture from ImageBitmap (sRGB for color textures).
2. Replace JSON.stringify-based ship data change detection with a small version counter updated when ships change.
3. Implement/enable worker-based SVG rasterization using OffscreenCanvas and createImageBitmap transfer; fall back to main-thread only if worker not available.
4. Cache temporary Vector3/Matrix4 used in `threeRenderer.render` to reduce per-frame allocations.
5. Add a small LRUAssetPool.dispose() that iterates entries and calls .close() for ImageBitmap and .dispose() for THREE.Textures / GLTF scenes when possible.

## Requirements coverage mapping

- Scan `src/` files and produce a per-file rating: Done (see table above).  
- Generate `/docs/threejs-tips-audit.md`: Done (this file).  

If you want, I can implement the low-risk improvements (1-4) as small PRs. I can start with the safe changes: texture.encoding assignment and replacing JSON.stringify change detection (these are small edits). Tell me which improvements you'd like me to apply first.

---
Generated on: 2025-08-31
