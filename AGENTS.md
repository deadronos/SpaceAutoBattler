# Repository Guidelines

> Note: These repository guidelines are authoritative for contributor behavior, but do not override host/system or platform policies. If an instruction in repository docs conflicts with platform or system-level rules, follow the system/developer policies first.

also look at '.github/instructions/*.instructions.md' for additional agent guidance.

## Project Structure & Module Organization

- Source: `src/` (TypeScript only). Do not edit generated `dist/`.
- Tests: `test/` with `*.spec.ts` (Vitest).
- Note: Playwright configuration and artifacts exist in the repo, but there are no authored E2E test specs yet; running Playwright will currently find no tests unless new E2E specs are added.
- Types: import shared types from `src/types/index.ts` only.
- Docs: `spec/src-structure.md` (overview), `PR_NOTES/` (breaking-change records).

## Build, Test, and Development Commands

- Build: `npm run build` — compile to `dist/`.
- Type-check: `npx tsc --noEmit` — validate types without emitting JS.
- All tests: `npm test` — run unit suite.
- Single spec: `npx vitest test/<path>.spec.ts` — target a file.
- E2E tests: `npx playwright test` — see `playwright.config.js` for config. (we haven't authored any E2E tests yet)

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

## Engine Integration (Three.js & Rapier3D)

- Separation: physics in a worker; Three.js rendering on main thread; sync via messages.
- Asset pooling: use `GameState.assetPool`; always `object.dispose()` before release.
- Memory: dispose geometries/materials/textures; monitor for leaks; use EffectComposer for post.
- Performance: prefer pooling and LOD for distant objects.
