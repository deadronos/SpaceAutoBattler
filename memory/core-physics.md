# Memory — core-physics

Files: `src/game/state.ts`, `src/game/simulationQueue.ts`, `src/game/physics/*`

Summary

- The project integrates Rapier3D for deterministic physics on the main thread. The physics world is created inside `createGameState()` and stepped from the simulation loop.

Primary responsibilities

- Rapier initialization
  - `createGameState()` calls `await Rapier.init({})`, constructs a new `Rapier.World()`, and an `EventQueue` with `{ auto: true }`.
  - The Rapier world instance (`state.physicsWorld`) and `state.eventQueue` are used by systems and are accessible for tests and debug tooling.

- Safe mutation and deferred queues
  - Rapier and the systems code avoid mutating the physics world during iteration by staging changes into two queues on `state.simulation`:
    - `deferredMutations` — operations that must run before the physics step flush point.
    - `postStepMutations` — operations that must run immediately after the physics step completes.
  - Utilities in `src/game/simulationQueue.ts` provide `enqueueDeferredMutation`, `enqueuePostPhysicsMutation`, `flushDeferredMutations`, and `flushPostPhysicsMutations`. These functions throw early with helpful errors if the `state.simulation` structure is absent (useful in tests to ensure a SimulationClock is present).

- Safe kinematics helpers
  - The `src/game/physics/safeKinematics.ts` module exposes helper wrappers such as `deferSetNextKinematicTranslation`, `postSetNextKinematicTranslation`, `deferSetLinvel`, and others that enqueue safe setters on the appropriate queue, protecting against disposed rigid bodies and Rapier guard trips.
  - When improper use occurs (missing simulation clock, missing postStepMutations array), these functions throw with explicit messages instructing test authors to initialise a SimulationClock (e.g., via `createTestGameState`).

- Diagnostics and guard recording
  - Rapier-related exceptional conditions (step panics, guard trips, deferred mutation failures) are recorded on `state.simulation.rapierDiagnostics` by helpers in `simulationQueue.ts`.
  - `recordRapierStepPanic`, `recordRapierGuardTrip`, and `recordDeferredFailure` centralize diagnostic bookkeeping and are invoked wherever Rapier interactions are wrapped.

Integration patterns

- Systems that need to spawn/destroy entities after a physics iteration should enqueue their operations into the post-step queue instead of performing immediate Rapier body/collider mutations.
- Kinematic updates (positioning/rotation) that were previously direct writes now go through safe setter wrappers when called from systems that might run during a Rapier step.

Testing guidance

- To run deterministic physics tests, create a test-ready `GameState` with a populated `simulation` clock (or use `createTestGameState` helpers if available). This ensures the deferred queues exist and kinematic setters will enqueue rather than throw.
- Tests that reproduce Rapier step panics should assert that `rapierDiagnostics` gets updated and that post-step flushes clear mutation arrays.

Performance notes

- Avoid per-frame allocation for transient physics computations; share temporary `Vector3`/`Quaternion` objects and prefer pooled rigid-body reuse when possible.
- Drive heavy mutation operations through the deferred queue to keep the step loop lean and deterministic.

References

- `src/game/state.ts`, `src/game/simulationQueue.ts`, `src/game/physics/safeKinematics.ts`, `src/game/systems.ts`

Updated: 2025-09-30
