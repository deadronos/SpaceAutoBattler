# TASK302 - Split Progression into XP / Leveling / Events modules

**Status:** In Progress
**Added:** 2025-10-27
**Updated:** 2025-10-27

## Original Request

Refactor `src/game/progression.ts` into smaller modules: `xp.ts`, `leveling.ts`, `events.ts`, and provide an `index.ts` shim to re-export the public API. See `DESIGN202-refactor-progression-split.md`.

## Thought Process

- Splitting reduces cognitive load and enables focused tests. Keep a temporary shim so other modules aren't broken mid-migration.
- Ensure pure computation functions are isolated from mutation to make unit tests deterministic.

## Implementation Plan

1. Create these files under `src/game/progression/`:
   - `xp.ts` (awardDamageXp, awardKillXp, pure xp calculation helpers)
   - `leveling.ts` (checkLevelUp, applyLevelUpBonuses, createLevelBonusState)
   - `events.ts` (appendCappedHistory, addProgressionEvent wrapper)
   - `index.ts` re-exporting public API
2. Add unit tests for each piece:
   - `test/progression/xp.spec.ts`
   - `test/progression/leveling.spec.ts`
   - `test/progression/events.spec.ts`
3. Update `src/game/progression.ts` to re-export from `progression/index.ts` and gradually update callers.
4. Run typecheck and tests; fix any typing or import regressions.

## Subtasks

| ID | Description | Status | Updated | Notes |
| --- | --- | --- | --- | --- |
| 3.1 | Create `xp.ts`, `leveling.ts`, `events.ts`, `index.ts` | not-started | 2025-10-27 | Keep `progression.ts` as a shim initially |
| 3.2 | Add tests for each new module | not-started | 2025-10-27 | Tests to ensure parity with original behaviour |
| 3.3 | Update imports and remove legacy code | not-started | 2025-10-27 | After tests pass, remove duplicates from old file |
| 3.4 | Run full test suite and review coverage | not-started | 2025-10-27 | Validate no regressions |

## Progress Log

### 2025-10-27
- Created `DESIGN202` and TASK302. Ready to scaffold modules and tests.

## Acceptance Criteria

- All new modules have unit tests and cover critical behavior.
- Existing call sites continue working via `progression` shim or direct imports; full test suite green.
