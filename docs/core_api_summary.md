# Core API Summary — SpaceAutoBattler

This document consolidates short API summaries for core simulation modules to help newcomers quickly understand the public contracts, determinism considerations, and suggested tests.

## Files summarized
- `src/core/gameState.ts` — GameState lifecycle, spawn, simulate step, bullets, XP/levelups
- `src/core/searchUtils.ts` — Spatial search helpers with spatial-grid and linear fallbacks
- `src/core/physics.ts` — Optional Rapier physics stepper and helper methods

---

## GameState (from `src/core/gameState.ts`)
Purpose:
- Central simulation state creation and management utilities used by the deterministic simulation core.

Key exports:
- `createInitialState(seed?: string): GameState` — returns an initialized state with seeded RNG and optional spatial grid
- `resetState(state: GameState, seed?: string): void` — resets state in-place
- `spawnShip(state, team, cls, pos?, parentCarrierId?)` — deterministic id allocation; initializes level/health/shield/turrets
- `spawnFleet(state, team, count=5)` — spawn multiple ships
- `applyBoundaryPhysics(ship, state)` — delegates to centralized boundary utils
- `simulateStep(state, dt)` — single simulation tick: AI update, spatial grid update, turrets, bullets, deaths/XP, levelups, carrier spawn, boundary cleanup

Determinism & testing notes:
- Use a fixed seed with `createInitialState` or `resetState` for deterministic tests
- Behavior toggles (enableSpawnJitter, enableSpatialIndex) affect behavior; write tests for both toggles
- `simulateStep` lazily constructs `AIController` — tests that depend on AI behavior should control or stub AIController

See `memory/game_state_api.md` for full details and suggested tests.

---

## Search Utilities (from `src/core/searchUtils.ts`)
Purpose:
- Provide nearest/enemy/friend queries used by AI and game-state logic.

Key exports:
- `getDistance(a, b): number`
- `findNearestEnemy(state, ship): Ship | null` — uses spatialGrid when enabled, otherwise linear fallback
- `findNearbyEnemies(state, ship, range): Ship[]` — returns enemies within range, sorted by distance
- `findNearbyFriends(state, ship, range): Ship[]`
- `getNearbySeparationShipsLinear(state, ship, separationDistance): Ship[]` — linear-only helper for separation logic

Testing guidance:
- Toggle `behaviorConfig.globalSettings.enableSpatialIndex` and ensure consistency between spatial-grid and linear paths
- Seeded states make assertions reliable

See `memory/search_utils_api.md` for full details.

---

## Physics (from `src/core/physics.ts`)
Purpose:
- Provides an optional Rapier-based physics stepper for richer physics interactions.

Key export:
- `createPhysicsStepper(state): Promise<PhysicsStepper>` — returns an object with:
  - `step(dt)`, `dispose()`, `addShip`, `removeShip`, `raycast`, `sphereCast`, `applyForce`, `setGravity`

Testing guidance:
- Mock or stub Rapier in test environments where native WASM is unavailable
- Tests should verify that `step` syncs rigid-body transforms back to `state.ships`

See `memory/physics_api.md` for full details.

---

## How to use these docs
- For unit tests of AI or game state: create a fresh `GameState` via `createInitialState(seed)` and either stub `AIController` or run a deterministic AI path with a known seed.
- For search utilities: run tests with both spatial index on and off to ensure parity.
- For physics: keep physics tests behind a guard or mock `@dimforge/rapier3d-compat`.

---

Files referenced:
- `memory/game_state_api.md`
- `memory/search_utils_api.md`
- `memory/physics_api.md`

Memory: core_api_summary (created)
