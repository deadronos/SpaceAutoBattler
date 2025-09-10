# core-assetPool.md

## Purpose

Short memory for `src/core/assetPool.ts` describing the LRU asset pool used to cache rasterized or parsed assets (ImageBitmaps, GLTF objects, etc.).

## Location

src/core/assetPool.ts

## Summary

`LRUAssetPool` is a small, dependency-free LRU cache implemented on top of JavaScript `Map` insertion order. It's used to cache assets such as rasterized SVG ImageBitmaps or parsed GLTF objects in `state.assetPool` to avoid repeated parsing and to limit memory.

## Key Behavior

- Uses Map insertion order to track recency; `get()` re-inserts keys to mark recent use.
- When capacity is exceeded on `set()`, evicts the oldest entry and optionally calls a `disposeCallback` with the evicted value.
- `delete()` also calls `disposeCallback` if provided.
- Provides `clear()`, `has()`, `size` accessor and `entries()`/`keys()` iteration helpers.

## Integration Points

- `src/core/assetLoader.ts` uses `state.assetPool` which typically is an instance of `LRUAssetPool` to store GLTF or rasterized SVG assets.
- `src/renderer/threeRenderer.ts` reads from `state.assetPool` to decide to immediately create textured meshes or kick off async loading.

## Notes

- The implementation is intentionally simple and avoids heavy dependencies for portability in both main thread and worker contexts.
