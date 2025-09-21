# Memory — core-gameState

File: `src/game/state.ts`

Responsibilities (summary)

- `createGameState()` initializes Rapier, creates the physics `World` and `EventQueue`, constructs the Miniplex ECS world, and returns the canonical `GameState` used across the app and tests.
- `destroyEntity(state, entity)` and `disposeGameState(state)` provide robust lifecycle handling for entities and Rapier resources.
- Spawn helpers: `spawnInitialFleets()`, `spawnRandomShip()`, and `resetGame()` are responsible for consistent, deterministic entity creation.

Key data and structures

- `GameState` contains: Rapier runtime objects (`rapier`, `physicsWorld`, `eventQueue`), `world` (Miniplex), `colliderLookup: Map<number, Entity>`, `turretsByShip: Map<number, Set<Entity>>`, `queries` (ships/projectiles/turrets), `rng` (SeededRng), `time`, `paused`, and `timeScale`.

- `turretsByShip` is an explicit registry used for efficient turret cascade removal when ships are destroyed.

Behavior notes

- `destroyEntity` performs defensive Rapier removals with `isValid()` checks and try/catch, removes collider lookup entries, uses `turretsByShip` to find and destroy child turrets, and ensures ECS entities are cleaned from queries to avoid stale references in tests.

- `spawnRandomShip` and other spawn helpers use `state.rng` (the canonical seeded RNG) to ensure deterministic placement and cooldown seeding.

Testing & recommendations

- Tests should create `GameState` with a known seed and use `state.rng` for any randomness.
- Ensure turret registration helpers (`registerTurret`/`unregisterTurret`) are used in tests to keep `turretsByShip` accurate so `destroyEntity` fast-paths work as intended.

Generated: 2025-09-21 (automated promotion)
