# Core API Summary — current modules

This summarizes the public surface of the rewrite’s core modules to help navigation and testing. Paths reference the actual files under `src/`.

## Game state and systems (`src/game/*`)

- `state.ts`
  - `createGameState(): Promise<GameState>` — initializes Rapier, ECS world, queries, and seeded RNG.
  - `disposeGameState(state)` — frees Rapier resources and destroys entities.
  - `spawnInitialFleets(state)` — spawns two mirrored fleets near the origin.

- `systems.ts`
  - `updateGame(state, dt)` — main update; prepares ships, advances projectiles, steps Rapier, syncs transforms, resolves hits.
  - `findNearestEnemy(state, origin)` — linear nearest-enemy search.

- `ships.ts`
  - `SHIP_STATS` — stats per hull; models assumed 1:1 scale.
  - `spawnShip(state, blueprint)` — creates kinematic rigid body + capsule collider; registers entity in ECS and collider map.

- `config.ts`
  - `WORLD_SIZE`, `WORLD_HALF`, `WORLD_BOUNDS_MARGIN` — cubic world size (default 4000³).
  - `clampToWorld(v)` — clamps a position to remain inside the cube.
  - `CAMERA_DEFAULTS`, `FOG_DEFAULTS` — renderer defaults for this scale.

## Rendering (`src/components/*`)

- `Battlefield.tsx` — sets up R3F `<Canvas>`, lights, fog, drei `OrbitControls` and `Grid`, stars, and runs the systems each frame.
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
