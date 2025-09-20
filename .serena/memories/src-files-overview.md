# Source Files Overview

Last-Reviewed: 2025-09-21

Authoritative mapping (current):

- `src/main.tsx` — application bootstrap and UI mount; attaches renderer and starts the game loop.
- `src/game/state.ts` — canonical `GameState` factory (createGameState/disposeGameState) and helpers for spawning/destroying entities.
- `src/game/systems.ts` — single-tick simulation step logic (prepareShips, findNearestEnemy, updateProjectiles, resolveHits).
- `src/game/ships.ts` — ship blueprint definitions, spawn helpers, and SHIP_STATS.
- `src/utils/rng.ts` — seeded RNG utility used by the simulation for deterministic runs.
- `src/utils/patchGltfLoader.ts` — runtime guard for GLTFLoader compatibility and lazy dynamic imports of Three.js loaders.
- `src/assets/ships.ts` — mapping from ship class names to model asset URLs.
- `src/renderer/*` — renderer-specific modules (threeRenderer, meshFactory, shipInstancer) used solely by the rendering layer.

Notes:
- Many older memories and docs referenced `src/core/*`. The active codebase was reorganized; prefer `src/game/*` and `src/utils/*` as the primary locations for simulation and support utilities.
- For renderer integration points see `threeRenderer` memory and `src/main.tsx`.
