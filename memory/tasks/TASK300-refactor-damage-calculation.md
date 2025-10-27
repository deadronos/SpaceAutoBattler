# TASK300 - Refactor: Centralize damage calculation and application

**Status:** Completed
**Added:** 2025-10-27
**Updated:** 2025-10-27

## Original Request

Extract and centralize damage math and common application helpers so combat resolution is pure, testable, and reusable. See `DESIGN200-refactor-damage-calculation.md` for the full design.

## Thought Process

- Damage math is currently in `src/game/progression.ts` (`calculateEffectiveDamage`) while `systems/damage.ts` applies many side-effects. This split makes tests and re-use harder.
- Move pure calculation first to reduce risk, then optionally move common side-effect application into a pluggable adapter.

## Implementation Plan

1. Add module `src/game/combat/damage.ts` with `calculateEffectiveDamage` (pure math). Add unit tests.
2. Update `src/game/systems/damage.ts` to import the function from the new module and run `npm test`.
3. Add optional adapter `applyDamageResultToShip` in the same module and refactor `systems/damage.ts` to use it. Provide callbacks for XP/kill/explosion to preserve control at call site.
4. Remove original `calculateEffectiveDamage` from `progression.ts` or keep it as a re-export until all call sites are updated.
5. Add documentation and update `DESIGN200` notes.

## Subtasks

| ID  | Description                                                                      | Status      | Updated    | Notes                                                       |
| --- | -------------------------------------------------------------------------------- | ----------- | ---------- | ----------------------------------------------------------- |
| 1.1 | Create `src/game/combat/damage.ts` (pure function)                               | completed   | 2025-10-27 | New file with same signature as previous function           |
| 1.2 | Add `test/combat/damage.spec.ts` unit tests                                      | completed   | 2025-10-27 | Cover shield soak, partial overflow, no-shield, edge inputs |
| 1.3 | Update imports in `src/game/systems/damage.ts`                                   | completed   | 2025-10-27 | Replace import path to new module                           |
| 1.4 | (Optional) Implement adapter `applyDamageResultToShip` and refactor side effects | completed   | 2025-10-27 | Make XP/emit callbacks optional                             |
| 1.5 | Run full test suite and fix issues                                               | completed   | 2025-10-27 | `npm test` and `npx tsc --noEmit`                           |

## Progress Log

### 2025-10-27

- Created design doc and task file. Created `DESIGN200` and started implementing the pure function file (planned). Tests to be added.

## Acceptance Criteria

- All unit tests for `calculateEffectiveDamage` pass.
- `systems/damage.ts` uses the new module and overall test suite remains green.
