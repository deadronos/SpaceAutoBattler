# TASK114: BloomProvider Refactor Phase 1 — Extract Types and Constants

**Status:** Completed  
**Created:** 2025-11-24  
**Completed:** 2025-11-24  
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

**Overall Status:** Completed — 100%

### Subtasks

| ID  | Description                         | Status   | Updated    | Notes                                                                                                                            |
| --- | ----------------------------------- | -------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Create directory structure          | Complete | 2025-11-24 | Created `src/renderer/bloom/` with `AGENTS.md`                                                                                   |
| 1.2 | Extract types to `types.ts`         | Complete | 2025-11-24 | Extracted `BloomRegistrationOptions`, `BloomContextValue`, `LayerAllocatorState`, `MaterialColorWriteState`, `BloomUserDataKeys` |
| 1.3 | Extract constants to `constants.ts` | Complete | 2025-11-24 | Extracted `LAYER_START`, `LAYER_MAX`, `LAYER_MIN`, `FALLBACK_GROUP`, `BLOOM_USER_DATA_KEYS`, `LEGACY_USER_DATA_KEYS`             |
| 1.4 | Update BloomProvider imports        | Complete | 2025-11-24 | Updated imports and re-exports for backward compatibility                                                                        |
| 1.5 | Validate typecheck and tests        | Complete | 2025-11-24 | `npm run typecheck` and `npm test` pass (643 tests)                                                                              |

## Progress Log

### 2025-11-24

- Created `src/renderer/bloom/` directory structure
- Created `src/renderer/bloom/AGENTS.md` with module guidelines
- Created `src/renderer/bloom/types.ts` with:
  - `BloomRegistrationOptions` interface
  - `BloomContextValue` interface (renamed from `BloomCtx` for clarity)
  - `LayerAllocatorState` interface (for Phase 2)
  - `MaterialColorWriteState` interface (for Phase 2)
  - `BloomUserDataKeys` interface
- Created `src/renderer/bloom/constants.ts` with:
  - `LAYER_START` (from config, defaults to 11)
  - `LAYER_MAX = 31` (Three.js layer limit)
  - `LAYER_MIN = 0`
  - `FALLBACK_GROUP = 'default'`
  - `BLOOM_USER_DATA_KEYS` (new standardized keys)
  - `LEGACY_USER_DATA_KEYS` (backward compatibility)
- Updated `BloomProvider.tsx`:
  - Import types from `./bloom/types.js`
  - Import constants from `./bloom/constants.js`
  - Re-export `BloomRegistrationOptions` for backward compatibility
  - Updated type annotations to use `BloomContextValue`
  - Replaced hardcoded `31` with `LAYER_MAX` constant
- Ran validation: `npm run typecheck` passes, `npm test` passes (643 tests)

## Acceptance Criteria

- [x] `src/renderer/bloom/types.ts` exists with all type definitions
- [x] `src/renderer/bloom/constants.ts` exists with all constants
- [x] `BloomProvider.tsx` imports from new modules
- [x] `npm run typecheck` passes
- [x] `npm test` passes
- [x] No visual regression in bloom behavior (verified via test suite)

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
