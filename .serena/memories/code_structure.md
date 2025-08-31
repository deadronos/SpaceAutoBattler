Top-level structure (summary):
- src/main.ts: app entry - initializes GameState, preloads assets, spawns fleets, starts render loop
- src/core/: simulation logic - gameState.ts (state, spawning, simulate step), physics.ts (physics stepper), aiController.ts, assetLoader.ts, svgLoader.ts, searchUtils.ts, spatialIndex.ts
- src/config/: configuration modules for sim, behavior, entities, fleet, renderer, camera, progression
- src/renderer/: three.js renderer integration, scene setup, animation managers, bvh manager, effects
- src/agent/: agent-level utilities (lockUtils)
- src/utils/: helpers (rng, spatialGrid, vector3, logger, fileWatcher)
- tests: vitest unit tests under test/vitest; playwright end-to-end tests under test/playwright
- scripts/: build tooling (build.mjs, build-standalone.mjs)
Entrypoints & important behaviors: createInitialState (src/core/gameState.ts) and initGame (src/main.ts). Build scripts and test commands available in package.json.
Notes: supports optional worker-based physics (simWorker.ts) and SVG rasterization caching. This memory added on 2025-08-31.