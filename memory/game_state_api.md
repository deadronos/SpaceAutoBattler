# GameState API Summary

File: src/core/gameState.ts

Purpose
- Central simulation state creation and management utilities used by the deterministic simulation core. Provides helpers to create, reset, spawn entities (ships & fleets), step the simulation, update bullets, apply boundaries, and handle XP/leveling/carrier spawning.

Exports
- createInitialState(seed?: string): GameState
  - Creates a new GameState object with a seeded RNG (config seed or time-based fallback), spatial grid initialization (if enabled), and default sim parameters.
  - Inputs: optional seed string
  - Output: initialized GameState
  - Notes: uses DefaultSimConfig and DEFAULT_BEHAVIOR_CONFIG; if spatial indexing is enabled, allocates a SpatialGrid.

- resetState(state: GameState, seed?: string): void
  - Resets an existing GameState instance in-place, reinitializing RNG, tick/time counters, arrays/maps (ships, bullets), behaviorConfig, and spatialGrid depending on defaults.
  - Recreates AI controller lazily by clearing state.aiController. Preserves simConfig unless a new seed influences RNG.

- spawnShip(state: GameState, team: Team, cls: ShipClass, pos?: Vector3, parentCarrierId?: EntityId): Ship
  - Spawns a single ship with deterministic id allocation via state.nextId, level initialization, health/shield based on class config and progression, turret state initialization, optional spawn jitter controlled by behaviorConfig.globalSettings.enableSpawnJitter.
  - Returns the newly created Ship object and registers it in state.ships and state.shipIndex.

- spawnFleet(state: GameState, team: Team, count = 5): void
  - Spawns `count` ships for the provided team using RNG choices for classes.

- applyBoundaryPhysics(ship: Ship, state: GameState): void
  - Compatibility wrapper that delegates to centralized boundary utils for ship boundary handling.

- simulateStep(state: GameState, dt: number): void
  - Runs a simulation tick: updates AI via AIController (lazily constructed), updates spatial grid, fires turrets, updates bullets, processes deaths/XP, handles level ups, carrier spawning, and optionally runs periodic boundary cleanup.
  - Notes: It mutates state in-place. Intended to be deterministic when state.rng and simConfig are controlled.

Internal/Helper functions (suggested usage and tests)
- randomSpawnPos(state, team): Generates a spawn position inside sim bounds using FleetConfig.spawning settings. Test by seeding RNG and validating positions lie within expected margins.
- fireTurrets(state, ship, dt): Handles turret cooldowns and bullet creation. Test by creating two ships, setting targetId, and verifying bullets are produced with expected velocities and damage.
- updateBullets(state, dt): Integrates bullets, applies boundary behavior, resolves collisions with ships (shield/health/armor interactions), and removes expired bullets. Test collision logic by setting positions close and verifying shield/health reductions and XP assignment.
- processDeathsAndXP(state): Assigns kills/XP to recent damagers or targeting ships, decrements carrier counters, and removes dead ships from state.ships.
- handleLevelUps(state): Applies progression upon accumulated XP and updates ship stats accordingly.
- carrierSpawnLogic(state, dt): Spawns fighters for carriers based on class config and CarrierSpawnConfig timings.
- runBoundaryCleanup(state): Finds ships outside bounds and teleports them back with deterministic jitter based on state.rng; prunes out-of-bounds bullets.
- updateSpatialGrid(state): Updates or garbage-collects entries in state.spatialGrid when spatial indexing is enabled.

Determinism and Test Guidance
- Use createInitialState(seed) or resetState(state, seed) to get deterministic RNG and predictable positions. Tests should assert behavior with a fixed seed.
- BehaviorConfig toggles (e.g., enableSpawnJitter, enableSpatialIndex) change runtime behavior; write tests for both enabled and disabled scenarios.
- For AI-dependent tests, either stub AIController or ensure AIController is deterministic with the same seed. The simulateStep function creates AIController lazily; tests that need specific AI behavior should construct a controlled AIController or mock AI actions.
- For boundary behavior tests, rely on applyBoundaryPhysics, runBoundaryCleanup, and carrierSpawnLogic under controlled sim bounds.

Notes on Public Contracts
- Functions mutate GameState in place — tests should either clone initial state or create fresh state via createInitialState to avoid cross-test contamination.
- Entity id allocation via state.nextId is deterministic given the sequence of spawns and should be asserted in tests when necessary.

Suggested Tests (small set to add)
- createInitialState with seed produces consistent RNG outputs across runs.
- spawnShip assigns expected default values (health, shield, turrets) and registers ship in shipIndex.
- fireTurrets adds bullets with expected properties when a valid target is in range and turret cooldowns are 0.
- updateBullets resolves collisions, applies shield first, then health, assigns XP to owner, and removes bullets.
- simulateStep integrates AI update, spatial index update, turrets, bullets, deaths, levelups, and carrier spawns in order.

Memory: game_state_api (written)
