
# core-assetPool.md

## Purpose

Short memory describing the asset-caching pattern used by the renderer and how to approach an LRU asset pool if needed.

## Location (note)

- The repository does not currently include `src/core/assetPool.ts`. Instead, asset caching is usually implemented at renderer bootstrap or in renderer-local modules. This document explains the recommended approach and where to integrate one if you add it.

## Summary / Recommended Behavior

- A simple LRU cache over parsed assets (ImageBitmap, GLTF scenes, textures) is recommended to prevent repeated parsing and to bound memory usage.
- Implementation can be a small wrapper over `Map` that re-inserts accessed keys to mark them as recently used and evicts the oldest entries when capacity is reached. Optionally provide a `disposeCallback` to free Three.js resources on eviction.

## Integration Points

- `src/utils/patchGltfLoader.ts` and `src/assets/ships.ts` provide the loader guard and asset URL mappings; the renderer should attach or manage an `assetPool` (Map/LRU) at bootstrap and use it when loading models.
- `src/components/*` or `src/renderer/*` are the usual consumers of cached parsed assets.

## Example API (recommended)

- `const pool = new LRUAssetPool({capacity: 64, dispose: (v) => disposeThreeObject(v)})`
- `pool.get(url)`, `pool.set(url, parsedGltf)`, `pool.delete(url)`, `pool.clear()`

## Notes

- If you add a centralized `src/core/assetPool.ts`, link it from this file and update the index. Until then, treat the asset pool as a renderer-managed concern.
