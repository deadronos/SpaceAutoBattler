# simWorker.ts — Physics worker (Rapier) overview

Last-Reviewed: 2025-09-07

This memory summarizes `src/simWorker.ts` and its responsibilities.

Purpose

- Runs Rapier physics inside a dedicated Web Worker. Receives ship data from the main thread, steps the physics world, and returns transforms back to the main thread.

Key behaviors

- Dynamically imports `@dimforge/rapier3d-compat` inside the worker to load WASM only when needed.
- Normalizes Rapier export shapes (default export vs named exports) and attempts to construct or call `World` in a robust way.
- Maintains a `world` instance and a `bodies` Map mapping shipId to Rapier rigid bodies.
- Supports messages:
  - `init-physics`: initializes Rapier/world and replies with `init-physics-done` and ok status.
  - `update-ships`: accepts a packed Float32Array of ships (id, px, py, pz, vx, vy, vz) and creates/updates rigid bodies accordingly; removes bodies for ships that no longer exist.
  - `step-physics`: steps the physics world using provided dt, collects transforms from bodies and posts `step-physics-done` with `transforms` (array of { shipId,pos,vel }). Adds optional perf events when debug enabled.
  - `dispose-physics`: frees world and clears bodies.
- Uses defensive coding to support multiple Rapier API shapes (RigidBodyDesc, ColliderDesc, factory vs constructor) and to avoid throwing errors that would kill the worker.
- Posts performance events back to main thread when worker URL contains `debugPerf=1`.

Integration points

- Main thread expects `step-physics-done` responses; it may also send/receive packed Float32Array buffers for efficient transfer in some code paths.
- Worker sets `__webpack_public_path__` at runtime to ensure dynamic chunk loads resolve relative to worker location (fixes webpack chunk paths in worker context).

When to update

- Update when message shape changes, the packing format (Float32Array layout) changes, or Rapier integration details are altered.

Generated on 2025-09-07 by GitHub Copilot agent.
