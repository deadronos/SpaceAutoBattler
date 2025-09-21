# threeRenderer — Three.js renderer factory and scene management

Last-Reviewed: 2025-09-21

Purpose (authoritative):

- The `threeRenderer` responsibilities are implemented in `src/renderer/` (e.g., `src/renderer/threeRenderer.tsx` or `src/renderer/threeRenderer.ts` depending on the app entry). This memory documents the runtime integration points.

Responsibilities:

- Create and configure the Three.js `Renderer`, `Scene`, `Camera`, and `EffectComposer` according to `src/config/rendererConfig.ts`.
- Provide `renderer.update(state, dt)` and `renderer.render()` helpers invoked by the main loop in `src/main.tsx`.
- Manage instancers (ship, bullet, effects) and use the renderer asset cache/prototypes to avoid repeated geometry/material allocations.
- Wire asset preloading using `src/assets/ships.ts` and `src/utils/patchGltfLoader.ts`.

Integration notes:

- The renderer may attach an `assetPool` to `GameState` or keep its own internal cache; both patterns are supported. Prefer attaching for easier testing and headless runs.
- Instancer registration expects prototype meshes to be available before first render; the renderer should gracefully fallback to placeholders if assets are missing.

References:

- `src/main.tsx`, `src/assets/ships.ts`, `src/utils/patchGltfLoader.ts`, `src/renderer/meshFactory.ts`, `src/renderer/shipInstancer.ts`
