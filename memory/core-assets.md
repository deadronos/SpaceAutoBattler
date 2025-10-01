# Memory — core-assets

Files: `src/utils/patchGltfLoader.ts`, `src/assets/ships.ts`, `src/main.tsx`

Responsibilities

- `patchGltfLoader.ts`: guards GLTFLoader.load against invalid URLs for both three/examples and three-stdlib variants; it logs friendly warnings and keeps behaviour idempotent so multiple imports do not double-patch the loader.
- `assets/ships.ts`: provides `SHIP_MODEL_PATHS` mapping GLB imports to string URLs used by the renderer; these imports are emitted by the bundler as `asset/resource` URLs and consumed by Drei's `useGLTF`.
- `main.tsx` imports `patchGltfLoader` early to ensure the loader is patched before any component triggers a model load.

Renderer usage

- `ShipModel.tsx` and particle helpers resolve a hull key against `SHIP_MODEL_PATHS` and call `useGLTF(path)`; a missing path falls back to a small placeholder mesh so the renderer remains robust in test harnesses or missing asset scenarios.
- `ParticleTrails` and other renderer helpers sometimes pre-load GLTFs for accurate bounds/emit positions; prefer caching and Drei loaders for reuse and avoiding multiple file fetches.

Testing & build notes

- GLB assets are handled by the bundler; changes to filenames require updating `src/assets/ships.ts` or maintaining stable file names to avoid build churn.
- Unit tests that exercise model loads should mock `useGLTF` or run headless in a Node DOM shim; Playwright visual tests exercise real asset loading in an environment that more closely resembles production.

Updated: 2025-09-30
