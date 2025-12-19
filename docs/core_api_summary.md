# Core API Summary — current modules

This summarizes the public surface of the rewrite’s core modules to help navigation and testing. Paths reference the actual files under `src/`.

## Game state and systems (`src/game/*`)

- `state.ts` (barrel exports)
  - `createGameState(): Promise<GameState>` — initializes Rapier, ECS world, queries, and seeded RNG.
  - `disposeGameState(state): void` — releases Rapier and ECS resources.
  - `destroyEntity(state, entity): void` — removes an entity and cleans up Rapier handles/lookups.
  - `spawnInitialFleets(state): void` — spawns two mirrored fleets.
  - `spawnRandomShip(state, team): void` — spawns a random hull for a team.
  - `resetGame(state): void` — immediate reset (call only when not mid-step).
  - `requestReset(state): void` — schedules a post-physics reset (safe during stepping).

- `systems.ts`
  - `updateGame(state, dt): void` — main deterministic tick; runs subsystems, flushes mutation queues, steps Rapier, syncs transforms, resolves damage, updates explosions.
  - `runDecisionTick(state, dt): void` — alias for `updateDecisionSystem` for test compatibility.
  - Re-exports: `updateDecisionSystem`, `fireProjectile`, `findNearestEnemy`.
  - `__aiTestHooks` — exposes internal decision/ship-control functions for tests.

- `ships.ts`
  - `SHIP_STATS` — per-hull stats (defined in `src/data/shipStats.ts`, re-exported here).
  - `spawnShip(state, blueprint): ShipEntity` — creates kinematic body + collider, registers entity in ECS, and sets up turrets/AI/progression state.

- `spawnFleets.ts`
  - `spawnInitialFleets(state): void` and `spawnRandomShip(state, team): void` — fleet and reinforcement spawning logic.

- `simulationQueue.ts`
  - Deferred mutation queues (`enqueueDeferredMutation`, `enqueuePostPhysicsMutation`) and flush helpers.
  - Diagnostics helpers (`recordRapierStepPanic`, `recordSubsystemFailure`) and debug snapshot publishing.

- `SimulationBridge.ts`
  - Worker simulation bridge (feature-flagged); can run simulation off-thread and stream snapshots.

- `config.ts`
  - `WORLD_SIZE`, `WORLD_HALF`, `WORLD_BOUNDS_MARGIN` — cubic world size (default 8000³).
  - `clampToWorld(v)` — clamps a position to remain inside the cube.
  - `CAMERA_DEFAULTS`, `FOG_DEFAULTS` — renderer defaults for this scale.
  - `AI_CONFIG` — AI runtime configuration (includes `verticalEnabled`, `tickRateHzExperiment`, and range policy).
  - `SPAWN_CONFIG` — fleet spawn configuration.

## Rendering (`src/components/*`)

- `Battlefield.tsx` — sets up R3F `<Canvas>`, lights, fog, stars, and mounts `BattlefieldSystems`.
- `BattlefieldSystems.tsx` — fixed-step simulation integration (main thread), plus worker-render-only mode support.
- `Ship.tsx` — renders GLTF models via `useGLTF`, syncs transform from entity each frame.
- `Projectile.tsx` — simple visual mesh.
- `Hud.tsx` — UI overlay with fleet stats.

## Assets and utilities

- `assets/ships.ts` — map of hull -> GLB URL emitted by webpack.
- `utils/patchGltfLoader.ts` — development-time guard for invalid GLTF URLs (examples + stdlib loaders).
- `utils/rng.ts` — seeded RNG used by game logic.

## Types (`src/types/index.ts`)

- Canonical `GameState`, `GameEntity`, `ShipEntity`, `ProjectileEntity`, queries, and blueprint/stats types. All modules import from here.

## Testing pointers

- Use `createGameState()` in tests; keep dt clamped if running many steps.
- For components using drei, Vitest config includes `assetsInclude: ['**/*.glb']` and minimal drei ambient types in `src/types/react-three-drei.d.ts`.
