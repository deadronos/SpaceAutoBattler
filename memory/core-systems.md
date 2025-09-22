# Memory — core-systems

File: `src/game/systems.ts`

Responsibilities

- `updateGame(state, delta)`: orchestrates the simulation tick in this order:
  1. `updateDecisionSystem(state, delta)` — fixed-rate AI V2 scheduler that rebuilds the blackboard, assigns escorts/posture, and runs a round-robin decision slice when the feature flag is enabled.
  2. `prepareShips(state, delta)` — executes deterministic `AICommand`s (movement, thrust, fire gating) or falls back to the legacy nearest-enemy steering when AI V2 is disabled; also manages shields, muzzle flashes, and embedded turrets.
  3. `updateTurrets(state, delta)` — updates turret entities (aiming arcs, cooldowns, firing) against nearest targets.
  4. `advanceProjectiles(state, delta)` — moves projectiles kinematically while clamping to world bounds.
  5. `state.physicsWorld.step(state.eventQueue)` — steps Rapier physics.
  6. `syncTransforms(state)` — copies rigid body transforms back onto ECS transforms for rendering.
  7. `resolveProjectiles(state, delta)` — TTL decrement, collision distance checks, shield absorption/ripple emission, hull damage, and queued destruction.

Key details

- `updateDecisionSystem` derives ally centroids, team posture (`aggressive`/`hold`/`retreat`), nearest-enemy & VIP threat caches, and escort assignments, then evaluates intent scores (`Attack`, `Kite`, `Escort`, `Flee`) per ship within the configured budget (`config.ai.maxPerTick`). Profiles are modulated by per-ship trait multipliers (aggression/patience/dodge) and deterministic tie-breaking hashes each ship's `traitSeed` with the tick index.
- `prepareShips` branches per flag: AI V2 consumes the stored command (normalizing headings, clamping thrust, resolving target IDs for turret fallback) while the legacy path keeps the prior nearest-enemy chase/fire routine. Both flows prune muzzle flashes and use `runEmbeddedTurrets` when no turret entities exist.
- `runEmbeddedTurrets` centralizes the legacy turret firing path so both AI modes share it; dedicated turret entities remain unaffected.
- Movement uses pooled vectors (`TEMP_DIR`, `TEMP_POS`), and world clamping to maintain determinism.
- Projectile spawning still respects `PROJECTILE_CONFIG`/`DEFAULT_PROJECTILE_CONFIG`; only the gating signal changed (AI command vs. distance check).
- `__aiTestHooks` exports deterministic hooks (`updateDecisionSystem`, scorer helpers, `writeCommand`, `runLegacyShipBehavior`) so Vitest can exercise internals without widening the runtime API surface.

Implementation notes

- LOD spacing (0/1/2) determines how many AI ticks a ship can skip before its next evaluation; spacing is configurable and keyed off desired range vs. `config.ai.lod` thresholds.
- Blackboard + assignments reset when no ships remain, and `resetGame` zeroes centroids/posture alongside AI scheduler counters and metrics.
- AI manager tracks metrics (`lastDecisions`, `lastSkipped`, `lastSliceSize`, cumulative totals, and `budgetHits`) so debugging tools can monitor cadence pressure.
- Utility scores remain integer-friendly math; posture, profile aggression/patience knobs, and VIP threats bias which intent wins.

Follow-ups

- Integration tests now live in `test/vitest/ai-*.spec.ts` (determinism, scorers, executors, legacy fallback). Keep them in sync when touching internals exposed via `__aiTestHooks`.
- Phase 8: extend `selectIntent`/`writeCommand` to cover intercept/reposition/regroup flows and add matching Vitest coverage.
- Phase 9: build deterministic scenario harness/golden logs before widening manual testing.
- Consider caching ship lookups for `getShipById` or adding a spatial grid if 300+ ships make the O(N²) nearest-enemy cache too expensive.
- Monitor the HUD `AiDebugOverlay` for perf impact; if needed, add throttling knobs or sampling controls.

Updated: 2025-09-23
