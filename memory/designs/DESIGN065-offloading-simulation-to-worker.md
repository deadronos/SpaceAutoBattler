# Design: Offloading Simulation to Web Worker

**Status:** In Progress
**Date:** 2025-10-29
**Last Updated:** 2025-12-17
**Author:** Jules

## 1. Overview

Currently, the simulation (Rapier3D physics + Miniplex ECS + AI logic) runs on the main thread, sharing time with React and Three.js rendering. To support thousands of active agents without frame drops, we will move the entire simulation loop to a Web Worker.

## 2. Architecture

### 2.1 Split Responsibilities

| **Context**       | **Responsibilities**                                      | **State**                                        |
|-------------------|-----------------------------------------------------------|--------------------------------------------------|
| **Worker Thread** | Physics (Rapier), AI Logic, ECS (Game World), Game Loop   | `GameState` (Canonical Source of Truth)          |
| **Main Thread**   | Rendering (R3F), UI (React), Input Capture, Audio         | `RenderState` (Mirror/Proxy of Game World)       |

### 2.1.1 Repo-Specific Constraints

- The simulation step is currently configured via `state.simulation.step` (default `1 / 20`).
- AI runtime overrides currently flow through `getEffectiveAIConfig()` which reads `globalThis.__spaceAutobattlerUiStore`.
  - In a worker, there is no DOM/Zustand store; the bridge must send UI override values to the worker.
  - The worker will install a lightweight shim at `globalThis.__spaceAutobattlerUiStore = { getState: () => overrides }` so existing AI code keeps working.
- Renderer interpolation uses `state.simulation.lastTickIndex` and `state.simulation.alpha`.
  - In worker mode, the main thread will compute `alpha` locally based on the most recent snapshot time and `state.simulation.lastTickDuration`.

### 2.2 Communication Protocol

We will use a hybrid approach of **SharedArrayBuffer** for high-frequency data and **postMessage** for topology + low-frequency events.

#### Shared Memory (Zero-Copy)

We allocate a `SharedArrayBuffer` with Structure-of-Arrays layout.

Minimum MVP layout:

- `positions`: Float32Array `[x,y,z] * MaxEntities`
- `rotations`: Float32Array `[x,y,z,w] * MaxEntities`
- `scales`: Float32Array `[s] * MaxEntities`
- `shipHp`: Float32Array `[hp] * MaxEntities` (ships only)
- `shipShield`: Float32Array `[shield] * MaxEntities` (ships only)
- `shipThrust`: Float32Array `[thrust] * MaxEntities` (ships only; drives thruster VFX)

Each renderable entity is assigned a stable `slot` index for the lifetime of that entity.

*Note: SharedArrayBuffer requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers (dev server + production hosting).*

Fallback:

- If `crossOriginIsolated` or `SharedArrayBuffer` is unavailable, use `postMessage` snapshots with `Transferable` typed arrays.

#### Message Passing (Events)

- **Init:** Main sends buffers, capacities, seed, and initial UI overrides.
- **Sync:** Worker sends `Snapshot` -> Main every tick (or every N ticks later).
  - `Snapshot` contains:
    - `tick`: Simulation tick index.
    - `created`: List of new entities (ID, kind, slot, initial props).
    - `destroyed`: List of removed entity IDs.
    - `events`: Explosions, progression events, optional debug telemetry.
- **Input:** Main sends `Command` -> Worker.
  - `Command`: `{ type: 'setTarget', shipId: 1, targetId: 2 }` or `{ type: 'pause' }`.

Worker commands must be processed at a deterministic boundary (start of next tick).

### 2.3 The "Mirror World"

The Main Thread will maintain its own Miniplex World (`RenderWorld`).

- When `created` message is received: Create a `RenderEntity` in `RenderWorld`.
  - The `RenderEntity` will hold references to the SharedBuffer indices for that entity.
- When `destroyed` message is received: Remove from `RenderWorld`.
- **Interpolation:** The main thread will update `RenderWorld` transforms from shared buffers on each render frame, and compute `state.simulation.alpha` based on time since the last snapshot.

Implementation detail:

- The mirror entities will *not* contain Rapier `RigidBody` / `Collider` instances. These are worker-only.
- In TypeScript, the mirror entities may carry stubbed `rigidBody/collider` fields to satisfy existing renderer typing, but must not be used on the main thread.

## 3. Rapier Integration

Rapier3D-compat works well in workers.

- **Loading:** The Worker must load the WASM module.
- **Sync:** No need to sync Rapier bodies back to main. We only sync the visual transforms (which we already extract from Rapier in the Sim loop).

Webpack note:

- Web workers load additional split chunks via `importScripts(...)` relative to the worker script URL. If chunk output paths differ between main bundles and async chunks (e.g., `chunkFilename` under `workers/` but shared chunks emitted at the root), the worker may try to load the wrong URL and fail at runtime.
- Practical constraint: worker-friendly chunking requires consistent chunk paths and stable split-chunk names that do not conflict with entry chunk names (Webpack 5 disallows some patterns that older configs tolerated).
- Current approach (2025-12-17): extract Rapier into a dedicated `rapier` split chunk, ensure worker chunk loading resolves to the same output directory as other chunks, and avoid splitChunks rules that attempt to reuse the entry chunk name.

## 4. Input Handling

User interactions (clicks, key presses) occur on the Main Thread.

- UI components dispatch actions.
- A `SimulationBridge` service intercepts these actions and posts them to the Worker.
- Determinism note: The Worker will process inputs at the start of the *next* tick.

## 5. Migration Strategy

1. **Worker Skeleton:** Create the worker, load Rapier, run a dummy loop.
2. **State Separation:** Refactor `createGameState` to be worker-exclusive.
3. **Bridge Implementation:** Create the `SimulationBridge` on Main Thread to handle `SharedArrayBuffer` setup.
4. **Renderer Refactor:** Update `Battlefield.tsx` to use the `RenderWorld` instead of the direct `GameState`.
5. **Input Wiring:** Connect UI controls to the Bridge.

Repo implementation notes:

- Keep the current single-threaded simulation path available behind a feature flag for safety.
- Update the dev server to send COOP/COEP headers so SAB can be exercised locally.

## 6. Risks & Mitigations

- **Serialization Overhead:** Minimizing `postMessage` size is key. Only send topology changes (create/destroy) and events. Use SharedBuffers for continuous data.
- **Headers:** SharedArrayBuffer requires specific headers. Fallback: if headers are missing, fall back to `postMessage` with `Transferable` arrays (Float32Array).
- **Worker Chunk Loading:** Worker entrypoints may need to `importScripts` additional split chunks at runtime; ensure Webpack output paths keep worker chunk URLs resolvable in both dev server and production builds.
- **Interpolation Jitter:** Worker timing might drift. We may need to send "Time" in the shared buffer and perform interpolation on the Main Thread based on Sim Time vs Render Time.
- **AI overrides:** `getEffectiveAIConfig()` expects a UI store on `globalThis`. The bridge must provide worker-side overrides to preserve runtime toggles.
- **Explosion serialization:** `ExplosionEvent.position` is a Three.js `Vector3` and cannot be structured-cloned; worker must serialize explosions into plain numeric payloads.

<!-- End -->
