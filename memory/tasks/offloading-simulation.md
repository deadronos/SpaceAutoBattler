# Tasks: Offloading Simulation to Web Worker

**Status:** Planned
**Design:** `memory/designs/offloading-simulation-to-worker.md`

## Phase 1: Infrastructure & Worker Setup
- [ ] **Create Worker Entry Point**: Create `src/worker/sim.worker.ts`.
- [ ] **Load Rapier in Worker**: Ensure `@dimforge/rapier3d-compat` loads correctly in the worker context.
- [ ] **Setup Build**: Update `webpack.config.mjs` (or Vite config) to handle the worker file (likely using `worker-loader` or native Webpack 5 support).
- [ ] **Basic Loop**: Implement a basic `setInterval` or `requestAnimationFrame` (in worker) loop that calls a dummy update.

## Phase 2: State Bridge & Shared Memory
- [ ] **Define Protocol**: Create `src/worker/protocol.ts` defining `WorkerMessage` and `MainMessage` types.
- [ ] **Shared Memory Manager**: Create a class to manage `SharedArrayBuffer` allocation and layout (Structure of Arrays).
- [ ] **SimulationBridge**: Create `src/game/SimulationBridge.ts` on Main Thread.
  - Handles worker instantiation.
  - Receives snapshots.
  - Updates local "Mirror World".
- [ ] **Worker GameState**: Move `createGameState` usage to the worker. Ensure `state.physicsWorld` is created there.

## Phase 3: Synchronization Logic
- [ ] **Topology Sync**: Implement logic in Worker to track created/destroyed entities each tick and send diffs.
- [ ] **Transform Sync**: Modify `src/game/systems/sync.ts` (or similar) to write `position/rotation` to the `SharedArrayBuffer` instead of just mutating local objects.
- [ ] **Event Sync**: Serialize `state.explosions` and `state.progressionEvents` and send via `postMessage`.

## Phase 4: Renderer Adaptation
- [ ] **RenderWorld**: Create a Miniplex world on Main Thread that acts as the visual source of truth.
- [ ] **Refactor Hooks**: Update `useGameContext` or create `useSimulationBridge` to provide access to the `RenderWorld`.
- [ ] **Update Components**:
  - `Ship.tsx`: Read transform from the "Mirror Entity" (which reads from SharedBuffer).
  - `Battlefield.tsx`: Ensure it mounts the `SimulationBridge`.
- [ ] **Remove Logic**: Remove `BattlefieldSystems.tsx` (the main thread simulation loop) as it's now in the worker.

## Phase 5: Input & Polish
- [ ] **Input Tunneling**: Connect `Controls.tsx` and keyboard handlers to send commands to the Worker.
- [ ] **Resize Handling**: Sync canvas resize/aspect ratio events to worker (if needed for camera logic, though camera is usually Main Thread).
- [ ] **Headers Config**: Ensure dev server sends `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`.
- [ ] **Fallback**: Implement a fallback mode if `SharedArrayBuffer` is not supported (optional but recommended).
