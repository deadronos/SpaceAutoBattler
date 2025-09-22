# Memory — core-gameState

File: `src/game/state.ts`

Responsibilities (summary)

- `createGameState()` initializes Rapier, the physics `World`/`EventQueue`, the Miniplex ECS world, seeded RNG, and now wires the AI manager (`state.ai`) plus AI blackboard scaffolding.
- Lifecycle helpers `destroyEntity(state, entity)` / `disposeGameState(state)` manage Rapier resources, ECS cleanup, turret cascade removal, and now leave AI bookkeeping to be rebuilt next tick.
- Spawn helpers (`spawnInitialFleets`, `spawnRandomShip`, `resetGame`) create deterministic fleets and reseed per-ship cooldowns/AI traits.

Key data and structures

- `GameState` now carries:
  - Rapier runtime objects (`rapier`, `physicsWorld`, `eventQueue`).
  - ECS world, entity queries, `colliderLookup`, optional `turretsByShip` registry.
  - Simulation clock (`time`), `paused`, `timeScale`, and canonical `rng`.
  - `ai: AIManagerState` (flag, tick interval, max-per-tick budget, accumulator, tick index/cursor, slice count, escort assignments map).
  - `blackboard: AIBlackboard` (per-team centroids, posture, nearest-enemy/threat maps, scratch vectors, tick index).

Behavior notes

- `createGameState` seeds AI defaults from `config.ai` (v2 disabled by default, 10 Hz tick). Blackboard vectors are preallocated to avoid per-tick allocations.
- `resetGame` now resets AI counters, clears escort assignments/nearest caches, and zeroes centroids/posture in addition to respawning fleets.
- `spawnShip` attaches an `ai` component per ship (profile id derived from hull, initial `AICommand` heading forward, deterministic `traitSeed`). Turret entity registration unchanged.
- `destroyEntity` still clears Rapier handles/turret registries; AI state is transient and rebuilt via `updateDecisionSystem` so no extra teardown is needed.

Testing & recommendations

- Tests toggling AI V2 should assert `state.ai.enabled` and blackboard contents; when flag-off, the legacy systems should behave as before.
- When spawning ships in tests, inspect `entity.ai` to validate profile assignment or override behavior; any deterministic scenarios should set `state.ai.tickInterval`/`maxPerTick` explicitly.
- Continue using `registerTurret`/`unregisterTurret` helpers so destroy cascades remain O(1).

Updated: 2025-09-22
