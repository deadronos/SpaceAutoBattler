# Tech Context — SpaceAutoBattler

Tech stack and notable dependencies:

- TypeScript (strict) — source in `src/` and unit tests in `test/` (Vitest).
- React 19 + React Three Fiber + Drei — renderer and scene graph management.
- Three.js — underlying 3D engine; always dispose resources you create.
- Rapier3D — deterministic physics on the main thread (stepped in R3F `useFrame`).
- Miniplex — lightweight ECS for entity management and queries.
- Zustand — UI store (pause, timeScale).
- Vitest — unit testing framework. Tests are deterministic and fast.
- Playwright — end-to-end and visual regression testing; specs live under `test/playwright/` and baselines are captured to `playwright-debug/` (or `playwright-report/` when run in CI).
- Build tooling: webpack (see `webpack.config.mjs`) and npm scripts.

Developer workflow notes:

- Typecheck with `npm run typecheck` and run `npm test` before committing.
- E2E/visual tests can be run via `npm run test:playwright` (see `playwright.config.cjs` for configuration).
- Use `src/game/ships.ts` and `src/config/renderer.ts` for tuning ship stats and shield visuals.
- Keep all runtime state on `GameState` (`src/types/index.ts`).

Generated: 2025-09-29
