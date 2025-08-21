# Implementation status: spec -> src mapping

This file maps the design spec files in `spec/` to the current implementation under `src/` and lists which parts are implemented, partially implemented, or missing. It also contains ready-to-paste PR descriptions for a prioritized sequence of changes to reach full spec parity.

## Overview

- Core contract implemented: seeded RNG, deterministic simulation entry points, `simulateStep(state, dt, bounds)` event emission contract (explosions, shieldHits, healthHits), Canvas renderer that consumes numeric events and draws effects.
- Recent work (this branch): deterministic star generation (seeded), programmatic starfield pre-render (offscreen `starCanvas` with `_version` guarding), WebGL streaming / instancing plumbing (partial), and Playwright global listeners that capture console/pageerror logs, screenshots and traces on failure.
- Major missing / partial items: full WebGL renderer parity and polishing, progressionConfig wiring and tests, deterministic cannon system, gamemanager strategy hooks.

---

## Spec -> Implementation

- spec/spec-design-rng.md -> src/rng.js — Done

  - srand, srandom, srange, srangeInt implemented. Deterministic LCG used.

- spec/spec-design-entities.md -> src/entities.js — Partial

  - Ship/Bullet factories, basic HP/shield/damage, pickTarget, spawnFleet present.

  - Missing: detailed cannon subsystem, progressionConfig linkage, full carrier/fighter pooling. Class-based exports (Ship/Bullet) are partially present; API parity still needs finishing.

- spec/spec-design-simulate.md -> src/simulate.js — Done (core) / Partial (advanced)

  - simulateStep implemented: advances ships & bullets, collision detection, XP awarding, event emission. Advanced features (replay streaming) are not implemented.

- spec/spec-design-gamemanager.md -> src/gamemanager.js — Partial

  - Manager arrays, reset(seed), simulate wrapper, particle pooling, event TTLs, config object implemented.

  - Recent additions: deterministic `initStars()` (seeded), `createStarCanvas()` pre-render with version guard, and tie-ins so renderers can use the pre-rendered `state.starCanvas`.

  - Missing: strategy hooks, diagnostic hooks, configurable reinforcement strategies.

- spec/spec-design-renderer.md -> src/renderer.js — Done (basic) / Partial (advanced)

  - Canvas renderer implemented, consumes flashes/particles, deterministic visuals, `renderOnce` exposed for tests.

  - Recent work: canvas renderer will use `state.starCanvas` when available (faster draw), and twinkle metadata is updated deterministically in the simulation wrapper so visuals stay seed-deterministic.

  - Missing: performance optimizations beyond current pre-rendering, atlas-based batching (optional).

- spec/spec-design-webgl-renderer.md -> src/webglRenderer.js — Partial / In-progress

  - WebGL renderer has partial streaming-instancing implementation on branch `webgl-streaming-instancing`:
    - Streaming instance buffer support, per-instance alpha written for twinkle animation.
    - Guarded starfield texture uploads using pre-rendered canvas `_version` to avoid redundant uploads.
    - Cached fullscreen quad VBO implemented.
  - Remaining work: complete shader/uniform/attribute location caching, finish all instanced draw paths and fallback paths, add smoke tests to verify WebGL path in Playwright.

---

## Prioritized PRs (ready-to-paste descriptions)

Below are the PR descriptions (title + body) for each proposed PR in order of priority. Paste the body into GitHub when you open a PR. Each PR is intentionally small and reversible.

### PR 1 — feat(rng): make simulation & visuals fully deterministic

#### PR 1 — Title

feat(rng): use seeded RNG everywhere for deterministic simulation & visuals

#### PR 1 — Description

This PR ensures full determinism across the simulation and renderer by replacing remaining uses of `Math.random()` with the seeded RNG (`srandom`, `srange`) and ensuring the manager is seeded at startup. This is foundational: deterministic replays and reliable unit tests depend on it.

#### PR 1 — What changed

- Replace `Math.random()` uses in `src/simulate.js` and `src/renderer.js` with `srandom()` / `srange()` from `src/rng.js`.
- Ensure `GM.reset(DEFAULT_SEED)` is called by default at startup (via `src/main.js`) so runs are repeatable.
- Add `renderOnce` helper to `createCanvasRenderer` to allow deterministic single-frame rendering in tests.

#### PR 1 — How to test

- `npm test` (unit tests will seed RNG and assert deterministic expectations).
- Manual: open UI, verify identical behavior after calling `GM.reset(seed)` with the same seed.

#### PR 1 — Risks & mitigations

- Low risk. Changes are mechanical and have existing tests; update tests if they relied on nondeterminism.

#### PR 1 — Commit message

feat(rng): use seeded RNG everywhere to guarantee deterministic simulation & visuals

---

### PR 2 — feat(progress): add progression config and wired level ups

#### PR 2 — Title

feat(progress): add `src/progressionConfig.js` and wire deterministic progression rules

#### PR 2 — Description

Centralizes XP and per-level stat scaling into `src/progressionConfig.js` and updates `Ship.gainXp`/`applyLevel` to use these constants. This makes progression deterministic, testable, and easy to tweak.

#### PR 2 — What changed

- Add `src/progressionConfig.js` (XP per damage/kill, HP/damage/shield per level).
- Update `src/entities.js` to consult progressionConfig when invoking `applyLevel`.
- Add unit tests in `test/progression.test.js` covering level thresholds and stat application.

#### PR 2 — How to test

- `npm test` — new tests assert level-ups and stat increases.

#### PR 2 — Risks & mitigations

- Low to medium. Numerical tuning only; unit tests will catch regressions.

#### PR 2 — Commit message

feat(progress): add progressionConfig and wire Ship.gainXp/applyLevel

---

### PR 3 — feat(entities): export Ship/Bullet classes and stable API

#### PR 3 — Title

feat(entities): export `Ship` and `Bullet` classes and `Team` enum for API parity

#### PR 3 — Description

Add class-based public exports for `Ship` and `Bullet` matching the API shape expected by downstream code and external tests. Keep existing factory helpers for backward compatibility.

#### PR 3 — What changed

- Modify `src/entities.js` to export `class Ship` and `class Bullet` as well as `createShip`/`createBullet` wrappers.
- Export `Team` enum and `spawnFleet` helper.
- Add tests confirming class exports and basic behavior.

#### PR 3 — How to test

- `npm test` — ensure tests referencing classes succeed.

#### PR 3 — Risks & mitigations

- Medium risk (API surface change). Provide backward compatible wrappers and bump tests accordingly.

#### PR 3 — Commit message

feat(entities): export Ship/Bullet classes and Team enum

---

### PR 4 — feat(cannon): deterministic cannon system & firing schedules

#### PR 4 — Title

feat(cannon): implement deterministic cannon cooldowns and bullet creation

#### PR 4 — Description

Replace probabilistic shooting with a deterministic per-cannon cooldown model. Cannons hold rate/dmg/spread and create bullets only when cooldown reaches zero. This ensures consistent behavior across runs and easier testing.

#### PR 4 — What changed

- Add cannon structure to `Ship` (rate, cooldown, dmg, spread).
- Update `src/simulate.js` to tick cannon cooldowns and create bullets deterministically using seeded RNG for spread.
- Add unit tests for cannon cooldown behavior and bullet creation.

#### PR 4 — How to test

- `npm test` — new tests assert cannon firing timing and bullet properties.

#### PR 4 — Risks & mitigations

- Medium risk (changes gameplay timing). Tests will catch timing regressions.

#### PR 4 — Commit message

feat(cannon): implement deterministic cannon cooldown & firing

---

### PR 5 — feat(gamemanager): add strategy hooks & diagnostics

#### PR 5 — Title

feat(gamemanager): add strategy registration, diagnostics and reinforcement config

#### PR 5 — Description

Expose `registerStrategy(name, fn)`, `setDiagnostics(enabled)` and richer reinforcement configuration so higher-level game modes can be injected by tests or UI.

#### PR 5 — What changed

- `src/gamemanager.js`: add strategy registry and simple diagnostics interface.
- Add tests verifying registration and invocation of strategies.

#### PR 5 — How to test

- `npm test` — strategy hook tests.

#### PR 5 — Risks & mitigations

- Medium risk. Keep strategy execution sandboxed and opt-in.

#### PR 5 — Commit message

feat(gamemanager): add strategy hooks and diagnostics

---

### PR 6 — feat(webgl): add optional instanced WebGL renderer

#### PR 6 — Title

feat(webgl): add optional instanced WebGL renderer with DPR clamp and atlas support

#### PR 6 — Description

This PR implements a WebGL renderer that performs instanced draws for ships/bullets and supports atlas texture uploads, DPR clamping, and streaming buffer updates. The Canvas renderer remains available as a fallback.

#### PR 6 — What changed

- Add `src/webglRenderer.js` fully implementing `createWebGLRenderer(canvas, opts)` per the spec.
- Detect available WebGL context and prefer it at runtime when enabled.
- Add smoke tests for API shape and a Playwright smoke test to verify page loads with WebGL enabled.

#### PR 6 — How to test

- `npm test` (unit API tests)
- Playwright smoke test (CI): `npm run test:playwright`

#### PR 6 — Risks & mitigations

- High risk (graphics code, platform differences). Implement incrementally and keep canvas fallback.

#### PR 6 — Commit message

feat(webgl): add instanced WebGL renderer with DPR clamping and atlas

---

### PR 7 — docs: map spec to implementation and add reproduction guide

#### PR 7 — Title

docs(spec): add IMPLEMENTATION_STATUS.md and reproducible-run guide

#### PR 7 — Description

Adds `spec/IMPLEMENTATION_STATUS.md` (this file) and short instructions for deterministic runs and replay testing.

#### PR 7 — What changed

- Add `spec/IMPLEMENTATION_STATUS.md` mapping spec files to `src/` and listing PR plan.

#### PR 7 — How to test

- Visual inspection; no runtime changes.

#### PR 7 — Commit message

docs(spec): add implementation status and PR plan

---

## Next steps

1. Create a branch `spec/parity-implement` from `webgl` or `main` and implement PR 1 (determinism) first.
2. Open PR 1 with the description above and run tests/CI.
3. Iterate down the PR list, keeping PRs small and tested.

If you want I can implement PR 1 now in this workspace and run the tests — say "Start PR 1" and I'll apply the changes and run the suite.

---

## Outstanding todos & verification

The work in this branch has progressed beyond the original doc. Below are the current high-priority tasks, their purpose, and quick verification steps.

- Diagnose missing crash-dumps (HIGH)
  - Purpose: Ensure Playwright global listeners reliably persist crash dumps (logs, screenshots, traces) to `playwright-report/crash-dumps` (or a fallback) when a test fails or a page crashes.
  - Status: In-progress. Instrumentation added to `test/playwright/playwright-global-listeners.js` to write verbose markers and fallback to `os.tmpdir()`.
  - Verify: Run a single failing Playwright test and check for written files. Example command:

```powershell
npx playwright test test/playwright/temp.fail.test.js -c playwright.config.cjs --reporter=list -j 1
Get-ChildItem -Path .\playwright-report\crash-dumps -File -Recurse -ErrorAction SilentlyContinue
```

- Remove temporary failing test (MEDIUM)
  - Purpose: Cleanup once crash-dump persistence verified.
  - Status: Not started. File: `test/playwright/temp.fail.test.js`.

- Add twinkle determinism unit test (MEDIUM)
  - Purpose: Prevent regressions to seeded star twinkle behavior.
  - Suggested test: seed RNG, call `initStars()`, step `simulate` N frames, assert per-star alphas are identical on re-seed.

- Sweep remaining Math.random() usages (LOW)
  - Purpose: Complete PR 1 — ensure `srandom()` is used everywhere for determinism.
  - Verify: `git grep "Math.random"` and replace relevants with `srandom()` or `srange()`.

When the above are complete, remove debug marker writes from the global listener and verify the full test suite (`npm test` + `npx playwright test`) passes in CI.

---

If you'd like, I can run the failing Playwright test now and iterate until crash dumps are reliably produced; say "Run failing test" and I'll execute it and report the exact file paths and console logs.
