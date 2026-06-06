# Memory — core-systems

File: `src/game/systems.ts`, `src/game/systems/pipeline.ts`, and `src/game/systems/*`

## Responsibilities

The simulation tick is split into two declarative arrays defined in `src/game/systems.ts`:

- `SIMULATION_PIPELINE` — pre-physics subsystems executed in order
- `POST_PHYSICS_PIPELINE` — subsystems that depend on the Rapier step result

Adding a new system means inserting a `{ name, fn }` entry into the appropriate array — no need to touch `updateGame` itself.

The pipeline infrastructure lives in `src/game/systems/pipeline.ts`:

- `createMeasurementRunner(state)` → returns a `(name, fn) => void` closure that wraps subsystem execution with optional error guards and profiling
- `executePipeline(steps, state, delta, runner)` → iterates the step array feeding each through the runner
- `stepPhysics(state, timings)` → Rapier integration with timing recording and panic rethrow

The current ordering (verified in source) is:

**Pre-physics (`SIMULATION_PIPELINE`):**

1. `updateDecisionSystem` / `runDecisionTick` — rebuilds the blackboard, assigns escorts/VIPs, and runs a round‑robin decision slice for AI v2 when enabled.
2. `prepareShips` — applies AI or legacy commands, prunes muzzle flashes, runs shield regen and progression-related per-ship accounting.
3. `updateCarrierLaunchSystem` — schedules carrier fighter spawns via the deferred mutation queue so spawned fighters appear deterministically after the carrier loop.
4. `updateTurrets` — updates turret ECS entities, aiming logic, and cooldowns; turret entity lifecycle is registered via `registerTurret`.
5. `updateMotionSystem` — computes velocities and applies kinematic updates (using safe setter wrappers when appropriate) before the Rapier step.
6. `advanceProjectiles` — advances non-physics projectiles; projectiles backed by Rapier typically get advanced by the physics step and reconciled after.

Then: `flushDeferredMutations` → `stepPhysics` → `flushPostPhysicsMutations`

**Post-physics (`POST_PHYSICS_PIPELINE`):**

7. `syncTransforms` — copy Rapier transforms back to ECS components for renderer consumption.
8. `resolveProjectiles` — apply projectile impacts, shield interactions, damage application, and enqueue any resultant entity removals.
9. `updateExplosions` — advance explosion events for renderer consumption.

## Key details

- The decision system exports `runDecisionTick` to support harnesses and deterministic unit tests. There is also an internal test surface `__aiTestHooks` that exposes scoring, tie-break helpers, and other evaluators for fine-grained assertions in Vitest.
- The loop supports optional per-subsystem profiling via `state.simulation.profileSubsystems` (sampled every `profileSampleRate` ticks) and stores durations in `state.simulation.subsystemTimings.durations`.
- When `state.simulation.enableSubsystemGuards` is enabled, each subsystem runs behind a try/catch wrapper that records diagnostics (via `recordSubsystemFailure`) and continues the tick.
- Motion code favors application of velocities to physics using shared temp vectors and safe enqueue paths to avoid Rapier guard errors.
- Carrier launch scheduling and other world mutation tasks are intentionally enqueued to deferred queues so Rapier sees consistent, non-overlapping modifications.

## Testing hooks & harness

- `__aiTestHooks` and exported `runDecisionTick` are used by the test-only harness (`test/support/aiScenarioHarness.ts`) to produce deterministic logs and KPI snapshots for golden fixtures.
- Unit tests call small system functions directly (e.g., `prepareShips`, `advanceProjectiles`) with a test `GameState` to isolate behaviors without spinning the full step loop.

## Performance considerations

- Systems avoid per-frame allocations; reuse pooled vectors and objects in hot loops.
- The nearest-enemy computation is currently O(N²) and the AI metrics surface includes indicators when budget thresholds are breached (`ai.metrics.budgetHits`). Consider spatial partitioning if entity counts increase.

References

- `src/game/systems.ts`, `src/game/systems/*`, `src/game/systems/decision/*`
