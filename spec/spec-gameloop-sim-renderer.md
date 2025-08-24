# SpaceAutoBattler — Spec: Game Loop, Simulation Loop, Renderer, RNG, Entities

## Purpose

This document defines small, testable contracts for the game loop, deterministic simulation (simulateStep), and renderer backends.

Goals:

- Keep simulation deterministic and unit-testable.
- Allow renderers to run on main thread or use OffscreenCanvas workers.
- Provide a canonical `GameState.assetPool` contract for pooled GPU/texture/sprite/effect resources.

## Deployment modes

- main-thread sim + main-thread render
- worker sim + main-thread render
- worker sim + worker render (OffscreenCanvas)

## Public API (high-level)

- `startGame({ mode, seed, state, bounds, simDtMs })`
- `stopGame()`
- `isRunning()`

## Gameloop rules

The gameloop treats the renderer as a black box except for two flags:

- `renderer.providesOwnLoop: boolean` — if true, do not start an external rAF loop.
- `renderer.isRunning(): boolean` — when true, do not start a separate render loop; if this call throws, fallback to starting an rAF loop.

Acceptance criteria:

- If `renderer.providesOwnLoop === true`, gameloop must not start an external rAF.
- If `renderer.isRunning() === true`, gameloop must not start an external rAF.
- If `renderer.isRunning()` throws, gameloop must fallback to starting an rAF.

Tests to add:

- Unit tests that mock renderer permutations:
  - providesOwnLoop=true
  - providesOwnLoop=false + isRunning()=true
  - isRunning() throws (error path)

## Sim loop / simulateStep contract

- `simulateStep(state, dtSeconds, bounds)` mutates `state` in-place and may append visual-only events (e.g., `state.explosions`).
- The simulation must be deterministic when the seeded RNG is used (`srand(seed)`).
- Use a fixed-step simulation (default ~16 ms / 60 Hz). Large dt should be clamped and processed as multiple fixed steps.

Tests to add:

- Determinism test: seed the RNG, run N steps, and compare snapshots.
- Edge cases: very large dt, empty entity lists.

## Renderer contract (modular)

Minimal API:

- `createRenderer(canvas, opts) -> renderer`
- `renderer.init()` -> boolean
- `renderer.renderState(state, interpolationAlpha?)`
- `renderer.start()` (optional)
- `renderer.stop()`
- `renderer.providesOwnLoop` (boolean)
- `renderer.isRunning()` -> boolean

Rules:

- Renderer must not mutate simulation state. It may consume visual-only arrays for display but must not alter values used by simulateStep.

Tests to add:

- Unit test that calls `renderState` with a snapshot and asserts no mutation occurred.

## Canvas2D fallback renderer

- Implements same contract as other renderers. Integration or Playwright smoke tests should validate expected primitives for a small snapshot.

## WebGL2 renderer and pooling

- The typed `WebGLRenderer` should route texture creation through `GameState.assetPool` using pooling helpers (e.g., `acquireTexture(factory, key, disposer)`) when a `GameState` is present. If no `GameState` is available, renderer falls back to direct create/delete.

Pooling acceptance criteria:

- Acquire/release helpers must prevent double-free, respect per-key `max` and `strategy` (`discard-oldest`, `grow`, `error`), and invoke `disposer` when trimming.

Tests to add:

- Unit tests with the deterministic GL stub to assert create/delete counts and that disposers are invoked on trimming.
- Playwright/headless smoke test for a real WebGL lifecycle.

## RNG (seeded)

- Use `srand(seed)` for simulation determinism. Rendering may use non-deterministic randomness unless deterministic replay is required.

## Entities & configs

- All gameplay and visual tunables live under `src/config/*`. Avoid hard-coded values in logic.

## Implementation priorities

1. Per-key overflow + disposer tests (high): add unit tests for `discard-oldest`, `grow`, and `error`; set explicit `max` for high-churn keys.
2. Real-GL smoke test (medium): Playwright/headless test exercising create/release lifecycle.
3. Migrate one visual to renderer-owned pooling (low): e.g., explosion effects with an integration test.
4. CI & lockfile updates (low): ensure `happy-dom` and new tests run in CI.

## Validation & QA

- Run `npx tsc --noEmit` and the Vitest suite locally before PRs.
- Add deterministic simulateStep tests seeded via `srand` and compare snapshots.

## Files to update

- `src/webglrenderer.ts` — ensure pool usage with safe fallback.
- `src/entities.ts` — pooling helpers (already implemented).
- `test/vitest/utils/glStub.ts` — used for deterministic lifecycle tests.
- `test/*` — add sim determinism and per-key overflow tests.

---

End of spec.

