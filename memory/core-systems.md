# Memory — core-systems

File: `src/game/systems.ts`

## Responsibilities

`updateGame(state, delta)` orchestrates the simulation tick in this exact order (verified against source on 2025-09-24):

1. `updateDecisionSystem` — fixed-rate AI V2 scheduler: rebuild blackboard, assign escorts/VIPs, evaluate round‑robin intent slice when enabled.
2. `prepareShips` — apply deterministic `AICommand` (heading, thrust, fire gating) or legacy nearest‑enemy steering; shield regen, muzzle flash pruning, embedded turret firing fallback.
3. `updateCarrierLaunchSystem` — handles carrier launch logic (fighters/drones) before turret & motion so spawned entities participate in same frame.
4. `updateTurrets` — aim & fire turret ECS entities, cooldown handling.
5. `updateMotionSystem` — applies physics-based motion/steering toward commanded heading prior to physics step (ensures Rapier sees updated velocities/orientations once per frame).
6. `advanceProjectiles` — kinematic projectile advancement and world clamp pre-physics (projectiles are not Rapier bodies presently).
7. `physicsWorld.step(eventQueue)` — Rapier integration step.
8. `syncTransforms` — copy Rapier body transforms back onto ECS components for renderer.
9. `resolveProjectiles` — TTL decrement, collision resolution (distance checks), shield absorption, ripple emission, hull damage, entity destruction queue.

## Key Details

- Blackboard derivation: ally centroids, team posture (`aggressive` | `hold` | `retreat`), nearest-enemy cache, VIP threat mapping (carriers/destroyers treated as VIPs) happens inside `refreshBlackboard` invoked by `updateDecisionSystem`.
- Role assignment: `assignTeamRoles` maps escort-profile ships to VIP parent ids deterministically (sorted by id), stored in `ai.assignments.escorts`.
- Intent evaluation: Each ship evaluates candidates (`Attack`, `Kite`, `Escort`, `Intercept`, `Reposition`, `Regroup`, `Flee`) with integer-friendly scores; deterministic tie-break uses ship `traitSeed` hashed with tick index.
- LOD scheduling: `computeLod` returns 0/1/2 -> next think spacing of 1/2/4 AI ticks to throttle evaluation for far/low-priority ships.
- Motion: AI heading rotation is rate-limited; `updateMotionSystem` performs gradual turning & thrust acceleration rather than snapping orientation.
- Embedded turrets: When no separate turret ECS entities exist, `runEmbeddedTurrets` supplies a minimal firing path for base ships to keep combat functional.
- Metrics: `ai.metrics` tracks last slice size/decisions/skips and cumulative totals; `budgetHits` increments when not all ships processed in a tick.
- Pools: Hot path reuses shared vectors (`TEMP_DIR`, `TEMP_POS`, etc.) to avoid per-frame allocations.

## Testing Hooks & Harness

- Deterministic hooks (`runDecisionTick`, scorer helpers, `writeCommand`, intercept math helpers, legacy behavior runner) are exported via an internal `__aiTestHooks` object for Vitest suites without widening public APIs.
- Scenario harness (`src/game/aiScenarioHarness.ts`) uses `runDecisionTick` to produce golden logs (escort, intercept, regroup, bomber intercept, artillery retreat) for regression validation.

## Performance Considerations

- Current nearest-enemy computation is O(N²); monitor for >300 ships and consider spatial partitioning if `ai.metrics.budgetHits` rises.
- Motion and intent scoring avoid allocations; any new intent should follow same pattern (reusing temps, no closures per tick).
- HUD `AiDebugOverlay` reads metrics; keep overlay inexpensive (throttling may be added if frame budget tightens).

## Follow-ups / TODOs

- Consider caching nearest-enemy on a frame index keyed map to reduce double distance scans if new systems need similar info.
- Potential spatial grid or BVH for enemy lookup if perf budget tight with higher entity counts.
- Evaluate intercept lead accuracy for very slow projectile speeds or extremely fast targets; add fixture if adjustments made.

Updated: 2025-09-24
