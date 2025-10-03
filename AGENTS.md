# Repository Guidelines

to structure memory follow `.github/instructions/memory-bank.instructions.md`
try to follow `.github/instructions/spec-driven-workflow-v1.instructions.md`
create tasks files in `memory/tasks` and update with progress

## Project Structure & Module Organization

- Source: `src/` (TypeScript only). Do not edit generated `dist/`.
- Tests: `test/` with `*.spec.ts` (Vitest).
- E2E: Playwright specs exist under `test/playwright/`.
- Types: import shared types from `src/types/index.ts` only.
- Docs: `spec/src-structure.md` (overview), `PR_NOTES/` (breaking-change records).

## Build, Test, and Development Commands

- Build: `npm run build` — compile to `dist/`.
- Type-check: `npx tsc --noEmit` — validate types without emitting JS.
- All tests: `npm test` — run unit suite.
- Single spec: `npx vitest test/<path>.spec.ts` — target a file.
- E2E tests: `npm run test:playwright` or `npm run test:e2e` — see `playwright.config.cjs` for config.

## Coding Style & Naming Conventions

- Indent 2 spaces; use semicolons; `const`/`let` (no `var`); ES modules.
- Add explicit types for public APIs and config objects.
- Event names stay stable: `bullets`, `explosions`, `shieldHits`, `healthHits`.
- Determinism: use seeded RNG in `src/utils/rng.ts` for simulations.
- Canonical Game State: use the `GameState` type defined in `src/types/index.ts` for all runtime state; do not introduce module-level state outside of `GameState`.
- Error handling: throw or return error values; avoid silent failures.

## Testing Guidelines

- Frameworks: Vitest (unit) and Playwright (E2E). use Playwright's docs at <https://playwright.dev/docs/codegen> as a reference for authoring Playwright tests.
- Coverage: aim for 90%+ on new code; use `--watch` mode during development.
- Mocking: use Vitest's built-in mocking; avoid complex setups.
- Naming: `*.spec.ts` under `test/`. Keep tests deterministic (seeded RNG, pooled objects).
- Run locally: `npx tsc --noEmit` then `npm test`; use Playwright for flow verification.

## Commit & Pull Request Guidelines

- Commits: small, test-backed; run `npx tsc --noEmit` and `npm test` before pushing.
- Messages: clear, imperative scope (e.g., `fix: correct shield hit rounding`).
- PRs: include intent, linked issues, and screenshots/logs for visual changes.
- Breaking types/config: add a record in `PR_NOTES/` and provide migration/fallbacks.

## Engine Integration (React Three Fiber & Rapier3D)

- Update loop: Rapier3D runs on the main thread and is stepped from React Three Fiber's `useFrame`.
- Separation of concerns: simulation state and rendering are decoupled via ECS (Miniplex) and `GameState`.
- Assets: GLTFs are cached via `@react-three/drei`'s `useGLTF`. Always dispose custom Three.js resources when appropriate.
- Performance: prefer pooling/re-use and LOD for distant objects; avoid per-frame allocations in hot paths.
