# threeRenderer — Three.js renderer factory and scene management

Last-Reviewed: 2025-09-15

Purpose

- Provides `createThreeRenderer(canvas, options)` which sets up the Three.js scene, camera, lights, and post-processing pipeline.
- Manages instancers, mesh factories, and effect pools for bullets, explosions, trails, and health bars.

Responsibilities

- Create scene, camera (perspective), and renderer with physically-correct lighting where needed.
- Configure EffectComposer and default post-processing passes (bloom, FXAA, tone mapping) according to `config/rendererConfig`.
- Provide high-level API for game loop: `renderer.update(state, dt)`, `renderer.render()`.
- Manage `assetPool` usage for shared geometries, materials, and textures to avoid redundant allocations.
- Create and manage instancers:
  - `shipInstancer` for ship meshes (per-ship transforms & per-instance uniforms)
  - `bulletInstancer` for projectile visuals
  - `effectPool` for short-lived particle/explosion meshes
- Expose debug helpers for toggling wireframe, bounding boxes, and instancer counts.

Integrations

- Expects `state.assetPool` to be pre-populated with necessary geometries (from svg rasterizer or glTF loader).
- Uses `renderer/meshFactory` to create base prototypes which are then instanced.

Session notes (2025-09-15): Reviewed and updated last-reviewed date; aligned responsibilities with `main.ts` and `svg_loader_api` memories.
