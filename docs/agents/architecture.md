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
- Keep simulation state and rendering decoupled via ECS (Miniplex) and `GameState`.

## Assets, Decoders & Rendering Subsystems

- **glTF & decoders**: Models are cached via `@react-three/drei`’s `useGLTF`. Draco/Meshopt/KTX2 decoding is configured in `src/renderer/loaders/gltfDecoders.ts`; self-hosted decoder assets are emitted under `dist/decoders/` by `vite.config.ts`, and hull GLTFs are shipped compressed.
- **Disposal & pooling**: Dispose Three.js resources you create; reuse/pool objects in per-frame hot paths (`src/utils/tempVectors.ts`, `src/game/explosions.ts`).
- **Quality & postprocessing**: Quality presets live in `src/config/quality.ts`. Postprocessing lives in `src/config/postprocessing.ts` (`colorPipeline` + `N8AO`).
- **Camera rig**: Pure trauma/shake math lives in `src/renderer/cameraRig/`, consumed by `src/components/CameraRig.tsx`.

## Further Reference

- Detailed `src/` file inventory: `spec/src-structure.md` (note: check against actual files if recently refactored).
