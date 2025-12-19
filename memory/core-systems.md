# Memory — core-systems

File: `src/game/systems.ts` and `src/game/systems/*`

## Responsibilities

`updateGame(state, delta)` orchestrates the simulation tick. The current ordering (verified in source) is:

1. `updateDecisionSystem` / `runDecisionTick` — rebuilds the blackboard, assigns escorts/VIPs, and runs a round‑robin decision slice for AI v2 when enabled.
2. `prepareShips` — applies AI or legacy commands, prunes muzzle flashes, runs shield regen and progression-related per-ship accounting.
3. `updateCarrierLaunchSystem` — schedules carrier fighter spawns via the deferred mutation queue so spawned fighters appear deterministically after the carrier loop.
4. `updateTurrets` — updates turret ECS entities, aiming logic, and cooldowns; turret entity lifecycle is registered via `registerTurret`.
5. `updateMotionSystem` — computes velocities and applies kinematic updates (using safe setter wrappers when appropriate) before the Rapier step.
6. `advanceProjectiles` — advances non-physics projectiles; projectiles backed by Rapier typically get advanced by the physics step and reconciled after.
7. `flushDeferredMutations` — executes queued pre-step mutations that must happen immediately before the physics step.
8. `physicsWorld.step()` — Rapier integration step. The `EventQueue({ auto: true })` is managed internally by Rapier, so the loop intentionally does not pass the queue to `step()`.
9. `flushPostPhysicsMutations` — run any post-step staged operations (spawns, disposals) and clear queues.
10. `syncTransforms` — copy Rapier transforms back to ECS components for renderer consumption.
11. `resolveProjectiles` — apply projectile impacts, shield interactions, damage application, and enqueue any resultant entity removals.
12. `updateExplosions` — advance explosion events for renderer consumption.

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
