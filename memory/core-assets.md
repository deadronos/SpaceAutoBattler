# Memory — core-assets

Files: `src/utils/patchGltfLoader.ts`, `src/assets/ships.ts`, `src/renderer/materialRegistry.tsx`, `src/main.tsx`

Responsibilities

- `patchGltfLoader.ts`: Idempotently guards GLTFLoader.load against invalid URLs across loader variants (three/examples and three-stdlib). It logs friendly warnings and ensures repeated imports do not double-patch the loader.
- `assets/ships.ts`: Provides `SHIP_MODEL_PATHS` mapping hull keys to GLB URLs used by the renderer; these files are emitted by the bundler as `asset/resource` and consumed by Drei's `useGLTF`.
- `materialRegistry.tsx`: Central place for registering and reusing renderer materials across ships and effects; helps avoid creating per-instance ShaderMaterials and reduces GC pressure.
- `main.tsx` imports `patchGltfLoader` early to ensure the loader is patched before any component triggers model loads.

Renderer usage

- `ShipModel.tsx` and particle helpers resolve a hull key against `SHIP_MODEL_PATHS` and call `useGLTF(path)` or material registry helpers. A missing path falls back to a placeholder mesh so the renderer stays robust in test harnesses.
- The `materialRegistry` provides cached materials (shields, hull tints, rim shells) and exposes disposal hooks to avoid memory leaks when materials are replaced or hot-swapped.

Testing & build notes

- Asset imports are handled by the bundler; changing filenames requires updating `src/assets/ships.ts` mappings to keep stable asset paths.
- Unit tests that exercise model loads should mock `useGLTF` or use Node DOM shims; Playwright visual tests exercise real asset loading in a headless browser closer to production.

References

- `src/utils/patchGltfLoader.ts`, `src/assets/ships.ts`, `src/renderer/materialRegistry.tsx`, `src/components/ShipModel.tsx`

Updated: 2025-09-30
