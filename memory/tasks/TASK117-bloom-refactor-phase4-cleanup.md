# TASK117: BloomProvider Refactor Phase 4 — Cleanup and Documentation

**Status:** Completed  
**Created:** 2025-11-24  
**Completed:** 2025-11-25  
**Design:** [DESIGN061](../designs/DESIGN061-bloom-provider-refactor.md)  
**Estimated Effort:** 30 minutes  
**Priority:** Medium

## Original Request

Phase 4 of the BloomProvider refactoring: Final cleanup including creating the public index file, updating external imports, removing duplicate code, and updating documentation.

## Thought Process

This phase finalizes the refactor by:

1. Creating a clean public API via `index.ts`
2. Updating all external imports to use the new module path
3. Removing any remaining duplicate code
4. Documenting the layer allocation strategy for future maintainers
5. Updating the DESIGN061 status to Completed

This is mostly mechanical cleanup but important for maintaining a clean codebase.

## Implementation Plan

### Subtask 4.1: Create `index.ts` with public exports

- Export `BloomProvider` component
- Export `useBloomContext` hook
- Export `useBloomRegistration` hook
- Export `BloomRegistrationOptions` type
- Export `BloomContextValue` type
- Do NOT export internal utilities (layerAllocator, etc.)

### Subtask 4.2: Update external imports

- Search for imports from `'../renderer/BloomProvider.js'`
- Update to import from `'../renderer/bloom/index.js'`
- Verify all consumers updated

### Subtask 4.3: Move BloomProvider to bloom folder

- Move `src/renderer/BloomProvider.tsx` → `src/renderer/bloom/BloomProvider.tsx`
- Update internal imports
- Remove old file location

### Subtask 4.4: Remove duplicate code

- Delete any inline type definitions that were extracted
- Remove unused imports from BloomProvider
- Clean up any temporary compatibility shims

### Subtask 4.5: Update documentation

- Add JSDoc to exported functions in each module
- Document layer allocation strategy in `constants.ts` or separate README
- Update `src/renderer/bloom/AGENTS.md` with module overview

### Subtask 4.6: Update DESIGN061 status

- Mark design as Completed
- Update `memory/designs/_index.md`
- Record completion date

### Subtask 4.7: Final validation

- Run `npm run typecheck`
- Run `npm test`
- Run `npm run lint`
- Manual visual verification

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 4.1 | Create `index.ts` with public exports | Complete | 2025-11-25 | Clean public API |
| 4.2 | Update external imports | Complete | 2025-11-25 | 16 files updated |
| 4.3 | Move BloomProvider to bloom folder | Complete | 2025-11-25 | Relative imports updated |
| 4.4 | Remove duplicate code | Complete | 2025-11-25 | Old file deleted |
| 4.5 | Update documentation | Complete | 2025-11-25 | AGENTS.md comprehensive |
| 4.6 | Update DESIGN061 status | Complete | 2025-11-25 | Marked complete |
| 4.7 | Final validation | Complete | 2025-11-25 | 751 tests, lint clean |

## Progress Log

### 2025-11-25

- Created `src/renderer/bloom/index.ts` with public API exports
- Updated 16 external consumer files to use new `bloom/index.js` import path
- Moved `BloomProvider.tsx` to `src/renderer/bloom/` with relative imports
- Deleted old `src/renderer/BloomProvider.tsx`
- Updated `src/renderer/bloom/AGENTS.md` with comprehensive module documentation
- Updated `DESIGN061-bloom-provider-refactor.md` status to Completed
- Updated `memory/designs/_index.md` to move DESIGN061 to Completed section
- Final validation: `npm run typecheck` passes, 751 tests pass, lint clean

## Acceptance Criteria

- [x] `src/renderer/bloom/index.ts` exists with clean public API
- [x] All external imports updated to new path
- [x] `BloomProvider.tsx` moved to `src/renderer/bloom/`
- [x] No duplicate code remaining
- [x] Documentation updated with layer allocation strategy
- [x] DESIGN061 marked as Completed
- [x] `npm run typecheck` passes
- [x] `npm test` passes
- [x] `npm run lint` passes

## Files to Create/Modify

**Create:**

- `src/renderer/bloom/index.ts`
- `src/renderer/bloom/README.md` (optional, for layer strategy docs)

**Modify:**

- `src/renderer/bloom/BloomProvider.tsx` (move destination)
- `src/renderer/bloom/AGENTS.md` (update with module overview)
- `memory/designs/DESIGN061-bloom-provider-refactor.md` (status update)
- `memory/designs/_index.md` (move to Completed)
- Various consumer files (import path updates)

**Delete:**

- `src/renderer/BloomProvider.tsx` (after move)

## Dependencies

- [TASK114](TASK114-bloom-refactor-phase1-types-constants.md) — Phase 1 complete
- [TASK115](TASK115-bloom-refactor-phase2-pure-logic.md) — Phase 2 complete
- [TASK116](TASK116-bloom-refactor-phase3-provider.md) — Phase 3 complete

## Follow-up Tasks

- None (this completes the BloomProvider refactor)

## Notes

After this task is complete, the BloomProvider refactor (DESIGN061) is finished. Consider:

- Opening a follow-up for performance profiling if needed
- Evaluating whether colorWrite behavior should be configurable per-group
- Adding telemetry for layer allocation exhaustion (hitting layer 31)
