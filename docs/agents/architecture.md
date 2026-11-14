# Architecture & Engine Integration

## Repository Layout

- `src/` — TypeScript application source:
  - `src/app/` — App-level React context and UI Zustand store (`uiStore.ts`)
  - `src/components/` — R3F scene components, HUD, and overlays
  - `src/config/` — Gameplay, quality, postprocessing, and renderer configs
  - `src/game/` — Simulation state, ECS systems, physics, and worker bridge
  - `src/renderer/` — Material registries, loaders/decoders, shaders, camera rig math
  - `src/types/` — Canonical shared TypeScript contracts (`src/types/index.ts`)
  - `src/utils/` — Pure helpers (`rng.ts`, `math.ts`, `tempVectors.ts`, etc.)
  - `src/worker/` — Web Worker simulation host and snapshot emitter
- `test/` — Unit specs (`test/vitest/`, `test/components/`, `test/utils/`, etc.) and Playwright E2E (`test/playwright/`).
- `dist/` — Generated build output (never edit by hand).
- Nested `AGENTS.md` files exist inside major `src/` subdirectories (e.g., `src/game/AGENTS.md`, `src/components/AGENTS.md`, `src/renderer/AGENTS.md`, `src/types/AGENTS.md`) and `test/support/aiScenarioHarness/AGENTS.md` for local rules.

## Hard Boundaries

- Never modify `dist/` artifacts unless explicitly asked.
- Represent runtime state in `GameState` (`src/types/index.ts`); avoid module-level mutable state.
- Import shared contracts from `src/types/index.ts` rather than creating ad-hoc duplicates.
- Use `state.rng` / `src/utils/rng.ts` for all simulation and AI randomness.

## R3F + Rapier3D Update Loop

- By default, Rapier3D runs on the main thread and is stepped from React Three Fiber’s `useFrame`.
- **Worker simulation mode** offloads Rapier + ECS stepping to a Web Worker (`src/worker/simulation.worker.ts`, `src/game/SimulationBridge.ts`), controlled by query flags in `src/game/simulationFeatureFlags.ts`:
  - `?sim_worker` — Enables worker simulation alongside main-thread rendering.
  - `?sim_worker_render` — Enables worker simulation and worker-driven ship rendering.
  - `?sim_worker_render_only` — Renders worker ships only (disables local simulation).
  - `?sim_worker_debug` — Enables worker debug logging.
  - In shared mode, the worker publishes one of two transform pages with an atomic ownership flag. The bridge holds that page until the next snapshot arrives, and the worker skips publication when both pages are held. In transfer mode, staging buffers carry only updated occupied slots and are recycled when replaced. The worker ship layer updates matrices once per snapshot tick and defaults to the bridge capacity of 4096.
- Keep simulation state and rendering decoupled via ECS (Miniplex) and `GameState`.
- Shield bubbles stay mounted and update visibility, opacity, ripple uniforms, and hull tint directly from simulation data. Ripple uniforms are repacked when the queue or shader material changes.
- The HUD health collector projects ships and publishes DOM overlay snapshots at up to 30 Hz while enabled. Individual overlays skip React renders when their displayed inputs match.
- Ship and turret kinematic transforms are snapshotted into a per-state numeric batch and applied in enqueue order before Rapier steps. Collision queries reuse per-state buffers while preserving cell traversal order.
- The sensor broadphase rounds adaptive cell sizes to 10-unit steps. Turret targeting indexes ships and interceptable projectiles, and resolves ties in ECS query order. Projectile damage builds the reverse AI target index at the first kill in each collision pass.

## Assets, Decoders & Rendering Subsystems

- **glTF & decoders**: Models are cached via `@react-three/drei`’s `useGLTF`. Draco/Meshopt/KTX2 decoding is configured in `src/renderer/loaders/gltfDecoders.ts`; self-hosted decoder assets are emitted under `dist/decoders/` by `vite.config.ts`, and hull GLTFs are shipped compressed.
- **Instanced effects**: Explosion, thruster glow, and ship impostor layers update mesh bounds while writing live transforms so Three.js can cull offscreen batches. Explosion lights use a pool of eight, ranked by intensity and camera distance. Turret gizmos mount only when their debug flag is enabled.
- **Planet and star textures**: Full-resolution Ice and Gas Giant maps ship as WebP, with existing low-resolution PNG maps for fallback. Regenerate the lossless star organic WebP and RGBA noise PNG with `node scripts/generate_star_disk_textures.mjs` and `cwebp` installed on PATH.
- **Disposal & pooling**: Dispose Three.js resources you create; reuse/pool objects in per-frame hot paths (`src/utils/tempVectors.ts`, `src/game/explosions.ts`).
- **Quality & postprocessing**: Quality presets live in `src/config/quality.ts`. Postprocessing lives in `src/config/postprocessing.ts` (`colorPipeline` + `N8AO`).
- **Camera rig**: Pure trauma/shake math lives in `src/renderer/cameraRig/`, consumed by `src/components/CameraRig.tsx`.

## Further Reference

- Detailed `src/` file inventory: `spec/src-structure.md` (note: check against actual files if recently refactored).
