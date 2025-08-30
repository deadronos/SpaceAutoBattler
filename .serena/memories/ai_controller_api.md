# AIController API Summary

File: `src/core/aiController.ts`
Primary export: `AIController` (class)

Overview
- `AIController` is the centralized AI subsystem for ship behavior. It is instantiated with the current `GameState` and updates ship AI each simulation tick. It encapsulates team-level systems (alarms, scouts, roaming anchors) and per-ship intent selection and execution.
- The controller relies heavily on `behaviorConfig`, `simConfig`, `PhysicsConfig`, and the repo's RNG (`state.rng`) for deterministic behavior.

Public API (what other code/tests should call)

1) new AIController(state: GameState)
- Parameters:
  - `state`: the global `GameState` object (contains `ships[]`, `behaviorConfig`, `simConfig`, `spatialGrid`, `rng`, `tick`, `time`, etc.).
- Behavior: constructs internal registries for roaming anchors, team alarms, scouts, and a separation cache. Does not mutate `state` on construction.

2) updateAllShips(dt: number): void
- Parameters:
  - `dt` — delta time in seconds for this update step.
- Behavior:
  - Early-exits if `state.behaviorConfig.globalSettings.aiEnabled` is falsy.
  - Resets per-tick spatial update flag, updates team alarms and scout assignments, then iterates live ships and calls `updateShipAI` for each.
- Side effects: mutates each ship's `aiState`, `pos`, `vel`, `orientation`, `targetId`, `shield`, and other stateful fields through delegated calls.
- Determinism: uses `state.rng` for probabilistic choices (seeded RNG ensures reproducible behavior in tests if the `GameState.rng` seed is controlled).

3) updateShipAI(ship: Ship, dt: number): void  (public)
- Parameters:
  - `ship` — the ship entity object to update.
  - `dt` — delta time seconds.
- Behavior:
  - Initializes `ship.aiState` if missing (intent, preferredRange, recentDamage tracking).
  - Decays recent damage, maybe forces intent reevaluation (damage or timeout), executes the current intent and turret AI, and applies shield regeneration.
  - Delegates intent selection to private `reevaluateIntent`/`choose*Intent` helpers and execution to `execute*` handlers.
- Side effects: updates `ship.aiState`, `ship.vel`, `ship.pos`, `ship.orientation`, `ship.targetId`, `ship.shield`, etc.
- Notes: Exposed publicly for legacy usage and for unit tests that exercise a single-ship AI step.

4) calculateSeparationForceWithCount(ship: Ship): { force: Vector3; neighborCount: number } (public)
- Purpose: compute a normalized separation force vector to avoid clumping, plus the number of neighbors considered. This is intentionally public to support unit tests.
- Behavior:
  - Uses the spatial grid (fast path) when enabled in `behaviorConfig.globalSettings.enableSpatialIndex`, otherwise falls back to a linear search helper.
  - Returns `{ force: {x,y,z}, neighborCount }` where `force` is normalized (unit vector) or a small random perturbation when neighbors are symmetrical.
  - Caches results per-tick for performance when the spatial index is used.
- Side effects: updates internal sepCache for caching but does not mutate `ship`.
- Testing note: tests can call this method directly to assert separation vector shape, neighbor counts, and cache behavior.

Important non-public behavior (for readers and advanced tests)
- Intent system: `reevaluateIntent` sets `aiState.currentIntent` and `intentEndTime`. Intents include `idle, pursue, evade, strafe, group, patrol, explore, retreat`.
- Intent selection helpers: `chooseAggressiveIntent`, `chooseDefensiveIntent`, `chooseRoamingIntent`, `chooseFormationIntent`, `chooseCarrierGroupIntent`, `chooseMixedIntent` — these are private but essential to understand the decision logic.
- Execution helpers: `executePursue`, `executeEvade`, `executeStrafe`, `executeGroup`, `executePatrol`, `executeScoutExploration`, `executeRetreat`, `moveTowards`, `moveTowardsWithSeparation` — these mutate `ship.vel`, `pos`, and `orientation` and call `applyBoundaryPhysicsShip`.
- Team systems: the controller tracks per-team scouts (`teamScouts`), alarm times (`teamAlarmTimes`), and roaming anchors (`roamingAnchors`).

Side effects & invariants to be aware of
- AIController mutates the provided `GameState` and `Ship` objects extensively — it is not pure.
- Deterministic tests must control `state.rng` and `state.time`/`state.tick` to reproduce behavior.
- Spatial-index usage requires `state.spatialGrid` to be present and `behaviorConfig.globalSettings.enableSpatialIndex` enabled for the fast paths and caching to be exercised.

Testing guidance & examples
- Unit tests should prefer calling `updateShipAI` (single-ship) with a small `GameState` fixture to verify transitions and effects.
- For deterministic assertions, seed the RNG and set `state.time`/`tick` explicitly.
- Example (pseudo):
  - Create `state` with two ships on opposing teams and deterministic `rng`.
  - Instantiate `const ai = new AIController(state);`
  - Call `ai.updateShipAI(shipA, 0.016);`
  - Assert `shipA.aiState.currentIntent === 'pursue'` (or other expected result) and check `shipA.targetId`.
- Separation tests: call `calculateSeparationForceWithCount(ship)` in clustered setups to assert `neighborCount` and `force` direction and that the `sepCache` is used across repeated same-tick calls.

Performance & maintainability notes
- Heavy spatial queries are cached per tick in `sepCache` to avoid recomputation across multiple calls for the same ship in a single tick.
- `ensureSpatialGridUpdated` guards against repeated expensive grid updates: the grid is refreshed once per tick.
- Where possible, tests should exercise both spatial-index and linear fallback paths.

Memory created
- This summary will be written to project memory under the name `ai_controller_api` for quick retrieval by agents and contributors.

References
- Key dependent files: `src/config/behaviorConfig.ts`, `src/core/searchUtils.ts`, `src/core/boundaryUtils.ts`, `src/config/entitiesConfig.ts`, `src/config/physicsConfig.ts`.
- See `test/vitest/*` for existing unit tests (some focused on separation, turret selection, and turret/asset behavior).
