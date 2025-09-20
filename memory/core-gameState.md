# Memory: src/game/state.ts (canonical GameState)

Purpose:

- Provide the canonical GameState factory and low-level entity lifecycle helpers used by the simulation and renderer.

Summary of responsibilities (current repo):

- createGameState(opts?): initialize Rapier WASM/runtime (Rapier.init), create the Rapier World (zero gravity), build a Miniplex ECS world, set up queries, event queues and a seeded RNG (SeededRng from `src/utils/rng.ts`). Returns a GameState object used across the app.
- destroyEntity(state, entity): defensive removal of physics colliders and rigid bodies (if present) and removal of the entity from the ECS world. Handles missing/partially-initialized resources safely.
- spawnInitialFleets(state): helper used at startup to spawn symmetrical Red/Blue fleets using `spawnShip` from `src/game/ships.ts`.
- disposeGameState(state): cleanup helpers that release physics resources and clear lookups.

Integration points and notes:

- `src/game/ships.ts` (spawnShip) creates kinematic/rigid bodies, colliders, and registers collider handles on `state.colliderLookup` — `createGameState` prepares the structures those functions expect.
- `src/game/systems.ts` consumes fields of GameState (time, world, physics world, colliderLookup, rng) and implements the per-tick simulation step (see memory/core-systems.md).
- `GameState.assetPool` is described elsewhere as a renderer-side cache; the GameState factory does not enforce a specific asset-pool implementation but the renderer may add one during bootstrap.
- Determinism: the seeded RNG (`src/utils/rng.ts`) is the canonical source of deterministic randomness for simulation-side behavior.

Edge cases & follow-ups:

- Scripts or docs in the repo that reference older paths (e.g., `src/core/*`) should be reviewed; this memory entry replaces the historical `src/core/gameState.ts` mapping.

Tags: GameState, Rapier, Miniplex, createGameState, destroyEntity, deterministic
