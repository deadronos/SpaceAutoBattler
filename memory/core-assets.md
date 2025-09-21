# Memory — core-assets

Files: `src/utils/patchGltfLoader.ts`, `src/assets/ships.ts`

Responsibilities:

- `patchGltfLoader.ts`: guards GLTFLoader.load against invalid URLs for both three/examples and three-stdlib variants; best-effort, idempotent.
- `assets/ships.ts`: provides `SHIP_MODEL_PATHS` mapping GLB imports to string URLs used by the renderer; integrates with bundler asset/resource.

Renderer usage:

- `Ship.tsx` resolves model path by hull and loads via Drei `useGLTF` (cached); falls back to a placeholder mesh if path invalid.
