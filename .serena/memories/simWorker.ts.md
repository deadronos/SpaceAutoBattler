# simWorker.ts — Web Worker for deterministic physics (Rapier)

Last-Reviewed: 2025-09-15

Role

- Runs deterministic physics simulation using Rapier (WASM) in a Web Worker context.
- Receives ship snapshots from main thread, advances physics by requested steps, and posts back packed transform buffers.

Key responsibilities

- Initialize Rapier with provided seed and world parameters on `init-physics`.
- Maintain internal entity mapping (id -> rigidBody) and a float-packed shared buffer for transforms.
- Process `update-ships` to create/update rigid bodies with positions/velocities from the provided ship snapshot.
- On `step-physics` perform N substeps (configurable) and write transforms to the shared Float32Array, then postMessage the buffer as transferable with `step-physics-done`.
- Emit `collision` messages when contacts occur (used by main thread to spawn effects or damage events).
- Manage resource lifecycle on `dispose` — drop wasm instance and release buffers.

Data conventions

- Transform stride: 11 floats per entity: `id, px, py, pz, qx, qy, qz, qw, vx, vy, vz`
- IDs stored as floats; consumers must convert to integer IDs using Math.round.

Error handling

- Worker returns `error` messages for internal exceptions; main thread should gracefully fallback to in-thread physics if worker fails.

Session notes (2025-09-15): Reviewed worker responsibilities and confirmed message types and buffer stride with `main-simWorker-protocol` memory. Updated last-reviewed date.
