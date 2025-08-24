# IMPLEMENTATION_STATUS.md

This document summarizes the current implementation status for the repository, with emphasis on recent work around asset pooling, the typed WebGL renderer, tests, and next actionable PRs.

Status snapshot (2025-08-24):

- Branch: `deadronos/issue19`

- Local type-check: passing (npx tsc --noEmit)

- Local tests: Vitest suites for pooling and WebGL renderer green on this machine (targeted runs and larger runs reported passing locally).

## TL;DR — What changed

- Introduced a canonical, typed asset pooling API on `GameState.assetPool` with helpers: `acquireTexture`/`releaseTexture`, `acquireSprite`/`releaseSprite`, and `acquireEffect`/`releaseEffect`.
- Rebuilt `src/webglrenderer.ts` into a small, typed WebGL renderer that routes texture creation through the asset pool (with a safe fallback path).
- Added per-key PoolEntry accounting (freeList, allocated, optional config and disposer) and overflow strategies (`discard-oldest`, `grow`, `error`).
- Added a deterministic GL stub and test helpers to validate create/delete/disposer semantics without requiring a real GL context.
- Migrated DOM test environment from `jsdom` to `happy-dom` to better match the runtime and fixed related test setup.

## Detailed changes

### Asset pooling (core)

- The canonical `GameState.assetPool` now exposes per-kind maps for textures, sprites, and effects. Each map contains `PoolEntry<T>` values with:
  - `freeList: T[]` — available pooled instances (oldest-first order).
  - `allocated: number` — total number of items ever allocated for the key (helps detect leaks and enforce limits).
  - `config?: { max?: number, strategy?: 'discard-oldest'|'grow'|'error' }` — optional per-key policies.
  - `disposer?: (item)=>void` — optional cleanup, required for GPU resources (e.g., gl.deleteTexture).

- Public pooling helpers in `src/entities.ts` provide safe, single-entry points to acquire and release pooled assets. Factories follow the `PooledFactory<T>` contract and pooled instances are reset/rehydrated on acquire.

### Overflow strategies

- discard-oldest (default): when a release would push a pool past `max`, oldest items are disposed via the `disposer` until the pool is within bounds.
- grow: create new allocations on acquire even when `max` is reached (useful for debugging/stress scenarios).
- error: throw an exception on acquire when exhausted; on release, excess items are not retained.

### WebGL renderer

- `src/webglrenderer.ts` rebuilt as a minimal typed WebGL renderer. Key points:
  - Routes texture creation through `acquireTexture(factory, key, disposer)` when `GameState` is available.
  - Provides a fallback direct-create/delete path when no `GameState` is present (helps tests and headless runs).
  - Implements a simple baking cache and `hasCachedTexture` helper used by tests.

### Tests and test helpers

- New deterministic GL stub (`test/vitest/utils/glStub.ts`) records create/delete calls so tests can assert expected disposer behavior.
- Pool assertion helpers (`test/vitest/utils/poolAssert.ts`) standardize checks for freeList length, allocated counts, and disposer invocation.
- New and updated Vitest files cover pool semantics, integration between renderer and pool, and WebGL texture lifecycle.

### DOM / test environment

- Migrated from `jsdom` to `happy-dom` in `vitest.config.js` and adjusted test setup (`test/vitest/setupTests.ts`).
- `src/main.ts` updated to create a fallback `canvas#world` and to use a no-op renderer when contexts are unavailable. `src/canvasrenderer.ts` guards its context usage for headless/test environments.

## Test status

- Targeted runs for pooling, GL lifecycle, and renderer-related suites passed locally (examples: small runs reported 9–11 passing tests; a larger run reported ~77–93 passing tests on this machine depending on the selection).
- `npx tsc --noEmit` executed successfully locally after the changes.
- Note: CI may require a clean `npm install` (see notes below) to ensure `happy-dom` and other dev dependencies are present in the environment used by the runner.

## Gaps, risks, and open items

1. Disposer semantics under real GL stress
   - Tests use a GL stub; while this validates bookkeeping and disposer invocation, the behavior should be verified in a real WebGL environment (headless browser or Playwright run) to ensure no GL context ordering/race issues.

2. Worker / multi-thread ownership model
   - Current pools assume single-threaded access. The simulation may run in a worker in some deployments; GPU resource creation/disposal must remain on the main thread. We need a message/lease protocol (or marshal-only ids) if the sim moves off-thread.

3. Per-key policy coverage
   - Code supports per-key `config` and strategies; however, some keys still rely on defaults. We should audit critical high-churn keys (explosions, particle effects, dynamic icons) and add explicit `max` values.

4. CI / lockfile issues
   - Local `npm install` previously encountered workspace/protocol/permission issues on the agent machine. To make CI runs robust, ensure lockfiles are updated in a clean environment and CI installs `happy-dom` and all dev deps.

5. Migration of legacy pools
   - Several legacy pooling implementations still exist in simulation code (bullets, some particle lists). Plan a migration path to use `GameState.assetPool` for renderer-owned visuals.

## Next PRs / Actionable short-term plan

Priority PRs (small, testable, and safe):

PR #1 — Finalize per-key overflow + disposer tests (high priority)

- Implement and unit-test strict per-key trimming using the GL stub for three strategies: `discard-oldest` (default), `grow`, and `error`.

- Assert disposer/gl.deleteTexture counts and `allocated` bookkeeping under high-churn patterns.

- Add per-key `max` config for at least `explosion`, `particle-small`, and `dynamic-icon` keys and tests that demonstrate correct trimming.

PR #2 — Real-GL integration smoke test (medium priority)

- Add a minimal Playwright or headless browser test that mounts `WebGLRenderer` and exercises create/release lifecycle with real context. Verify no GL errors and validate expected create/delete counts (approximate, not exact) and absence of GPU leaks in a short run.

PR #3 — Migrate one renderer effect to use renderer-owned pooling (low risk)

- Pick a single visual (for example: explosion flash) and move its lifecycle to renderer pooling; add integration test showing spawn/release.

PR #4 — CI and lockfile hygiene

- Run `npm ci` in a clean environment, commit lockfile updates, and ensure CI matrix includes the `happy-dom` test environment.

## Short checklist before merging PRs

- [ ] Add unit tests for all strategies and per-key configs (PR #1).
- [ ] Run `npx tsc --noEmit` and Vitest locally; fix emergent type errors.
- [ ] Update CI workflow to run `npm ci` and the updated Vitest config (happy-dom).
- [ ] Add a small Playwright job (optional) for headless WebGL smoke test (PR #2).

## Long-term goals

- Unify particle & effect config entries between `gamemanagerConfig.ts` and `assetsConfig.ts`.
- Remove legacy fields (e.g., `dmg`) after callers are migrated.
- Expand Playwright coverage for renderer and visual-heavy scenes to detect GPU lifecycle regressions early.

## Notes / Troubleshooting

- If tests fail on CI with missing DOM packages, run `npm ci` locally and ensure `node_modules` are not blocked by workspace protocols or permission constraints.
- When adding or auditing per-key `max` values, prefer conservative caps and iterate based on stress-test telemetry.

---

End of status summary.
