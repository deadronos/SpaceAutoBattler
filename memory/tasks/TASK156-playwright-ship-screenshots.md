# [TASK156] - Validate Playwright ship screenshots harness & CI integration

**Status:** In Progress
**Added:** 2025-12-15
**Owner:** TBD

## Original Request

Validate the Playwright ship hull visual regression PoC, generate initial baselines for representative hulls, and add a CI job to run a representative subset of ship screenshot tests on PRs and a nightly full-hull baseline run.

## Thought Process

- The Playwright harness PoC (test page `test/playwright/pages/ship-renderer.js`, `ship-hulls.spec.ts`, and `shield-visual-baseline.spec.ts`) exists and implements `window.__TEST__` with `setOptions` for dynamic updates.
- A baseline generation helper script (`scripts/generate-playwright-baselines.ts`) is present but baselines are not committed / not fully validated yet.
- Add CI integration and documentation to make this reproducible for developers and to surface regressions on PRs.

## Requirements (EARS)

1. WHEN running the baseline generator locally, THE SYSTEM SHALL produce deterministic per-hull images for the representative hull set. _Acceptance:_ `npm run generate-baselines` completes for `fighter|frigate|carrier` and writes PNGs to `test/playwright/baselines`.

2. WHEN running the Playwright ship suite on CI for a PR, THE SYSTEM SHALL run a representative subset (fighter, frigate, carrier) using software GL (`--use-gl=swiftshader`) and fail when diffs exceed configured tolerances. _Acceptance:_ A GitHub Actions job `playwright-ship-screenshots` exists and passes on a baseline-matching branch and fails when a purposely modified baseline is introduced.

3. WHEN baselines change intentionally, THE SYSTEM SHALL provide a clear update workflow in `test/playwright/README-ship-tests.md` describing how to generate, review, and commit baseline updates. _Acceptance:_ README contains exact commands and an example PR workflow.

## Implementation Plan

1. Local validation & PoC hardening (owner: TBD) — (In Progress)
   - Run `npm run build && npm run serve &` then `npm run generate-baselines` for `fighter|frigate|carrier` locally.
   - Validate `test/playwright/shield-visual-baseline.spec.ts` and `test/playwright/ship-hulls.spec.ts` run locally in headed mode to inspect failures.
   - Capture and commit initial baselines for the representative subset (maintain small images, sensible commit message).

2. CI job & gating (owner: TBD) — (Not started)
   - Add `playwright-ship-screenshots` GitHub Actions job to run the Playwright subset with flags: `--project=chromium`, headless, `--browser-args='--disable-gpu --use-gl=swiftshader'`, and artifact collection on failure.
   - Limit concurrent workers to 1–2 to reduce flakiness.

3. Documentation & baseline workflow (owner: TBD) — (Not started)
   - Update `test/playwright/README-ship-tests.md` with a concise baseline generation & commit flow.
   - Add a short PR checklist for visual changes (review images, link images in PR, supply before/after if possible).

4. Harden tests & tolerances (owner: TBD) — (Not started)
   - Add per-hull tolerance configuration and a `test/playwright/hull-tolerances.json` if necessary.
   - Adjust `ship-hulls.spec.ts` to prefer scene-introspection for fast guards and limit pixel diffs to representative subset only.

5. Nightly full-hull run (owner: TBD) — (Not started)
   - Add a nightly job to run the full hull suite and either 1) upload artifacts or 2) write a comparison report to S3-like storage (opt-in in future).

## Progress Tracking

**Overall Status:** In Progress — 20%

### Subtasks

| ID  | Description                                     | Status      | Updated    | Notes                                  |
| --- | ----------------------------------------------- | ----------- | ---------- | -------------------------------------- |
| 1.1 | Run PoC locally & generate baseline images      | In Progress | 2025-12-15 | Start with `fighter, frigate, carrier` |
| 1.2 | Commit selected baselines and document workflow | Not Started |            | Ensure PR checklist is concise         |
| 1.3 | Add CI job for PR-level subset                  | Not Started |            | Use software GL for determinism        |
| 1.4 | Add nightly full-hull job                       | Not Started |            | Optional advanced step                 |
| 1.5 | Add per-hull tolerance config                   | Not Started |            | Optional hardening                     |

## Acceptance Criteria

- [ ] `npm run generate-baselines` completes and produces PNGs for the representative subset.
- [ ] `npx playwright test test/playwright/ship-hulls.spec.ts --project=chromium` passes locally for the representative subset.
- [ ] `playwright-ship-screenshots` GitHub Actions job exists and runs deterministically in the PR pipeline (failing on divergences).
- [ ] README updated with baseline generation & update workflow.

## Related

- Design: `memory/designs/DESIGN019-ship-mock-test.md`
- Script: `scripts/generate-playwright-baselines.ts`
- Tests: `test/playwright/ship-hulls.spec.ts`, `test/playwright/shield-visual-baseline.spec.ts`

```

```
