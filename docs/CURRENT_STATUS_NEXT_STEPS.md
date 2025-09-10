# Current Status and Next Steps

## Current Status (as of 2024-07-29)

The project has a foundational structure for a space auto-battler, with key components implemented and integrated:

- **Core Simulation:**
  - **Physics:** Implemented using Rapier3D, running in a dedicated Web Worker (`src/simWorker.ts`) for off-main-thread performance.
  - **Game State:** Centralized in `GameState` (`src/types/index.ts`), ensuring a single source of truth for all simulation, rendering, and UI data.
  - **Determinism:** Seeded RNG (`src/utils/rng.ts`) is used for reproducible simulation results.
  - **Entity Management:** Ships and other entities are managed within `GameState`, with basic lifecycle (spawn, update, despawn).
  - **AI:** Basic AI behaviors are defined (`src/config/behaviorConfig.ts`) and integrated with batched queries.

- **Rendering:**
  - **3D Rendering:** Uses Three.js (`src/renderer/threeRenderer.ts`) for 3D visualization.
  - **Instanced Rendering:** `ShipInstancer` (`src/renderer/shipInstancer.ts`) is implemented for efficient rendering of multiple ships using `THREE.InstancedMesh`.
  - **GLTF Model Loading:** Basic GLTF loading is in place (`src/core/assetLoader.ts`), but the full pipeline for ship models is pending.
  - **SVG Rasterization:** OffscreenCanvas-based SVG rasterization is implemented in a worker (`src/core/svgRasterWorker.impl.ts`) for efficient UI element rendering.
  - **Feature Guards:** Checks for `OffscreenCanvas` and `createImageBitmap` are in place to ensure environment compatibility.

- **Tooling & Infrastructure:**
  - **Build System:** Webpack is configured for bundling, including worker bundles.
  - **Testing:**
    - Vitest for unit tests.
    - Playwright for end-to-end tests, with a new microbenchmark for ship counts.
  - **Telemetry:** Basic performance telemetry is integrated, accessible via `?debugPerf=1` URL parameter, tracking physics step times, rasterization, and message sizes.
  - \*\*Documentation

## Performance & Instrumentation Tasks

- Track: Investigate and refactor hot loops (AI, camera, projectiles, renderer sync) — https://github.com/deadronos/SpaceAutoBattler/issues/93
- Track: Instrument hotpath meter for frame-time attribution — https://github.com/deadronos/SpaceAutoBattler/issues/94
