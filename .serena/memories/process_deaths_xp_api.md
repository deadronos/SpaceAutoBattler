processDeathsAndXP(state: GameState)

Last-Reviewed: 2025-09-07

- Purpose: Identify ships that reached 0 health, credit kills to recent damage sources, update scores and killer XP, handle fighter/carrier bookkeeping, and remove dead ships from the state.
- Inputs: `state` (GameState mutable)
- Outputs: None (mutates `state.ships`, `state.score`, ship.kills, killer.level.xp, and may set s.maxHealth=0 sentinel for removal)
- Side effects:
  - For each ship with health <= 0 and maxHealth > 0, checks `lastDamageBy` and `lastDamageTime` to find a recent killer (within kill credit window configurable in behaviorConfig).
  - Credits kills and XP to killer if valid; fallback heuristics use ships targeting the dead ship.
  - Decrements parent's `spawnedFighters` count if child had `parentCarrierId`.
  - Marks ships as removed by setting `s.maxHealth = 0` and then filters them out from `state.ships`.
- Edge cases and error modes:
  - If `lastDamageBy` references a non-existent ship, the fallback heuristics attempt to credit appropriately; otherwise no killer is credited.
  - Race conditions: if called concurrently (not expected), modifications to `state.ships` could be unsafe.
- Determinism: Deterministic given same state; depends on timestamps in `state.time` for recency checks.
- Performance: Single pass over ships; complexity O(#ships).