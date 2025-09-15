# main-simWorker-protocol — Sim worker messaging protocol

Last-Reviewed: 2025-09-15

This memory describes the message protocol used between `src/main.ts` (main thread) and `src/simWorker.ts` (physics worker).

Overview

- The worker uses a simple, JSON-friendly message envelope with `type` and `payload` fields. Transferable objects (Float32Array, ArrayBuffer) are used for high-frequency data.

Message types (main -> worker)

- `init-physics` {payload: {timestep, gravity, worldBounds, seed}} -> Initialize rapier instance and internal world state.
- `update-ships` {payload: {shipsFloatArray}} -> Replace the current ship state snapshot in the worker (positions, velocities, orientations, IDs). shipsFloatArray is transferable.
- `step-physics` {payload: {dt, numSteps}} -> Perform simulation steps (numSteps can be 0..N) and return transform buffer.
- `apply-force` {payload: {id, fx, fy, fz}} -> Apply impulse/force to a single body; used for special effects or commands.
- `add-colliders` {payload: {collidersDefinition}} -> Add additional colliders for terrain or persistent fixtures.
- `dispose` {payload: {}} -> Clean up and release wasm resources.

Message types (worker -> main)

- `init-done` {payload: {worldInfo}} -> Worker ready.
- `step-physics-done` {payload: {transformsBuffer}} -> Packed Float32Array with transforms: `id, px, py, pz, qx, qy, qz, qw, vx, vy, vz` per-entity. The buffer is transferable.
- `collision` {payload: {idA, idB, contactPoint}} -> Event notification for collision handling.
- `log` {payload: {level, message}} -> Forwarded logs.
- `error` {payload: {message, code}} -> Worker-side errors.

Buffer packing conventions

- Transform stride = 11 floats per entity. Index mapping: 0:id, 1..3:position, 4..7:quaternion, 8..10:velocity.
- IDs are stored as float cast of 32-bit unsigned ints to keep buffers compact. The main thread must round IDs when reading.

Performance & transfer hints

- Use single shared Float32Array per-step and `postMessage` with that array's buffer as transferable to avoid copying.
- Keep message types minimal; prefer `step-physics` to include all work rather than many small per-entity messages.
- When high-frequency debug data is required, use a parallel `debug` channel with lower-priority sampling.

Session notes (2025-09-15): Reviewed and updated Last-Reviewed. Verified stride and message types match current `simWorker.ts` behavior.
