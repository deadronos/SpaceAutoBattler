# Memory: src/core/gameState.ts

Purpose:

- Implements the canonical GameState creation/reset and the deterministic simulation step for ships and bullets.

Summary of responsibilities:

- createInitialState(seed?): build GameState with RNG, simConfig, arrays, spatial index when enabled, and expose debug hooks.
- resetState(state, seed?): reinitialize RNG, counters, entity arrays, and behavior config for deterministic restarts.
- spawnShip/spawnFleet: create ships with full initial fields (pos, vel, orientation, turrets, level), register in shipIndex and spatial grid, and bump shipDataVersion.
- simulateStep(state, dt): main per-tick pipeline: save prev state for interpolation, run AIController, update spatial grid, fire turrets, update bullets, process deaths/XP/levelups, carrier spawn logic, periodic normalization and boundary cleanup, and final target restorations.
- updateBullets(state, dt): integrate bullets, apply boundary rules, perform collision detection (spatial grid or full-scan), apply damage/shield logic, credit XP/kills, and purge bullets.

Integration points:

- AIController (src/core/aiController.ts) for AI decisions.
- SpatialGrid (utils/spatialGrid.ts) for proximity queries when enabled by behaviorConfig.
- ShipVisualConfig, FleetConfig, CarrierSpawnConfig for spawn/visual parameters.
- Exposes lightweight debug APIs on globalThis for development (with warnings about altering state).
- Uses perf instrumentation (perfBegin/perfEnd) to outline hot subsystems.

Notes & edge cases:

- Defensive error handling in many areas to avoid throwing during init or runtime.
- Uses shipDataVersion to signal ship changes (used by worker messaging in main.ts).
- simulateStep preserves AI-assigned targets across subsystems to maintain test contracts.

Tags: gameState, simulateStep, spawnShip, bullets, AI, spatialIndex, deterministic
