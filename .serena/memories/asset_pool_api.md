## Asset Pool

Last-Reviewed: 2025-09-07

The `assetPool` is the canonical cache and factory for runtime assets (ImageBitmaps, geometries, materials, particle textures). It's stored on `GameState.assetPool` and used by renderer and loader subsystems.

### Responsibilities

- Cache rasterized SVGs as `ImageBitmap` keyed by SVG content hash or path.
- Provide geometries and shared materials for instanced meshes.
- Register glTF prototypes for instanced rendering.
- Provide `release`/`dispose` hooks to free GPU resources when assets are no longer needed.

### Public API

- `getImageBitmap(key)`
- `registerPrototype(name, mesh)`
- `getPrototype(name)`
- `release(key)`

### Determinism & Constraints

- Caching is content-addressed; deterministic given same input assets. Must be used via `GameState.assetPool` per repository conventions.
