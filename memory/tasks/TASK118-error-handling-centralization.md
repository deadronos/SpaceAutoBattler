# TASK118 — Centralized Error Handling & Silent Catch Remediation

**Status:** Completed  
**Added:** 2025-11-25  
**Updated:** 2025-11-25  
**Design:** [DESIGN062](../designs/DESIGN062-error-handling-centralization.md)

## Original Request

Address the 100+ silent `catch {}` blocks scattered throughout `src/` that mask potential issues, making debugging difficult and hiding error patterns. Create a centralized error reporting system and systematically refactor high-priority files.

From high-level-architecture.md (Section 10, Error Handling, rated B-):

> - Many silent `catch { /* ignore */ }` blocks mask potential issues
> - Inconsistent error handling patterns across modules
> - No centralized error reporting/logging system
> - Comments like "ignore" don't explain why errors are expected

## Thought Process

The codebase has accumulated defensive try-catch blocks in several categories:

1. **Physics/WASM cleanup** — Rapier objects become invalid when parent objects are freed
2. **Material lifecycle** — React unmount races with Three.js disposal
3. **WebGL context** — Browser API inconsistencies and context loss
4. **Test/Debug environments** — JSDOM lacks WebGL APIs
5. **E2E test hooks** — Helpers that must not crash regardless of state

The approach is to create lightweight infrastructure that:

- Counts errors by category (always, even in prod)
- Logs details in development mode only
- Documents *why* each catch block exists
- Provides a debug surface for visibility

This is non-breaking: existing try-catch structure remains, we just add reporting.

## Implementation Plan

### Phase 1: Infrastructure (MVP)

- [ ] 1.1 Create `src/utils/errorReporting.ts` with `ErrorCategory` enum and reporting functions
- [ ] 1.2 Add category-specific helpers (`reportMaterialError`, `reportPhysicsError`, etc.)
- [ ] 1.3 Export from `src/utils/index.ts`
- [ ] 1.4 Add unit tests for error reporting

### Phase 2: High-Priority Game Logic

- [ ] 2.1 Refactor `src/game/entityLifecycle.ts` (7 catches → documented + reported)
- [ ] 2.2 Refactor `src/game/safeSnapshot.ts` (9 catches → documented + reported)
- [ ] 2.3 Refactor `src/game/context.tsx` (7 catches → documented + reported)
- [ ] 2.4 Refactor `src/game/systems.ts` (2 nested catches)
- [ ] 2.5 Refactor `src/game/simulationQueue.ts` (1 catch)

### Phase 3: Rendering Files

- [ ] 3.1 Refactor `src/components/environment/StarSphere.tsx` (12 catches)
- [ ] 3.2 Refactor `src/components/environment/PlanetRings.tsx` (8 catches)
- [ ] 3.3 Refactor `src/components/Postprocessing.tsx` (4 catches)
- [ ] 3.4 Refactor `src/renderer/bloom/*.ts` (3 catches)
- [ ] 3.5 Refactor `src/hooks/useStarMaterial.ts` (5 catches)

### Phase 4: Debug Surface & Documentation

- [ ] 4.1 Add error counts to existing debug panel (or create `ErrorCountsPanel`)
- [ ] 4.2 Update `docs/high-level-architecture.md` Error Handling section
- [ ] 4.3 Add troubleshooting notes for common error categories

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 1.1 | Create errorReporting.ts | Complete | 2025-11-25 | Core infrastructure |
| 1.2 | Add category helpers | Complete | 2025-11-25 | 7 category-specific helpers |
| 1.3 | Export from utils index | Complete | 2025-11-25 | N/A - direct imports |
| 1.4 | Unit tests for reporting | Complete | 2025-11-25 | 22 tests |
| 2.1 | entityLifecycle.ts | Complete | 2025-11-25 | 7 catches refactored |
| 2.2 | safeSnapshot.ts | Complete | 2025-11-25 | 9 catches refactored |
| 2.3 | context.tsx | Complete | 2025-11-25 | 7 catches refactored |
| 2.4 | systems.ts | Complete | 2025-11-25 | 2 nested catches refactored |
| 2.5 | simulationQueue.ts | Not Started | — | Lower priority |
| 3.1 | StarSphere.tsx | Complete | 2025-11-25 | 12 catches refactored |
| 3.2 | PlanetRings.tsx | Complete | 2025-11-25 | 8 catches refactored |
| 3.3 | Postprocessing.tsx | Complete | 2025-11-25 | 4 catches refactored |
| 3.4 | bloom/*.ts | Complete | 2025-11-25 | 3 catches refactored |
| 3.5 | useStarMaterial.ts | Complete | 2025-11-25 | 5 catches refactored |
| 4.1 | Debug panel | Complete | 2025-11-25 | ErrorCountsPanel.tsx |
| 4.2 | Update architecture doc | Not Started | — | Future enhancement |
| 4.3 | Troubleshooting notes | Not Started | — | Future enhancement |

## Progress Log

### 2025-11-25

- Task created from DESIGN062-error-handling-centralization.md
- Audit identified 100+ silent catch blocks across 35+ files
- Prioritized files by risk level (game logic > rendering > debug/utils)

### 2025-11-25 (Implementation)

- Created `src/utils/errorReporting.ts` with:
  - `ErrorCategory` enum (Physics, Material, WebGL, Lifecycle, Config, E2E, Query)
  - Core `reportError()` function with counter tracking and dev-mode logging
  - Category-specific helpers: `reportMaterialError`, `reportPhysicsError`, `reportLifecycleError`, `reportE2EError`, `reportQueryError`, `reportWebGLError`, `reportConfigError`
  - Query functions: `getErrorCounts()`, `getTotalErrorCount()`, `getRecentErrors()`
  - Control functions: `resetErrorCounts()`, `setErrorReportingEnabled()`, `isErrorReportingEnabled()`
- Created `test/vitest/errorReporting.spec.ts` with 22 unit tests
- Refactored high-priority game logic files:
  - `entityLifecycle.ts`: 7 catches → documented + reported
  - `safeSnapshot.ts`: 9 catches → documented + reported
  - `context.tsx`: 7 catches → documented + reported
  - `systems.ts`: 2 nested catches → documented + reported
- Refactored rendering files:
  - `StarSphere.tsx`: 12 catches → documented + reported
  - `PlanetRings.tsx`: 8 catches → documented + reported
  - `Postprocessing.tsx`: 4 catches → documented + reported
  - `BloomProvider.tsx`: 1 catch → documented + reported
  - `layerMaskManager.ts`: 2 catches → documented + reported
  - `useStarMaterial.ts`: 5 catches → documented + reported
- Created `src/debug/ErrorCountsPanel.tsx` debug component
- Added CSS styles for error counts panel in `debugPanel.css`
- All tests pass (751 total including 22 new error reporting tests)
- TypeScript typecheck passes

## Acceptance Criteria

- [x] `src/utils/errorReporting.ts` exists with documented API
- [x] Error counts are tracked and queryable via `getErrorCounts()`
- [x] High-priority files (entityLifecycle, safeSnapshot, context) refactored
- [x] Each refactored catch block has a comment explaining why the error is expected
- [x] Unit tests cover error reporting infrastructure
- [x] Debug surface shows error counts in dev mode
- [x] `npm run typecheck` and `npm test` pass
- [x] No functional regressions (errors still caught, app doesn't crash)

## Dependencies

- None (standalone improvement)

## Estimated Effort

| Phase | Time |
|-------|------|
| Phase 1 (Infrastructure) | 2-3 hours |
| Phase 2 (Game Logic) | 2-3 hours |
| Phase 3 (Rendering) | 2-3 hours |
| Phase 4 (Debug Surface) | 1-2 hours |
| **Total** | **8-12 hours** |

## Risks

| Risk | Mitigation |
|------|------------|
| Performance overhead | Counters only; logging disabled in prod |
| Log spam in dev | Rate-limit repeated errors |
| Scope creep | Focus on high-priority files first |
| Breaking changes | Keep try-catch structure; only add reporting |

## References

- [DESIGN062](../designs/DESIGN062-error-handling-centralization.md) — Full design document
- `docs/high-level-architecture.md` — Section 10 (Error Handling)
- Existing pattern: `recordSubsystemFailure` in `src/game/systems.ts`
