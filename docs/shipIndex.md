# shipIndex cache

This short note describes the `GameState.shipIndex` cache and related tuning knobs.

What is `shipIndex`?

- `shipIndex` is an optional Map<EntityId, Ship> attached to `GameState` used as an O(1) lookup table for ships by id.
- It is populated when ships are spawned (`spawnShip`) and rebuilt during death processing (`processDeathsAndXP`) to keep it consistent with `state.ships`.

Why does it exist?

- Many code paths need fast owner/ship lookups (bullet hit handling, UI lookups, scoring). Iterating `state.ships` for each lookup is O(n) and can be costly at larger entity counts; the Map reduces this to O(1).

Invariants

- `shipIndex` should always contain exactly the live ships in `state.ships`.
- After `processDeathsAndXP` runs, `shipIndex` is cleared and rebuilt from `state.ships` to ensure consistency.
- When spawning a ship, code pushes to `state.ships` and also sets `state.shipIndex.set(ship.id, ship)`.

Where to tune kill-credit and related behavior

- The kill-credit time window is configurable via `behaviorConfig.globalSettings.killCreditWindowSeconds` (default: 5 seconds). This controls how long a `lastDamageBy` entry remains eligible for receiving kill credit.
- The `evadeOnlyOnDamage` flag in `behaviorConfig.globalSettings` controls whether AI `evade` intent is only allowed after recent damage (true) or allowed due to proximity (false). For backwards compatibility the project defaults this to `false`. Flip to `true` to make evasion strictly require recent damage.

Notes for contributors

- If you add code that caches ship references elsewhere, ensure the cache is updated / invalidated when ships are removed or IDs change.
- Keep `shipIndex` rebuild in `processDeathsAndXP` cheap and deterministic: it clears and re-populates using the current `state.ships` array.
- Add tests for any new lookup-heavy codepaths to assert they use `shipIndex` where possible and behave correctly under large entity counts.

Related files

- `src/core/gameState.ts` — `spawnShip`, `processDeathsAndXP`, `simulateStep` where `shipIndex` is used and rebuilt.
- `src/types/index.ts` — `GameState` and `Ship` types (includes optional `shipIndex`).
- `test/vitest/shipIndex.spec.ts` — new unit test that validates population and rebuild on removal.

If you prefer this note merged into an existing doc, tell me which file and I will update it instead of creating a dedicated doc.
