# TASK107 — Hotpath main simulation loop improvements

**Status:** Completed  
**Added:** 2025-11-16  
**Updated:** 2025-11-16

## Original Request
Look at `DESIGN056` about hotpaths in the main simulation loop and create a `/memory/tasks` file to scope implementing the proposed improvements.

## Thought Process
- `memory/designs/DESIGN056-main-simulation-loop-perf.md` outlines the hot path: `BattlefieldSystems` driving `updateGame` with a fixed-step accumulator, profiling/guard helpers, and Rapier physics stepping. The doc already captures the requirements for safe defaults, profiling sampling, guard toggles, and substep clamping.
- The instructions say we must follow the spec-driven workflow and the Memory Bank structure, so the action item is to codify a task that covers gating profiling, disabling guards in production, and clamping `sim.maxSubSteps`, along with the related tests.
- Capturing this work as a task ensures downstream implementation and validation steps are tracked within the official memory bank (including test strategy and documentation updates).

## Implementation Plan
- Add new simulation configuration knobs on `GameState.simulation` (or a nearby config helper) for `profileSubsystems`, `profileSampleRate`, `enableSubsystemGuards`, and a documented `MAX_ALLOWED_SUBSTEPS`. Wire default values so production runs stay lean while debug builds can opt in.
- Refactor `src/game/systems.ts:updateGame` (and any helpers) to conditionally profile (`measureSubsystem`) only when sampling permits, to gate `runSafely` via a `runSubsystem` helper, and to clamp `sim.maxSubSteps` before it's consumed by `BattlefieldSystems`.
- Extend tests to cover the new flags: mock `performance.now()` to assert profiling invocations respect sampling, ensure guards propagate errors when disabled and capture snapshots when enabled, and verify the clamp prevents excessive substeps. Update docs/debug overlays to mention the new settings if applicable.

## Progress Tracking
**Overall Status:** Not Started - 0%

### Subtasks
| ID  | Description | Status | Updated | Notes |
| --- | ----------- | ------ | ------- | ----- |
| 1.1 | Review DESIGN056 requirements about profiling, guards, and substep bounds. | Complete | 2025-11-16 | Reference doc located at `/memory/designs/DESIGN056...`. |
| 1.2 | Draft this task plan and record dependencies (design, tests, docs). | Complete | 2025-11-16 | Task created to track follow-up work. |
| 1.3 | Implement config flags, conditionally profile/guard subsystems, clamp `maxSubSteps`, and add validation tests/docs. | Completed | 2025-11-16 | Implemented profiling/guard flags, clamp helper, and Vitest coverage (update-game-profiling.spec.ts + simulation-substeps.spec.ts). |

## Progress Log
### 2025-11-16
- Captured the user request, referenced DESIGN056, and confirmed that the hot path needs configurable profiling/guards plus substep clamping.
- Drafted this task file to sequence the remaining work, including configuration, updateGame refactor, and validation tests.
- Implemented the profiling toggle/sampling, guard gating, and substep clamp features across `createGameState`, `systems.ts`, and `BattlefieldSystems`; wired defaults and helper exports plus matching Vitest coverage (`update-game-profiling.spec.ts`, `simulation-substeps.spec.ts`).
- Ran `npm test -- test/vitest/update-game-profiling.spec.ts test/vitest/simulation-substeps.spec.ts` and verified both suites pass.
