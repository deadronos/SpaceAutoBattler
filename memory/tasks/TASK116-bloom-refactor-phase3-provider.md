# TASK116: BloomProvider Refactor Phase 3 — Refactor BloomProvider Component

**Status:** Pending  
**Created:** 2025-11-24  
**Design:** [DESIGN061](../designs/DESIGN061-bloom-provider-refactor.md)  
**Estimated Effort:** 1-2 hours  
**Priority:** Medium

## Original Request

Phase 3 of the BloomProvider refactoring: Rewrite the `BloomProvider.tsx` component to use the extracted modules, reducing it from ~350 LOC to ~100 LOC while maintaining identical behavior.

## Thought Process

With pure logic extracted in Phase 2, the React component becomes a thin orchestration layer. The refactored component should:

1. Manage refs for selections, object-group mapping, and allocator state
2. Delegate all logic to the extracted modules
3. Maintain the same public API (`useBloomContext`, `useBloomRegistration`)
4. Preserve the same visual behavior (critical for selective bloom)

Key risks:

- React effect ordering must match original behavior
- StrictMode double-effect handling must work correctly
- Registration/unregistration timing must be preserved

## Implementation Plan

### Subtask 3.1: Rewrite BloomProvider component

- Import all extracted modules
- Slim down to ~100 LOC orchestration
- Use extracted functions in callbacks:
  - `register()` → calls `saveLayerMasks`, `saveColorWriteState`, `addObjectToSelection`, etc.
  - `unregister()` → calls `restoreColorWriteState`, `restoreLayerMasks`, `removeObjectFromSelection`
- Preserve effect for `enabled` toggle synchronization
- Maintain context value structure

### Subtask 3.2: Preserve useBloomContext hook

- Keep existing implementation (simple useContext)
- No changes needed

### Subtask 3.3: Preserve useBloomRegistration hook

- Keep existing implementation
- Verify effect dependencies are correct

### Subtask 3.4: Add integration tests

- Test register/unregister round-trip restores original state
- Test enabled toggle syncs colorWrite correctly
- Test multi-group scenarios
- Test StrictMode double-effect behavior

### Subtask 3.5: Visual regression verification

- Take screenshot baseline before changes (if not already captured)
- Run visual comparison after refactor
- Verify bloom appearance unchanged

### Subtask 3.6: Validate

- Run `npm run typecheck`
- Run `npm test`
- Manual visual check with postprocessing enabled/disabled

## Progress Tracking

**Overall Status:** Not Started — 0%

### Subtasks

| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 3.1 | Rewrite BloomProvider component | Not Started | — | — |
| 3.2 | Preserve useBloomContext hook | Not Started | — | — |
| 3.3 | Preserve useBloomRegistration hook | Not Started | — | — |
| 3.4 | Add integration tests | Not Started | — | — |
| 3.5 | Visual regression verification | Not Started | — | — |
| 3.6 | Validate typecheck and tests | Not Started | — | — |

## Progress Log

_No progress yet._

## Acceptance Criteria

- [ ] `BloomProvider.tsx` reduced to ~100 LOC
- [ ] Public API unchanged (`useBloomContext`, `useBloomRegistration`)
- [ ] All existing tests pass
- [ ] New integration tests added and passing
- [ ] Visual behavior identical (verified by manual check or screenshot)
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes

## Files to Create/Modify

**Create:**

- `test/vitest/renderer/bloom/BloomProvider.integration.spec.ts`

**Modify:**

- `src/renderer/BloomProvider.tsx` (major refactor)

## Dependencies

- [TASK114](TASK114-bloom-refactor-phase1-types-constants.md) — Types and constants extracted
- [TASK115](TASK115-bloom-refactor-phase2-pure-logic.md) — Pure logic modules extracted

## Follow-up Tasks

- [TASK117](TASK117-bloom-refactor-phase4-cleanup.md) — Phase 4: Cleanup and documentation
