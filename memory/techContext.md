# Tech Context — SpaceAutoBattler

Tech stack and notable dependencies:

- TypeScript (strict) — source in `src/` and unit tests in `test/` (Vitest).
- React 19 + React Three Fiber + Drei — renderer and scene graph management.
- Three.js — underlying 3D engine; always dispose resources you create.
- Rapier3D — deterministic physics on the main thread (stepped in R3F `useFrame`). The project uses deferred mutation queues and safe kinematic wrappers (`src/game/simulationQueue.ts`, `src/game/physics/safeKinematics.ts`) to avoid in-step Rapier mutable-borrow errors.
- Miniplex — lightweight ECS for entity management and queries (v2 shim helpers applied in `createGameState()` for compatibility).
- Zustand — UI store (pause, timeScale).
- Vitest — unit testing framework.
- Playwright — end-to-end and visual regression testing; specs live under `test/playwright/` and baselines are captured to `playwright-debug/` or `playwright-report/`.
- Build tooling: webpack (see `webpack.config.mjs`) and npm scripts.

Developer workflow notes:

- Typecheck with `npm run typecheck` and run `npm test` before committing.
- For physics-related features, consult `src/game/simulationQueue.ts` and `src/game/physics/safeKinematics.ts` to ensure safe mutation patterns and diagnostic recording.
- Rapier diagnostics are recorded to `state.simulation.rapierDiagnostics` to help triage guard trips and step panics in both tests and Playwright captures.
- E2E/visual tests can be run via `npm run test:playwright` (see `playwright.config.cjs` for configuration).
- Use `src/game/ships.ts` and `src/config/renderer.ts` for tuning ship stats and shield visuals.
- Keep all runtime state on `GameState` (`src/types/index.ts`).

Generated: 2025-10-03
