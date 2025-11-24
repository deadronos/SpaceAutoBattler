# TASK114: BloomProvider Refactor Phase 1 — Extract Types and Constants

**Status:** Pending  
**Created:** 2025-11-24  
**Design:** [DESIGN061](../designs/DESIGN061-bloom-provider-refactor.md)  
**Estimated Effort:** 1 hour  
**Priority:** Medium

## Original Request

Phase 1 of the BloomProvider refactoring: Extract shared types and configuration constants into dedicated modules to establish the foundation for the full refactor.

## Thought Process

This phase establishes the modular structure without changing any behavior. By extracting types first, subsequent phases can import from the new location, making the incremental refactor cleaner. Constants extraction removes magic values and centralizes configuration.

Key considerations:

- Maintain backward compatibility by keeping existing exports in `BloomProvider.tsx` during transition
- Use consistent naming conventions matching the existing codebase
- Document the purpose of each constant for future maintainers

## Implementation Plan

### Subtask 1.1: Create directory structure

- Create `src/renderer/bloom/` directory
- Add `AGENTS.md` with module guidelines

### Subtask 1.2: Extract types to `types.ts`

- Move `BloomRegistrationOptions` interface
- Move `BloomCtx` type (rename to `BloomContextValue` for clarity)
- Add `LayerAllocatorState` interface for phase 2
- Add `MaterialColorWriteState` interface for phase 2
- Export all types

### Subtask 1.3: Extract constants to `constants.ts`

- Move `LAYER_START` with config import
- Add `LAYER_MAX = 31` (Three.js layer limit)
- Move `FALLBACK_GROUP = 'default'`
- Add userData keys: `BLOOM_ORIG_LAYER_KEY`, `BLOOM_ORIG_COLORWRITE_KEY`
- Document each constant's purpose

### Subtask 1.4: Update BloomProvider imports

- Import types from `./bloom/types.js`
- Import constants from `./bloom/constants.js`
- Remove inline type definitions
- Verify no behavior change

### Subtask 1.5: Validate

- Run `npm run typecheck`
- Run `npm test`
- Verify bloom still works visually (manual check)

## Progress Tracking

**Overall Status:** Not Started — 0%

### Subtasks

| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 1.1 | Create directory structure | Not Started | — | — |
| 1.2 | Extract types to `types.ts` | Not Started | — | — |
| 1.3 | Extract constants to `constants.ts` | Not Started | — | — |
| 1.4 | Update BloomProvider imports | Not Started | — | — |
| 1.5 | Validate typecheck and tests | Not Started | — | — |

## Progress Log

_No progress yet._

## Acceptance Criteria

- [ ] `src/renderer/bloom/types.ts` exists with all type definitions
- [ ] `src/renderer/bloom/constants.ts` exists with all constants
- [ ] `BloomProvider.tsx` imports from new modules
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] No visual regression in bloom behavior

## Files to Create/Modify

**Create:**

- `src/renderer/bloom/types.ts`
- `src/renderer/bloom/constants.ts`
- `src/renderer/bloom/AGENTS.md`

**Modify:**

- `src/renderer/BloomProvider.tsx` (import updates only)

## Dependencies

- None (this is the first phase)

## Follow-up Tasks

- [TASK115](TASK115-bloom-refactor-phase2-pure-logic.md) — Phase 2: Extract pure logic modules
