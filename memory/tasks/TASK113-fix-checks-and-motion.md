# TASK113 - Fix typecheck gaps and motion hot path test

**Status:** Completed  
**Added:** 2025-11-17  
**Updated:** 2025-11-17

## Original Request

fix tests, linter and typecheck erros  
npm run test  
npm run lint  
npm run typecheck

## Requirements (EARS)

- WHEN type checking Vitest fixtures, THE SYSTEM SHALL provide GameState stubs that include required registries (e.g., `shipById`) so `npm run typecheck` completes without TS2352 structural errors. [Acceptance: `npm run typecheck` passes with no GameState casting errors.]
- WHEN running the motion hot path spec with a commanded ship and an idle ship, THE SYSTEM SHALL produce numeric velocity for the commanded ship while leaving the idle ship stationary. [Acceptance: `test/vitest/systems/motion/motion-system-hotpath.spec.ts` passes without NaN assertions.]
- WHEN executing the unit suite via `npm run test`, THE SYSTEM SHALL finish with zero failing specs. [Acceptance: vitest exits clean.]
- WHEN linting via `npm run lint`, THE SYSTEM SHALL remain clean after the fixes. [Acceptance: lint reports no new violations.]

## Thought Process

- Type errors indicate the shared GameState fixtures are missing the `shipById` registry expected by the `GameState` type; adding the map and populating it from test ships should resolve the casts.
- The motion hot path test yields `NaN` velocity because the fixture lacks motion stats (`linearAcceleration`, `linearDamping`, etc.); supplying minimal motion defaults will let `updateLinearMotion` compute finite velocity.
- After tightening fixtures, rerun typecheck, lint, and the full unit suite to confirm all checks are green.

## Implementation Plan

- [x] Align affected Vitest GameState fixtures with the `shipById` registry and ensure ship entities register into it.
- [x] Extend test ship motion defaults with acceleration, damping, and speed limits so motion math produces finite results.
- [x] Re-run `npm run typecheck`, `npm run lint`, and `npm run test` to verify the fixes.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                                                   | Status      | Updated    | Notes                                           |
| --- | ------------------------------------------------------------- | ----------- | ---------- | ----------------------------------------------- |
| 1.1 | Fix GameState fixtures to include `shipById` and registrations | Completed   | 2025-11-17 | Added maps + registration in AI, projectile, shield, turret, and explosion fixtures. |
| 1.2 | Add motion defaults to test ships to avoid NaN velocities      | Completed   | 2025-11-17 | Fixtures now use `createDefaultMotionStats` for finite motion math.                  |
| 1.3 | Re-run lint/typecheck/tests and record results                 | Completed   | 2025-11-17 | `npm run typecheck`, `npm run lint`, and `npm run test` all pass.                    |

## Progress Log

### 2025-11-17

- Recorded diagnostic results: `npm run typecheck` fails with missing `shipById` on several fixtures; motion hot path spec sees NaN velocity for commanded ship.
- Task created with requirements and plan.

### 2025-11-17 (update)

- Added `shipById` maps plus registration in AI doctrine/sensor, explosion, projectile, shield regen, and turret fixtures; filled simulation profiling flags to satisfy `GameState`.
- Swapped test ship motion to `createDefaultMotionStats` and updated hot-path test expectation to the two deferred physics mutations now enqueued.
- Verification: `npm run typecheck`, `npm run lint`, and `npm run test` all pass (Vitest outputs only legacy deprecation warnings from existing suites).
