
# core-assetLoader.md

## Purpose

Short memory describing where GLTF/SVG loader guards and asset model mappings live in the current codebase and how the renderer typically caches assets.

## Location (current files)

- `src/utils/patchGltfLoader.ts` — small runtime guard/patch for the GLTFLoader used at app bootstrap.
- `src/assets/ships.ts` — module that exports compiled asset URLs (GLB files) for ship hulls and is the canonical mapping used by the renderer to request model assets.

## Summary

The repository uses two light-weight helpers for assets:

- A runtime patch/guard for the GLTF loader (`patchGltfLoader.ts`) which ensures loader integration works across build targets and reduces the chance of runtime errors when GLTF loader internals differ between bundlers.
- A centralized mapping of ship model asset URLs (`src/assets/ships.ts`) so the renderer and spawn logic have a single source-of-truth for 3D model paths.

Caching note:

- Caching and pooling of parsed 3D assets is typically managed at the renderer bootstrap (renderer creates or attaches an assetPool to `GameState` or keeps a renderer-local cache). The codebase previously described an `assetPool` module; in the current layout, the renderer or higher-level bootstrap is responsible for caching parsed assets (often in a Map keyed by URL).

## Integration Points

- `src/main.tsx` imports `src/utils/patchGltfLoader.ts` during startup before mounting the app.
- `src/components` and renderer layers import `src/assets/ships.ts` to resolve model URLs when instancing ship visuals.

## Where to look

- `src/utils/patchGltfLoader.ts` (GLTF loader guard)
- `src/assets/ships.ts` (glb URL mappings)
- `src/components/*` for renderer usage and any renderer-side asset caching logic

