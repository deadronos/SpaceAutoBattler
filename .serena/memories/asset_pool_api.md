# Asset Pool

Last-Reviewed: 2025-09-21

Summary (authoritative):

- Historical location: `src/core/assetPool.ts` in earlier repo versions.
- Current practice: The renderer is responsible for caching parsed Three.js objects (geometries, materials, GLTF prototypes). The renderer typically attaches a `Map` or an LRU wrapper to `GameState` during bootstrap (for example `state.assetPool = new Map()`), or it keeps the pool locally in renderer module scope.

Responsibilities (renderer-centered):

- Cache parsed GLTF scenes and prototypes keyed by URL or content hash.
- Provide factory / prototype registration functions for instancers (e.g., `registerPrototype(name, mesh)`), typically exposed by the renderer bootstrap, not a core module.
- Provide explicit `dispose(key)` hooks to free GPU resources when assets are no longer used.

Public API (recommended when authoring a shared pool):

- `get(key)` -> returns cached asset or `undefined`
- `set(key, value)` -> stores parsed asset
- `registerPrototype(name, mesh)` -> convenience for instancers
- `dispose(key)` -> frees resource and removes from pool

Notes & guidance:

- Keep asset lifecycle in renderer; do not introduce module-level runtime state in core simulation modules.
- If you need a canonical shared pool for non-renderer users (tests, headless), add a small `src/utils/assetPool.ts` that implements the minimal Map or LRU interface and attach it to `GameState` at startup.

References:

- `src/utils/patchGltfLoader.ts` — loader compatibility & runtime guard
- `src/assets/ships.ts` — canonical mapping of ship classes to model URLs
