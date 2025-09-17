# Renderer Pipeline: glTF Loader → Asset Pool → Instancing → Three.js Renderer

This document explains how models and renderables move through the engine:
from glTF loading, into the asset pool cache, through instancing layers, and
finally into the Three.js renderer’s per‑frame update loop.

## Overview

- glTF (.glb) models are loaded asynchronously and cached in `GameState.assetPool`.
- Ship preload registers per‑class (and team) prototypes, optionally extracting
  Three.js geometries/materials for instancing.
- The Three renderer initializes instancers (ships, bullets, health bars) and
  consumes those prototypes to draw many objects efficiently via
  `THREE.InstancedMesh`.
- Each frame updates instance transforms and marks GPU buffers dirty once.

## Components & Responsibilities

- Asset Loader (`src/core/assetLoader.ts`)
  - `loadGLTF(state, url)`: dynamically imports Three’s `GLTFLoader`, loads a
    `.glb`, and caches the result in `state.assetPool` keyed by URL.
  - Returns `{ url, data: gltf }`. Reads from the cache on subsequent loads.

- Asset Pool (`src/core/assetPool.ts`, `src/types/index.ts`)
  - `LRUAssetPool<T>` provides a Map‑based LRU with optional dispose callbacks.
  - Runtime uses `GameState.assetPool?: Map<string, unknown>` as the canonical
    cache surface accessed by loaders and the renderer.

- Ship Model Preload (`src/core/shipModelLoader.ts`)
  - `preloadShipModels(state, teams?)` loads each class from
    `src/config/shipModelMap.ts` via `loadGLTF`.
  - Stores a prototype under keys: `ship-<class>` and `ship-<class>-<team>`.
  - Prototype fields: `gltf`, `scale`, `pivotOffset`, `boundsRadius`,
    `attribution`, and optional `threePrototypes` extracted by traversing
    `gltf.scene` and cloning meshes’ geometry/material.

- Renderer (`src/renderer/threeRenderer.ts`)
  - Creates `THREE.WebGLRenderer`, `Scene`, `Camera`, and groups for ships,
    bullets, and health bars.
  - Instantiates instancers based on `src/config/rendererConfig.ts` flags:
    - Bullets: `new BulletInstancer(scene, bulletsGroup)`
    - Health bars: `new HealthBarInstancer(scene, healthBarsGroup)`
    - Ships: `shipInstancer.init(scene, shipsGroup)`
  - If ship prototypes were preloaded, registers `threePrototypes` with the
    ship instancer so instanced ships get correct visuals.

- Instancers
  - Bullets (`src/renderer/bulletInstancer.ts`)
    - One `InstancedMesh` with shared sphere geometry/material.
    - Manages `activeBullets` map and `freeIndices`; grows capacity when needed,
      copying matrices; disables mesh frustum culling to avoid per‑instance
      culling artifacts. Per‑frame: `updateBulletTransform()` then a single
      `instanceMatrix.needsUpdate = true` via `markMatrixNeedsUpdate()`.
  - Health Bars (`src/renderer/healthBarInstancer.ts`)
    - Four `InstancedMesh` layers: `background`, `health`, `shield`, `border`.
    - Tracks `activeShips` and updates per‑instance transforms/colors/scales.
    - Updates camera‑facing billboard basis each frame via shared uniforms
      (`cameraRight`, `cameraUp`), with small camera‑forward offset to reduce
      z‑fighting. Supports capacity growth and per‑layer replacement.
  - Ships (`src/renderer/shipInstancer.ts`)
    - Groups keyed by `className` and optional `team`, each holding one
      `InstancedMesh` per prototype geometry, plus capacity/free‑list and id
      mappings. Supports `instanceColor` attribute via an `onBeforeCompile`
      shader patch that multiplies instance color into diffuse output.
    - Provides `allocate`, `free`, `updateTransform`, `markMatricesNeedUpdate`,
      `sync`, and `cull(camera)` for coarse bounds pruning.

## Data Flow

1. Model discovery
   - `src/config/shipModelMap.ts` maps ship classes to `.glb` files and basic
     metadata (`scale`, `boundsRadius`, …).

2. Load and cache
   - `preloadShipModels` calls `loadGLTF`, which caches the loaded glTF in
     `state.assetPool` under the URL key and emits a prototype per class/team
     key (`ship-<class>`, `ship-<class>-<team>`).

3. Prototype registration
   - During renderer init, if `threePrototypes` exist in the asset pool for a
     class, the renderer registers those geometries/materials with the ship
     instancer. Otherwise, the ship instancer falls back to its internal defaults.

4. Frame updates
   - Ships: ensure instance allocation for each ship id/class/team, then
     `updateTransform(id, pos, quat, scale)`. End of frame: `shipInstancer.sync()`
     marks buffers for GPU update; optional `cull(camera)` to skip work.
   - Health bars: `updateCameraUniforms(camera)` once per frame; for each ship,
     `updateHealthBar(ship)` updates per‑layer transforms/attributes; end of
     frame `markMatricesNeedUpdate()`.
   - Bullets: spawn/despawn via `allocateInstance`/`freeInstance`; update
     transforms; end of frame `markMatrixNeedsUpdate()`.

## Configuration

`src/config/rendererConfig.ts` controls feature flags and capacities:

- `instancing.enableBullets`, `enableBars`, `enableShips`
- Capacity: `initialCapacity`, `maxCapacity`, `growthFactor`, `warnThreshold`

## Notes & Gotchas

- Lazy imports: GLTFLoader and Rapier are dynamically imported to keep startup
  light on non‑render paths.
- Asset keys: ship prototypes are stored both class‑only and class+team to make
  lookups flexible.
- Capacity growth: instancers reallocate `InstancedMesh`(es), copy matrices and
  attributes, and replace in the scene atomically. Expect a brief CPU spike, no
  visual pop.
- Frustum culling: bullets disable mesh‑level culling because Three’s default
  culling doesn’t consider per‑instance transforms. Ships do coarse culling
  via `cull(camera)` and keep mesh culling enabled.
- Shader patching: ship instancer adds an `instanceColor` attribute and varies
  it into the fragment shader without clobbering existing `onBeforeCompile`.

## Visual Interpolation

The renderer supports smooth visual interpolation between simulation steps to reduce stutter when render FPS > sim TPS (default 60 FPS render vs 10 TPS sim).

- **How it works**: At the start of each sim step (in core/gameState.ts simulateStep), entity prevPos/prevOrientation are captured from current state. In the renderer (threeRenderer.ts updateTransforms), positions are LERPed and orientations SLERPed using alpha = min(1, (state.time - lastSimTime) / fixedDt).

- **Toggle**: Set rendererConfig.enableInterpolation = false to disable and render at exact sim positions (useful for debugging or low-FPS targets).

- **Toggle**: Set `rendererConfig.enableInterpolation = false` (see `src/config/rendererConfig.ts`) to disable and render at exact sim positions (useful for debugging or low-FPS targets).

- **Plan details**: See plan/feature-interpolation-renderer-1.md for implementation phases, types, and validation.

- **Performance**: Minimal overhead; reuses existing transforms. Tested with determinism preserved (unit tests green).

## Key Files

- Loader & Pool
  - `src/core/assetLoader.ts`
  - `src/core/assetPool.ts`
  - `src/core/shipModelLoader.ts`
- Config
  - `src/config/shipModelMap.ts`
  - `src/config/rendererConfig.ts`
- Instancers
  - `src/renderer/bulletInstancer.ts`
  - `src/renderer/healthBarInstancer.ts`
  - `src/renderer/shipInstancer.ts`
- Renderer Integration
  - `src/renderer/threeRenderer.ts`

Related: see also docs/data-flow-diagrams.md for orchestrated render data flows and adapter boundaries.
