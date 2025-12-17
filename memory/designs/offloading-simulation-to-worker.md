# Design: Offloading Simulation to Web Worker

**Status:** Draft
**Date:** 2025-10-29
**Author:** Jules

## 1. Overview
Currently, the simulation (Rapier3D physics + Miniplex ECS + AI logic) runs on the main thread, sharing time with React and Three.js rendering. To support thousands of active agents without frame drops, we will move the entire simulation loop to a Web Worker.

## 2. Architecture

### 2.1 Split Responsibilities

| **Context**       | **Responsibilities**                                      | **State**                                        |
|-------------------|-----------------------------------------------------------|--------------------------------------------------|
| **Worker Thread** | Physics (Rapier), AI Logic, ECS (Game World), Game Loop   | `GameState` (Canonical Source of Truth)          |
| **Main Thread**   | Rendering (R3F), UI (React), Input Capture, Audio         | `RenderState` (Mirror/Proxy of Game World)       |

### 2.2 Communication Protocol
We will use a hybrid approach of **SharedArrayBuffer** for high-frequency transform data and **postMessage** for structural changes and events.

#### Shared Memory (Zero-Copy)
We allocate a `SharedArrayBuffer` for entity transforms.
Structure:
- `PositionBuffer`: Float32Array (x, y, z) * MaxEntities
- `RotationBuffer`: Float32Array (x, y, z, w) * MaxEntities
- `StatusBuffer`: Uint8Array (Active, Shield%, HP%) * MaxEntities

*Note: This requires the server to send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers.*

#### Message Passing (Events)
- **Init:** Main sends Config/Seeds -> Worker.
- **Sync:** Worker sends `Snapshot` -> Main (every tick or every N ticks).
  - `Snapshot` contains:
    - `tick`: Simulation tick index.
    - `created`: List of new entities (ID, Type, Initial Props).
    - `destroyed`: List of removed entity IDs.
    - `events`: Explosions, Audio cues, Progression events.
- **Input:** Main sends `Command` -> Worker.
  - `Command`: `{ type: 'setTarget', shipId: 1, targetId: 2 }` or `{ type: 'pause' }`.

### 2.3 The "Mirror World"
The Main Thread will maintain its own Miniplex World (`RenderWorld`).
- When `created` message is received: Create a `RenderEntity` in `RenderWorld`.
  - The `RenderEntity` will hold references to the SharedBuffer indices for that entity.
- When `destroyed` message is received: Remove from `RenderWorld`.
- **Interpolation:** The Renderer will read from the SharedBuffer. Since the Worker might tick faster/slower than the frame rate, we might need double buffering or just read the latest state. For now, reading the latest state + `useShipInterpolation` (adapted) should suffice.

## 3. Rapier Integration
Rapier3D-compat works well in workers.
- **Loading:** The Worker must load the WASM module.
- **Sync:** No need to sync Rapier bodies back to main. We only sync the visual transforms (which we already extract from Rapier in the Sim loop).

## 4. Input Handling
User interactions (clicks, key presses) occur on the Main Thread.
- UI components dispatch actions.
- A `SimulationBridge` service intercepts these actions and posts them to the Worker.
- Determinism note: The Worker will process inputs at the start of the *next* tick.

## 5. Migration Strategy
1.  **Worker Skeleton:** Create the worker, load Rapier, run a dummy loop.
2.  **State Separation:** Refactor `createGameState` to be worker-exclusive.
3.  **Bridge Implementation:** Create the `SimulationBridge` on Main Thread to handle `SharedArrayBuffer` setup.
4.  **Renderer Refactor:** Update `Battlefield.tsx` to use the `RenderWorld` instead of the direct `GameState`.
5.  **Input Wiring:** Connect UI controls to the Bridge.

## 6. Risks & Mitigations
- **Serialization Overhead:** Minimizing `postMessage` size is key. Only send topology changes (create/destroy) and events. Use SharedBuffers for continuous data.
- **Headers:** SharedArrayBuffer requires specific headers.
  - *Fallback:* If headers are missing, fall back to `postMessage` with `Transferable` arrays (Float32Array).
- **Interpolation Jitter:** Worker timing might drift. We may need to send "Time" in the shared buffer and perform interpolation on the Main Thread based on Sim Time vs Render Time.
