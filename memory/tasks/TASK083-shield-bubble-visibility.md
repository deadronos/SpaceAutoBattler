# TASK083 - Fix Missing Shield Bubble Rendering

**Status:** Completed
**Added:** 2025-02-14
**Updated:** 2025-02-14

## Original Request

Investigate reports that some ships show full shield bars in the HUD but do not render the protective shield bubble. Identify the root cause and implement a fix so visual shields always appear when shield capacity is available. Ensure full test suite passes.

## Thought Process

Initial hypotheses:

1. **Visibility Threshold:** The renderer may hide shields below a minimum fraction (e.g., <1%). If HUD displays full shields but renderer hides them, the threshold logic might misinterpret data (e.g., stale maxShield values, ratios >1). Need to inspect `Ship.tsx` shield rendering code.
2. **State Sync:** Entities may have `ship.shield` populated but `renderer` uses stale values or clamps differently. Confirm entity data path from simulation to renderer.
3. **Material Registration:** Ensure shield material is created/registered for affected hulls. Missing material fallback could prevent mesh creation.
4. **Geometry Scale:** If shield scale is zero or extremely small (due to config defaults), bubble may not be visible. Check per-hull `shieldScale` config.
5. **Culling/Visibility Flags:** Verify mesh visibility toggles or group filters aren't forcing invisibility.

Plan: reproduce issue via unit/integration tests or inspect game loop to confirm `ship.shield` and `ship.maxShield` values. Adjust renderer logic to ensure shields render whenever `maxShield > 0` and `shield > 0`, with sensible lower bounds and consistent scaling.

## Implementation Plan

- Review `Ship.tsx` shield mesh creation and visibility thresholds.
- Audit data flow from simulation to renderer to ensure `maxShield` stays positive and shield ratios clamp correctly.
- Add defensive logic ensuring shield mesh remains visible at reasonable shield fractions (e.g., avoid overly aggressive `minShieldThreshold`).
- Update related configuration or hooks to maintain consistency (e.g., ensure `shieldScale` defaults applied).
- Add regression tests covering cases with low but non-zero shields to ensure bubble renders.
- Validate using unit tests and targeted renderer tests if feasible.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                                       | Status   | Updated    | Notes                                   |
| --- | ------------------------------------------------- | -------- | ---------- | --------------------------------------- |
| 1.1 | Create task file and update tasks index           | Complete | 2025-02-14 |                                         |
| 1.2 | Investigate renderer shield visibility conditions | Complete | 2025-02-14 | Identified stale fraction state issue   |
| 1.3 | Implement fix ensuring shields render             | Complete | 2025-02-14 | Added reactive shield fraction tracking |
| 1.4 | Add regression tests for shield visibility        | Complete | 2025-02-14 | Updated heuristics to cover state sync  |
| 1.5 | Run full test suite                               | Complete | 2025-02-14 | `npx tsc --noEmit`, `npm test`          |
| 1.6 | Update task progress summary                      | Complete | 2025-02-14 | Documented resolution                   |

## Progress Log

### 2025-02-14

- Created task file capturing hypotheses and plan for missing shield bubble rendering.
- Pending: Deep dive into `Ship.tsx` shield visibility logic.

### 2025-02-14 (Later)

- Confirmed root cause: `ShieldBubble` calculated shield fraction only during initial render, so ships that spawned with depleted shields never re-rendered the bubble when shields regenerated.
- Added reactive shield fraction state with frame-level polling to detect visibility transitions and update material opacity.
- Updated static analysis specs to assert new state-based logic and guard against regressions.
- Ran `npx tsc --noEmit` and `npm test` — all 303 tests pass.
