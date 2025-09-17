# [TASK102] - Implement Visual Interpolation Feature

**Status:** In Progress  
**Added:** 2025-09-17  
**Updated:** 2025-09-17

## Original Request

Follow the plan in plan/feature-interpolation-renderer-1.md to implement visual interpolation between simulation steps for smooth rendering. Create/update tasks in /memory/tasks as you go.

## Thought Process

The provided plan (feature-interpolation-renderer-1.md) outlines a multi-phase implementation for adding visual interpolation to the SpaceAutoBattler renderer. This feature requires extending entity types, capturing previous states in the simulation worker, implementing interpolation in the renderer, and adding tests/documentation. To track progress persistently, create this task file with subtasks mirroring the plan's TASK-00X items. Implementation will proceed phase-by-phase, updating progress here and using session todo lists for immediate steps. Ensure all changes adhere to repository guidelines: edit only /src TypeScript, maintain canonical GameState, preserve determinism.

## Implementation Plan

- Break into 4 phases as per the plan: Type extensions, State capture, Renderer interpolation, Tests/docs.
- Proceed sequentially, validating each phase with typecheck and tests.
- Use existing configs and patterns (e.g., simConfig.tickRate, asset pooling).

## Progress Tracking

**Overall Status:** In Progress - 75%

### Subtasks

| ID    | Description                                                                                                                            | Status        | Updated     | Notes                |
|-------| ---------------------------------------------------------------------------------------------------------------------------------------|---------------|-------------|----------------------|
| 1.1   | TASK-001: In src/types/index.ts, add `prevPos: Vector3` to `Ship` and `Bullet` interfaces (make required).                             | Completed     | 2025-09-17  | Implemented; build types updated. |
| 1.2   | TASK-002: In src/types/index.ts, add `prevOrientation: Orientation` to `Ship` (match existing Orientation type).                       | Completed     | 2025-09-17  | Implemented on Ship. |
| 1.3   | TASK-003: Update factories/types helpers creating `Ship`/`Bullet` to initialize `prevPos` and `prevOrientation` to current values.     | Completed     | 2025-09-17  | Spawn/projectile creation paths initialize prev fields. |
| 1.4   | TASK-004: Update test fixtures/factories in test/vitest/** to include new required fields.                                             | In Progress   | 2025-09-17  | Most fixtures updated; 2 specs regressed (positions changed), 1 local mock missing prev fields. |
| 2.1   | TASK-005: In src/simWorker.ts, capture previous state at start of sim step (copy pos→prevPos, orientation→prevOrientation).            | Completed     | 2025-09-17  | Prev capture at top of step. |
| 2.2   | TASK-006: Ensure capture occurs before any mutations in the step.                                                                      | Completed     | 2025-09-17  | Verified by code review and run. |
| 2.3   | TASK-007: Verify spawn paths initialize prev fields correctly.                                                                         | Completed     | 2025-09-17  | New entities set prev=current. |
| 3.1   | TASK-008: In renderer, compute alpha = clamp(elapsedWithinStep / fixedDt, 0, 1) using simConfig.tickRate.                              | Completed     | 2025-09-17  | Uses simConfig.tickRate; clamped. |
| 3.2   | TASK-009: LERP ship positions from prevPos to pos using alpha.                                                                         | Completed     | 2025-09-17  | Implemented in renderer. |
| 3.3   | TASK-010: Interpolate ship orientations (SLERP if quaternion, linear if Euler).                                                        | Completed     | 2025-09-17  | Quaternion slerp used. |
| 3.4   | TASK-011: LERP bullet positions.                                                                                                       | Completed     | 2025-09-17  | Implemented; instancing path supported. |
| 3.5   | TASK-012: Ensure interpolation is renderer-only, no writes to GameState.                                                               | Completed     | 2025-09-17  | Render-only transforms. |
| 3.6   | TASK-013: Add optional rendererConfig.enableInterpolation toggle (default true).                                                       | Completed     | 2025-09-17  | Toggle added; default true. |
| 4.1   | TASK-014: Add unit tests for prev-state capture before mutation.                                                                       | Not Started   |             | Pending targeted unit test. |
| 4.2   | TASK-015: Add tests for spawn initialization (prev == current).                                                                        | Not Started   |             | Pending targeted unit test. |
| 4.3   | TASK-016: Add renderer-side test for alpha computation.                                                                                | In Progress   | 2025-09-17  | New interpolation.spec exists; failing due to GL stub (clearDepth) and minimal fixture. |
| 4.4   | TASK-017: Run full suite: typecheck and npm test; verify determinism.                                                                  | In Progress   | 2025-09-17  | Suite run: 6 failed, 142 passed; failures localized to test edits and deps. |
| 4.5   | TASK-018: Update docs/renderer-pipeline.md with interpolation note and link to plan.                                                   | Completed     | 2025-09-17  | Docs updated. |

## Progress Log

### 2025-09-17

- Created task file based on feature-interpolation-renderer-1.md plan.
- Subtasks mapped to plan's TASK-00X items.
- Ready to start Phase 1 implementation.

### 2025-09-17 (later)

- Phases 1–3 implemented:
  - Types extended: `prevPos` on Ship/Bullet; `prevOrientation` on Ship.
  - Spawn/projectile creation initialize prev fields.
  - Sim step prev-state capture runs before any mutations.
  - Renderer interpolates ships (LERP + SLERP) and bullets; toggle `rendererConfig.enableInterpolation` defaults to true.
- Tests/docs:
  - Many fixtures updated to include prev fields; docs/renderer-pipeline.md updated with an Interpolation section.
  - New `interpolation.spec.ts` added for alpha clamp and LERP/SLERP; currently failing due to missing `gl.clearDepth` in the WebGL stub and incomplete ship fixture.
  - Some existing specs regressed due to unintended position changes during fixture updates:
    - `boundary-cleanup.spec.ts`: bullet position changed; restore original OOB position and set `prevPos` to match.
    - `renderer-module-extraction.spec.ts`: expected TEST_DEFAULTS positions replaced; revert to original values and set matching `prevPos`.
    - `core-entities.spec.ts`: local `createMockShip` lacks `prevPos`/`prevOrientation`; update helper or reuse shared one.
- Test run summary (npm test): 6 failed, 142 passed. Build-system and uiStore specs failing due to `zustand` dependency/type issues (pre-existing).
- Next actions captured below.

## Follow-up Subtasks (Cleanup)

1. Fix regressed tests by restoring original semantics and only adding prev fields:
	 - boundary-cleanup.spec.ts: revert bullet position to original OOB value; set `prevPos` equal to `pos`.
	 - renderer-module-extraction.spec.ts: restore TEST_DEFAULTS-based position; set `prevPos` to `pos`.
	 - core-entities.spec.ts: add `prevPos` and `prevOrientation` to local mock or use shared factory.
2. Update WebGL stub in `test/vitest/setupTests.ts` to include `gl.clearDepth` (and any missing no-op methods encountered) to support new interpolation tests.
3. Decide on handling `zustand` issues for uiStore/build-system specs:
	 - Option A: add dev dependency/types for `zustand` (if allowed by test harness).
	 - Option B: mock ui store in tests or adjust build-system test to exclude ui store for type-only checks.
4. Re-run typecheck and full test suite; ensure deterministic tests remain green.
5. Add targeted unit tests for TASK-014 and TASK-015 (prev-capture timing and spawn initialization) using minimal pure-state fixtures to avoid renderer stubs.

Acceptance for cleanup: zero failing tests; typecheck passes; interpolation toggle verified.
