# Tasks: Offloading Simulation to Web Worker

**Status:** In Progress
**Design:** `memory/designs/DESIGN065-offloading-simulation-to-worker.md`

## Requirements (EARS)

- WHEN the user enables worker simulation mode, THE SYSTEM SHALL run the canonical simulation loop inside a Web Worker while keeping rendering and UI on the main thread.
- WHEN a simulation snapshot is received, THE SYSTEM SHALL update the render-side mirror state and compute `state.simulation.alpha` locally for interpolation.
- WHEN runtime AI override flags change in the UI, THE SYSTEM SHALL forward those overrides to the worker and preserve `getEffectiveAIConfig()` behavior via a worker-side UI store shim.
- WHEN `SharedArrayBuffer` is unavailable, THE SYSTEM SHALL fall back to `postMessage` snapshots using transferable typed arrays.

## Repo-Specific Constraints

- Determinism and runtime state must remain aligned with the canonical `GameState` type in `src/types/index.ts`.
- Renderer systems and hooks rely on `state.simulation.lastTickIndex` and `state.simulation.alpha` for interpolation.
- `ExplosionEvent.position` currently uses Three.js `Vector3` (non-cloneable); worker-to-main payloads must serialize explosions as plain numbers.
- SharedArrayBuffer requires COOP/COEP headers; dev server and production hosting must support `crossOriginIsolated`.
- Webpack has special bundling rules for `@dimforge/rapier3d-compat`; worker entry/import strategy must respect Rapier WASM initialization ordering.

## Phase 1: Infrastructure & Worker Setup

- [x] **Create Worker Entry Point**: Create `src/worker/simulation.worker.ts`.
- [x] **Load Rapier in Worker**: Ensure `@dimforge/rapier3d-compat` loads correctly in the worker context.
- [x] **Basic Loop**: Implement a basic fixed-step loop (worker) that can tick and respond to pings.
- [x] **Worker UI Store Shim**: Install `globalThis.__spaceAutobattlerUiStore` in the worker so `getEffectiveAIConfig()` can read overrides.

## Phase 2: State Bridge & Shared Memory

- [x] **Define Protocol**: Create `src/worker/protocol.ts` defining `WorkerMessage` and `MainMessage` types.
- [x] **Shared Memory Layout (MVP)**: Define a Structure-of-Arrays layout and allocate a single packed buffer (SAB when available; transferable buffers otherwise).
- [x] **SimulationBridge**: Create `src/game/SimulationBridge.ts` on Main Thread.
  - Handles worker instantiation.
  - Receives snapshots.
  - Updates local "Mirror World".
- [x] **Feature Flag / Smoke Toggle**: Gate worker creation behind a URL flag (ex: `?sim_worker=1`) until full parity is reached.
- [x] **Worker GameState**: Move `createGameState` usage to the worker. Ensure `state.physicsWorld` is created there.

## Phase 3: Synchronization Logic

- [x] **Topology Sync (MVP ships)**: Track created/destroyed ship entity ids and send diffs in `snapshot` messages.
- [x] **Transform Sync (MVP ships)**: Write ship transforms + basic ship scalars into the shared/transfer buffer each tick.
- [ ] **Event Sync**: Serialize `state.explosions` and `state.progressionEvents` and send via `postMessage` (no Three.js objects).

## Phase 3.5: Worker-Driven Render MVP

- [x] **WorkerShipsLayer (Debug Visuals)**: Render worker-driven ships as lightweight instanced markers (cones) behind `?sim_worker_render=1`.
- [x] **Render-Only Mode**: Add `?sim_worker_render_only=1` to disable the main-thread sim tick and hide main ship/combat layers so the scene is visually driven by worker snapshots.

Notes:

- This is intentionally a debug/MVP rendering path. The long-term goal remains a proper `RenderWorld` mirror that feeds the existing ship/LOD/interpolation pipeline.
- Production worker support required Webpack chunk-loading fixes so the worker can `importScripts` split chunks.

## Phase 4: Renderer Adaptation

- [ ] **RenderWorld**: Create a Miniplex world on Main Thread that acts as the visual source of truth.
- [ ] **Refactor Hooks**: Update `useGameContext` or create `useSimulationBridge` to provide access to the `RenderWorld`.
- [ ] **Update Components**:
  - `Ship.tsx`: Read transform from the "Mirror Entity" (which reads from SharedBuffer).
  - `Battlefield.tsx`: Ensure it mounts the `SimulationBridge`.
- [ ] **Remove Logic**: Remove `BattlefieldSystems.tsx` (the main thread simulation loop) once parity is reached (currently gated off behind `?sim_worker_render_only=1`).

## Phase 5: Input & Polish

- [ ] **Input Tunneling**: Connect `Controls.tsx` and keyboard handlers to send commands to the Worker.
- [ ] **Resize Handling**: Sync canvas resize/aspect ratio events to worker (if needed for camera logic, though camera is usually Main Thread).
- [ ] **Headers Config**: Ensure dev server sends `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`.
- [ ] **Fallback**: Implement a fallback mode if `SharedArrayBuffer` is not supported (optional but recommended).

## Validation

- Unit + type: `npm run typecheck`, `npm test`
- Build: `npm run build`
- E2E (worker): `npx playwright test test/playwright/worker-sim.spec.ts`

## Progress Log

### 2025-12-17

- Added worker-driven ship rendering MVP and a render-only flag to disable main-thread ticking.
- Fixed production Webpack chunking so the worker can load split chunks (notably Rapier) without `importScripts` 404s.
- Hardened Playwright worker E2E by fixing `waitForFunction` usage and exposing worker status/error for diagnostics.
