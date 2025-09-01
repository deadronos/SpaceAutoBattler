# renderer-threeRenderer.md

Purpose
-------
Short memory describing `src/renderer/threeRenderer.ts`: the Three.js-based renderer, scene/camera setup, instancing, visual effects, and integration points with effects manager and asset pool.

Location
--------
src/renderer/threeRenderer.ts

Summary
-------
`createThreeRenderer(state, canvas)` builds and returns a renderer handle that encapsulates a Three.js scene, camera, lighting, skybox, and entity instancing/management. It synchronizes `GameState` entities (ships, bullets) to GPU-visible objects (instanced or regular meshes), provides health/shield visual effects, and delegates postprocessing to `EffectsManager` when available.

Key Responsibilities
--------------------
- Initialize `THREE.WebGLRenderer`, scene, and `PerspectiveCamera` using `RendererConfig`.
- Maintain camera rotation, distance (exposed via getter/setter), and camera target derived from simulation bounds.
- Generate an animated procedural skybox (cube or sphere fallback) using canvas textures and light procedural nebula/star patterns.
- Create scene lighting and world boundary wireframe.
- Manage groups and maps for ships, bullets, health bars, and shield effects.
- Support instanced rendering via `shipInstancer`, `BulletInstancer`, and `HealthBarInstancer` when enabled in `RendererConfig`.
- Lazy-load SVG ship artwork via `loadSVGAsset` and `assetPool` (if available), using placeholders until assets load.
- Provide billboarded GPU health bars (pooled shader materials) with camera-facing logic and color/alpha pooling.
- Implement shield shader material with hex-grid hit highlighting and ripple effects tied to game timestamps.
- Sync entities: create/remove meshes/instances in `syncEntities()`, update transforms in `updateTransforms()`.
- Resize handler and `resize()` function to adapt renderer and camera to window size.
- Render loop `render(dt)` that updates transforms, health bars, skybox animation, and either uses `EffectsManager.render` or `renderer.render` as fallback.
- Disposal logic for renderer and pooled resources.

Important Data & Fields
-----------------------
- `shipMeshes`, `bulletMeshes`, `healthBarMeshes`, `shieldEffectMeshes` maps for non-instanced objects.
- `billboardMaterialPool` & `billboardMaterials` for reuse of shader materials keyed by color+alpha.
- `skyboxCanvases`/`skyboxTextures` arrays for animated skybox; `sphereSkybox` fallback mesh.
- `bulletInstancer`, `healthBarInstancer`, `shipInstancer` for optional instanced rendering support.

Integration Points
------------------
- Reads `state.ships`, `state.bullets`, `state.time` and `state.simConfig` (for bounds).
- Reads `state.assetPool` (if present) for preloaded SVG assets.
- Uses `createEffectsManager` from `src/renderer/effects.js` for postprocessing when available; falls back gracefully if missing.
- Uses `loadSVGAsset` from `src/core/assetLoader.js` to rasterize SVGs to ImageBitmaps for textures.
- Exports `render`, `resize`, `dispose`, `cameraRotation`, `cameraDistance`, and `cameraTarget`.

Performance Notes
-----------------
- Prefers instanced rendering for ships/bullets/health bars when enabled to reduce draw calls and per-object allocations.
- Uses pooling for billboard materials to avoid shader/material churn.
- Precomputes star data for skybox to avoid per-frame pixel reads; uses canvas draws to update textures efficiently.
- Uses `ship._healthDirty` and `ship._shieldDirty` flags to reduce frequent material/mesh updates.

Edge Cases & Fallbacks
----------------------
- Graceful fallbacks when `EffectsManager` isn't available: direct `renderer.render(scene, camera)`.
- If SVG rasterization fails or `assetPool` is missing, uses a 3D placeholder geometry and logs errors.
- Canvas resizes are guarded; if the canvas isn't writable in test environments, resizing is ignored.

Where to look / How to debug
---------------------------
- Entry point: `createThreeRenderer` called from `src/main.ts` during app init.
- Visual debugging: inspect `scene` contents, `shipMeshes`, and instancer state; check `ship._healthDirty` flags.
- To tweak skybox or shield visuals, modify `RendererEffectsConfig` and `RendererConfig`.

References
----------
- src/renderer/effects.ts - postprocessing/effects manager
- src/core/assetLoader.ts - SVG rasterization and asset pool
- src/config/* - rendering and visual configuration

