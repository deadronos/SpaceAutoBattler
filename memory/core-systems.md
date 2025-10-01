# Memory — core-systems

File: `src/game/systems.ts`

## Responsibilities

`updateGame(state, delta)` orchestrates the simulation tick in this exact order (verified against source on 2025-09-30):

1. `updateDecisionSystem` — fixed-rate AI V2 scheduler: rebuild blackboard, assign escorts/VIPs, and evaluate a round‑robin intent slice when enabled.
2. `prepareShips` — apply deterministic `AICommand` (heading, thrust, fire gating) or legacy nearest‑enemy steering; perform shield regen and muzzle flash pruning.
3. `updateCarrierLaunchSystem` — handles carrier launch logic (fighters/drones) before turret & motion so spawned entities participate in the same frame.
4. `updateTurrets` — aim & fire turret ECS entities, cooldown handling.
5. `updateMotionSystem` — applies physics-friendly velocity/orientation updates prior to the Rapier step.
6. `advanceProjectiles` — kinematic projectile advancement and TTL management (projectiles are generally advanced prior to the physics step when represented outside Rapier).
7. `physicsWorld.step(eventQueue)` — Rapier integration step.
8. `syncTransforms` — copy Rapier body transforms back to ECS components for renderer consumption.
9. `resolveProjectiles` — resolve projectile impacts, TTL expiry, shield absorption, damage application, and entity destruction queue.
10. `updateExplosions` — advance/expose explosion events for renderer consumption.

## Key Details

- Blackboard derivation and role assignment are done inside `updateDecisionSystem` and its helpers: ally centroids, team posture, nearest-enemy cache, VIP threat mapping (carriers/destroyers considered VIPs).
- The systems module explicitly exports `runDecisionTick` and an internal `__aiTestHooks` object that exposes many scoring/tie-break helpers for deterministic unit tests and the AI scenario harness.
- Motion and intent scoring are written to avoid allocations and reuse shared temporary vectors. Any new intent must follow the same allocation discipline.
- Embedded turrets remain supported as a fallback path, but turret ECS entities are preferred for richer behaviour.

## Testing Hooks & Harness

- `__aiTestHooks` provides deterministic access to scoring, tie-break, LOD computation, command writers, and `prepareShips`/legacy behaviour functions so Vitest suites can directly assert internal decision math without widening the public API.
- The scenario harness (`src/game/aiScenarioHarness.ts`) uses `runDecisionTick` to produce golden logs for regression testing of AI behaviour.

## Performance Considerations

- The nearest-enemy computation is currently O(N²); track `ai.metrics.budgetHits` as an early indicator that spatial partitioning or a BVH/grid may be required for larger entity counts.

Updated: 2025-09-30
