# AI Controller Throttle & Debug — Handover

## Context at a glance

- Repo: SpaceAutoBattler
- Branch: ai-passive-fix (base: main)
- Date: 2025-09-15
- Goal: Centralize all writes to `ship.targetId` behind an AIController throttling mechanism respecting `simConfig.targetUpdateRate`, add deterministic test-time logging, and ensure damage-decay behavior for evade logic.

## What changed (high level)

- Central throttling added around target assignments:
  - Core setter `setTargetWithThrottle(ship, newId)` in `src/core/ai/controller.ts`.
  - Public wrapper `setShipTargetWithThrottle()` for external callers (e.g., `gameState` restoration paths).
  - Semantics: block non-null target switches inside `targetUpdateRate`; allow clear-to-null; first-ever null→non-null allowed; outside-window switches allowed.
- Deterministic test logging:
  - `src/utils/testDebug.ts` provides `writeTestLogLine()`; enabled under `NODE_ENV=test` or `VITEST_AI_DEBUG=1`.
  - Logs written to `tmp/ai-debug.log`, `tmp/ai-throttle.log`, and a first-tick summary `tmp/ai-firsttick.log`.
- Recent damage decay:
  - Implemented per-tick decay of `ship.aiState.recentDamage` using `behaviorConfig.globalSettings.damageDecayRate` in `AIController.updateShipAI()`.
- Throttle anchoring:
  - One-time end-of-update anchors for both non-null and null targets to stabilize within-window behavior at tick boundaries.

## Key files touched

- `src/core/ai/controller.ts` — throttle setter, AI update flow, damage decay, anchors, deterministic logs.
- `src/core/gameState.ts` — uses controller wrapper to restore AI-assigned targets; preserves throttle semantics.
- `src/utils/testDebug.ts` — buffered test-time logging without blocking, auto-flush on `beforeExit`.
- Tests referenced: `test/vitest/ai-throttle.spec.ts`, `test/vitest/ai-evade.spec.ts`.

## Current status

- ai-evade: PASS (decay behavior verified by tests).
- ai-throttle: 1 failing assertion remains in "ship target switching obeys targetUpdateRate" (inside-window stability). The check expects `red.targetId` to remain `initialTarget` or `null` within the window after introducing a closer enemy.

## How to reproduce and validate

- Type check and run targeted tests (PowerShell):

```powershell
npm run typecheck
$env:NODE_ENV='test'; $env:VITEST_AI_DEBUG='1'; npx vitest test/vitest/ai-throttle.spec.ts test/vitest/ai-evade.spec.ts --run
```

- Inspect deterministic logs (created during tests):
  - `tmp/ai-debug.log` — per-ship start/end lines, movement calls, spawn anchors.
  - `tmp/ai-throttle.log` — throttle decisions: first-assign, block, clear, assign outside window.
  - `tmp/ai-firsttick.log` — one-line summaries of first update per ship.

## Behavioral contracts to preserve

- Canonical state: All runtime state lives on `GameState` (`src/types/index.ts`).
- Determinism: All simulation logic must use seeded RNG (`src/utils/rng.ts`).
- Throttle semantics:
  - Inside `targetUpdateRate`: disallow non-null switches; allow clearing to `null`.
  - First-ever assignment (no recorded switch time) from `null` is allowed.
  - One-time end-of-update anchors for both `null` and non-`null` target states.
- Do not introduce module-level mutable state outside `GameState`.

## Open issue (focus for next agent)

- Symptom: In `ai-throttle.spec.ts` → "ship target switching obeys targetUpdateRate", the inside-window stability assertion fails after adding a closer enemy and stepping < `targetUpdateRate`.
- Likely cause: A code path still assigns a non-`null` target within a window that began with an anchored `null` state (e.g., via nearest-enemy or safety/turret-propagation fallback) before the window elapses.
- Minimal fix direction:
  - In `setTargetWithThrottle`, strengthen the gate for `current == null && newId != null` when the last switch time was explicitly anchored from a `null` end-of-update: block until the window elapses (except for true first-ever assignment, where `lastTargetSwitchTime` is not set).
  - Audit secondary assignment paths that call `setTargetWithThrottle` when `ship.targetId` is currently `null` (nearest enemy, safety from turret consensus, fallback scoring) to ensure they rely solely on the central throttle (no direct writes).

## Next actions (ordered)

1. Re-run the failing spec with logs enabled and confirm an attempted `null -> non-null` inside the window in `tmp/ai-throttle.log`.
2. Update `setTargetWithThrottle` to treat a recently anchored `null` baseline as a real window start (block `null -> non-null` until `rate` has elapsed, unless it's the true first-ever assignment).
3. Re-run `ai-throttle.spec.ts` to confirm green; keep `ai-evade.spec.ts` passing.
4. Quick grep to verify no stray `ship.targetId =` writes bypass the wrapper (gameState restoration already uses the wrapper).
5. Run `npm test` for broader regression.

## Acceptance criteria (definition of done)

- All ai-throttle and ai-evade tests pass deterministically without flakes.
- No direct writes to `ship.targetId` remain outside `AIController` except unavoidable legacy cases, which must be justified and documented.
- Throttle semantics remain consistent with spec and comments above.

## Risks and notes

- Over-anchoring can suppress legitimate first acquisitions; the code already allows a true first-ever `null -> non-null`. Keep that intact.
- Ordering-sensitive behavior (turret target vs ship-level target) is tolerated by tests with permissive assertions; avoid tightening behavior in ways that remove that tolerance.
- Maintain deterministic logging and avoid introducing async nondeterminism in the simulation path.

## Reference snippets and locations

- Throttle setter: `src/core/ai/controller.ts` → `setTargetWithThrottle()`.
- Public wrapper: `AIController.setShipTargetWithThrottle()`.
- Anchors (end-of-update): same file, at the end of `updateShipAI()`.
- Logging helper: `src/utils/testDebug.ts`.
- Test specs: `test/vitest/ai-throttle.spec.ts`, `test/vitest/ai-evade.spec.ts`.

## Optional follow-ups (post-green)

- Add a small unit test specifically for the anchored-null window behavior to prevent regressions.
- Expand debug logging guard to include a per-test-session UUID in filenames if parallelizing tests in future.
- Consider consolidating throttle-related logs under a single structured file for easier CI artifact analysis.
