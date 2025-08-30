# Contributor Notes

Overview for contributors:
- Purpose: Work on deterministic simulation (`src/core`) or rendering (`src/renderer`). Keep separation to ensure headless tests are reliable.
- Branching: Use feature branches off `dev`, open PRs against `dev` then merge to `main` after review.
- Tests: Add unit tests for simulation logic under `test/vitest/`. Keep tests fast and deterministic (avoid randomness; use seeded RNG where possible).
- Code reviews: Include test coverage for new logic and update `docs/` when adding new behaviors or public helpers.
- Linting & Pre-commit: Husky + lint-staged are present; ensure code passes ESLint and Prettier before committing.
- Developer environment: Node.js >=18, npm install, use `npm run serve` to preview.

Key helpers and public APIs to consider for extension:
- `AIController.calculateSeparationForceWithCount` — public helper for separation math; useful for testing steering behaviors.
- `behaviorConfig.globalSettings` — contains toggles like `enableSpawnJitter` to control deterministic aspects.

Where to look when debugging
- Simulation failures: start at `src/core/gameState.ts` and `core/physics.ts`.
- Rendering issues: `renderer/threeRenderer.ts` and `renderer/effects.ts`.
- Asset loading: `core/assetLoader.ts` and `core/assetPool.ts`.
