# Memory — core-gameState

File: `src/game/state.ts`

Responsibilities:

- Factory `createGameState()` initializes Rapier (main thread), EventQueue, and Miniplex world; sets up queries and seeded RNG.
- Entity lifecycle helpers: `destroyEntity()` safely removes collider/body and ECS entity; `disposeGameState()` frees Rapier resources.
- Spawning: `spawnInitialFleets()` creates symmetric fleets; `spawnRandomShip()` picks hull, team-appropriate position; `resetGame()` clears and respawns.

Key data:

- `GameState` holds all runtime state (Rapier world, ECS world, queries, rng, time, paused, timeScale).
- `queries` expose `ships` and `projectiles` archetypes for systems and UI layers.

Integration:

- Used by `src/game/context.tsx` to create and own the lifecycle of the state provider.
- Systems in `src/game/systems.ts` mutate entities referenced by the state.

Testing notes:

- Keep deterministic RNG by using `state.rng` when randomness is needed.
- Prefer integration tests that set up a small state, call `spawnInitialFleets()`, and step systems.
