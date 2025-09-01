# core-assetLoader.md

Purpose
-------
Short memory for `src/core/assetLoader.ts` summarizing the lightweight asset loader utilities (GLTF and SVG rasterization) and how they integrate with the `GameState.assetPool`.

Location
--------
src/core/assetLoader.ts

Summary
-------
`assetLoader.ts` provides small helper functions to lazily load heavy asset parsing code (e.g., GLTF loader) and caches results in `state.assetPool` when present. This keeps initial bundle size down and provides a simple caching layer that other renderer code can rely on.

Key Responsibilities
--------------------
- Expose `loadGLTF(state, url)` which:
  - Checks `state.assetPool` for cached assets and returns cached data if present.
  - Dynamically imports `three/examples/jsm/loaders/GLTFLoader.js` to avoid bundling heavy loader code at module evaluation time.
  - Loads GLTF and stores the parsed gltf in `state.assetPool` if available.
  - Returns a promise resolving to an `AssetHandle` { url, data }.

Integration Points
------------------
- Reads/writes `state.assetPool` (a Map-like LRU cache implemented in `src/core/assetPool.ts`) for caching parsed assets.
- Used by renderer modules (e.g., `src/renderer/threeRenderer.ts`) to fetch 3D models.

Performance Notes
-----------------
- Dynamic import reduces startup weight and runtime overhead when GLTF assets aren't used.
- Asset caching in `assetPool` prevents repeated parsing/loading.

Edge Cases & Fallbacks
----------------------
- If `state.assetPool` access throws, code ignores errors and proceeds; fails gracefully.
- Errors from the loader are propagated via promise rejection.

Where to look
-------------
- `src/core/assetPool.ts` for cache implementation.
- `src/renderer/threeRenderer.ts` for usage and lazy rasterization of vector assets.

References
----------
- src/core/assetPool.ts
- src/renderer/threeRenderer.ts

