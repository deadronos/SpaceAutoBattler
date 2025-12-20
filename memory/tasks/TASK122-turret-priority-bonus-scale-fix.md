# TASK122 - Turret Priority Bonus Scale Fix

**Status:** Completed  
**Added:** 2025-12-12  
**Updated:** 2025-12-12

## Original Request

Ensure turrets prioritize targets according to configured preferences (antiFighter vs antiCapital) even when distance differences are small; avoid cases where a closer target of less-preferred hull type wins purely due to distance.

## Thought Process

Target scoring used squared distance as the primary metric without sufficient scaling of hull preference bonuses. For consistent behavior, hull-type bonuses must be scaled appropriately relative to distance squared so that, for example, an `antiFighter` turret will prefer a slightly more distant fighter over a close frigate.

## Implementation Plan

- Introduce a `bonusScale` constant that scales hull preference contributions to a comparable magnitude against squared distances.
- Adjust scoring logic in `src/game/systems/turrets.ts` to compute `score = distanceSq + bonus`, where `bonus` uses negative values for preferred hulls and positive for non-preferred hulls scaled by `bonusScale`.
- Add Vitest coverage (`test/vitest/turret-priority.spec.ts`) validating both near and far edge cases where hull preference dominates distance and vice-versa.
- Validate via `npm run typecheck` and `npm test`.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                                     | Status   | Updated    | Notes                                                   |
| --- | ----------------------------------------------- | -------- | ---------- | ------------------------------------------------------- |
| 1.1 | Add `bonusScale` and refactor score calculation | Complete | 2025-12-12 | Updated scoring to account for hull preference          |
| 1.2 | Add unit tests for priority cases               | Complete | 2025-12-12 | `test/vitest/turret-priority.spec.ts` added and passing |
| 1.3 | Validate with typecheck and unit suite          | Complete | 2025-12-12 | All tests and typecheck pass locally                    |

## Progress Log

### 2025-12-12

- Scoring updated to use a scaled bonus approach; integration tests validate both near & far edge cases. Typecheck and tests pass.

\*\*\* EOF
