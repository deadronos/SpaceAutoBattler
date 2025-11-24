# TASK118 — Centralized Error Handling & Silent Catch Remediation

**Status:** Pending  
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

**Overall Status:** Not Started — 0%

### Subtasks

| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 1.1 | Create errorReporting.ts | Not Started | — | Core infrastructure |
| 1.2 | Add category helpers | Not Started | — | |
| 1.3 | Export from utils index | Not Started | — | |
| 1.4 | Unit tests for reporting | Not Started | — | |
| 2.1 | entityLifecycle.ts | Not Started | — | 7 catches, high priority |
| 2.2 | safeSnapshot.ts | Not Started | — | 9 catches |
| 2.3 | context.tsx | Not Started | — | 7 catches |
| 2.4 | systems.ts | Not Started | — | 2 nested catches |
| 2.5 | simulationQueue.ts | Not Started | — | 1 catch |
| 3.1 | StarSphere.tsx | Not Started | — | 12 catches |
| 3.2 | PlanetRings.tsx | Not Started | — | 8 catches |
| 3.3 | Postprocessing.tsx | Not Started | — | 4 catches |
| 3.4 | bloom/*.ts | Not Started | — | 3 catches |
| 3.5 | useStarMaterial.ts | Not Started | — | 5 catches |
| 4.1 | Debug panel | Not Started | — | ErrorCountsPanel |
| 4.2 | Update architecture doc | Not Started | — | |
| 4.3 | Troubleshooting notes | Not Started | — | |

## Progress Log

### 2025-11-25

- Task created from DESIGN062-error-handling-centralization.md
- Audit identified 100+ silent catch blocks across 35+ files
- Prioritized files by risk level (game logic > rendering > debug/utils)

## Acceptance Criteria

- [ ] `src/utils/errorReporting.ts` exists with documented API
- [ ] Error counts are tracked and queryable via `getErrorCounts()`
- [ ] High-priority files (entityLifecycle, safeSnapshot, context) refactored
- [ ] Each refactored catch block has a comment explaining why the error is expected
- [ ] Unit tests cover error reporting infrastructure
- [ ] Debug surface shows error counts in dev mode
- [ ] `npm run typecheck` and `npm test` pass
- [ ] No functional regressions (errors still caught, app doesn't crash)

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
