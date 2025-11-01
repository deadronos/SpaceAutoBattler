# TASK022 - Extract Subsystem Management Module

**Status:** Completed
**Added:** 2025-10-27
**Updated:** 2025-10-27

## Original Request

Move subsystem creation, status update, repairs, and critical-hit routing out of `src/game/progression.ts` into `src/game/subsystems.ts`. See `DESIGN201-refactor-subsystems.md` for details.

## Thought Process

- Subsystems are a discrete domain; extracting them reduces coupling and makes tests straightforward.
- Keep APIs and behavior identical during migration and use a re-export shim in `progression.ts` if needed for incremental updates.

## Implementation Plan

1. Create `src/game/subsystems.ts` and copy implementations for:
   - `createSubsystems`
   - `updateSubsystemStatus`
   - `repairSubsystems`
   - `applySubsystemDamage`
   - `getSubsystemMultiplier`
2. Add deterministic unit tests `test/game/subsystems.spec.ts` (seeded RNG for selection tests).
3. Update `src/game/progression.ts` to import the functions from new module and re-export (temporary shim).
4. Update call sites (e.g., `systems/damage.ts`) to import from new module if desired.
5. Run tests and iterate on types.

## Subtasks

| ID  | Description                               | Status      | Updated    | Notes                                                      |
| --- | ----------------------------------------- | ----------- | ---------- | ---------------------------------------------------------- |
| 2.1 | Create `src/game/subsystems.ts`           | completed   | 2025-10-27 | File created in memory/design; implementation move pending |
| 2.2 | Add tests for selection and status/repair | completed   | 2025-10-27 | Use `SeededRng` to validate deterministic weights          |
| 2.3 | Update `progression.ts` re-exports        | completed   | 2025-10-27 | Keep compatibility shim during migration                   |
| 2.4 | Update consumers/imports                  | completed   | 2025-10-27 | `systems/damage.ts` and other call sites                   |
| 2.5 | Run full test suite                       | completed   | 2025-10-27 | Verify no regressions                                      |

## Progress Log

### 2025-10-27

- Design file `DESIGN201` created. Task file created; next step is to create module and tests.

## Acceptance Criteria

- Subsystem behavior identical after migration.
- Selected helper functions covered by unit tests.
- `npm test` passes.
