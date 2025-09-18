# main-simWorker-protocol — Sim worker messaging protocol

Last-Reviewed: 2025-09-15

This memory describes the message protocol used between `src/main.ts` (main thread) and `src/simWorker.ts` (physics and AI worker).

Overview

- The worker uses a simple, JSON-friendly message envelope with `type` and `payload` fields. Transferable objects (Float32Array, ArrayBuffer) are used for high-frequency data.
- As of 2025, the worker now handles both physics simulation AND AI processing for improved performance and deterministic execution.

Message types (main -> worker)

**Physics Messages:**
- `init-physics` {payload: {timestep, gravity, worldBounds, seed}} -> Initialize rapier instance and internal world state.
- `update-ships` {payload: {shipsFloatArray}} -> Replace the current ship state snapshot in the worker (positions, velocities, orientations, IDs). shipsFloatArray is transferable.
- `step-physics` {payload: {dt, numSteps}} -> Perform simulation steps (numSteps can be 0..N) and return transform buffer.
- `apply-force` {payload: {id, fx, fy, fz}} -> Apply impulse/force to a single body; used for special effects or commands.
- `add-colliders` {payload: {collidersDefinition}} -> Add additional colliders for terrain or persistent fixtures.
- `dispose-physics` {payload: {}} -> Clean up and release physics resources.

**AI Messages (NEW):**
- `init-ai` {payload: {simConfig, behaviorConfig}} -> Initialize AI systems (AIController, SpatialGrid, AggressiveSpatialOptimizer) in worker.
- `step-ai` {payload: {dt, shipsBuffer, bulletsBuffer, behaviorConfig, tick}} -> Process AI decisions for all ships. Data is packed in transferable Float32Arrays.
- `dispose-ai` {payload: {}} -> Clean up AI systems.

Message types (worker -> main)

**Physics Messages:**
- `init-physics-done` {payload: {ok: boolean}} -> Physics worker ready.
- `step-physics-done` {payload: {transformsBuffer, bulletEvents}} -> Packed Float32Array with transforms: `id, px, py, pz, qx, qy, qz, qw, vx, vy, vz` per-entity. The buffer is transferable.
- `collision` {payload: {idA, idB, contactPoint}} -> Event notification for collision handling.
- `dispose-physics-done` {payload: {}} -> Physics cleanup complete.

**AI Messages (NEW):**
- `init-ai-done` {payload: {ok: boolean, error?: string}} -> AI worker ready or initialization failed.
- `step-ai-done` {payload: {aiResultsBuffer, shipCount}} -> AI decisions packed in transferable Float32Array with ship targeting updates.
- `step-ai-error` {payload: {error: string}} -> AI processing error.
- `dispose-ai-done` {payload: {}} -> AI cleanup complete.

**General Messages:**
- `log` {payload: {level, message}} -> Forwarded logs.
- `error` {payload: {message, code}} -> Worker-side errors.
- `perf` {payload: {name, ms}} -> Performance metrics from worker.

Buffer packing conventions

**Physics Transform Buffer:**
- Transform stride = 11 floats per entity. Index mapping: 0:id, 1..3:position, 4..7:quaternion, 8..10:velocity.
- IDs are stored as float cast of 32-bit unsigned ints to keep buffers compact. The main thread must round IDs when reading.

**AI Data Buffers:**
- Ships input: [id, px, py, pz, vx, vy, vz, health, targetId, team, class] (11 floats per ship)
- Bullets input: [id, px, py, pz, vx, vy, vz, ttl, damage, ownerShipId, ownerTeam] (11 floats per bullet)
- AI results: [id, targetId, aiStateFlag] (3 floats per ship) where targetId = -1 for null

Performance & transfer hints

- Use single shared Float32Array per-step and `postMessage` with that array's buffer as transferable to avoid copying.
- Keep message types minimal; prefer `step-physics` and `step-ai` to include all work rather than many small per-entity messages.
- When high-frequency debug data is required, use a parallel `debug` channel with lower-priority sampling.
- AI worker mode can be disabled via RendererConfig.useAIWorker flag for testing or fallback scenarios.

Configuration

The AI worker mode is controlled by two flags in RendererConfig:
- `useSimWorker`: Whether to use the worker for physics (existing flag)
- `useAIWorker`: Whether to use the worker for AI processing (new flag, requires useSimWorker=true)

When useAIWorker=false or worker fails, the system gracefully falls back to direct AIController execution in the main thread.

Session notes (2025-09-15): Added AI worker integration. Both physics and AI now run in the same worker thread for improved performance and reduced main thread load. Deterministic behavior is preserved through seeded RNG usage.
