# TASK099 - Refactor `src/game/physics/safeKinematics.ts` into smaller modules

**Status:** Pending
**Added:** 2025-10-27
**Updated:** 2025-10-27

## Original Request
Split `src/game/physics/safeKinematics.ts` into `types.ts`, `mutationHelpers.ts`, `deferWrappers.ts`, and `postWrappers.ts` to reduce duplication and centralize error/validation logic.

## Thought Process
The file currently repeats validation and try/catch patterns. A `mutationHelpers` module will centralize checks for `state.simulation` and recording of Rapier guard trips. Grouping functions by enqueue semantics (defer vs post) clarifies intent and makes targeted testing simpler.

## Implementation Plan
1. Add `src/game/physics/types.ts` exporting `KinematicBody` and `Collider` types used across the physics modules.
2. Create `src/game/physics/mutationHelpers.ts` with `withDeferredEnqueue(state, fn)` and `withPostEnqueue(state, fn)` helpers that perform the `state.simulation` validation and wrap `fn()` in try/catch which records Rapier guard trips.
3. Move the `defer*` functions into `deferWrappers.ts` — these call `enqueueDeferredMutation` with closures created by `mutationHelpers`.
4. Move the `post*` functions into `postWrappers.ts` — these call `enqueuePostPhysicsMutation` similarly.
5. Add `src/game/physics/index.ts` to re-export the functions for compatibility.
6. Add unit tests for `mutationHelpers` verifying throws when simulation arrays are missing and that exceptions inside the inner function result in `recordRapierGuardTrip` being called.
7. Run typecheck and tests; fix any issues.

### Subtasks
| ID | Description | Status | Updated | Notes |
| --- | --- | --- | --- | --- |
| 411.1 | Create `types.ts` with exported types | Not Started | 2025-10-27 | Keep types identical to existing file |
| 411.2 | Implement `mutationHelpers.ts` and tests | Not Started | 2025-10-27 | unit tests should stub `recordRapierGuardTrip` |
| 411.3 | Extract `defer*` functions to `deferWrappers.ts` | Not Started | 2025-10-27 | Preserve function names and signatures |
| 411.4 | Extract `post*` functions to `postWrappers.ts` | Not Started | 2025-10-27 | Preserve function names and signatures |
| 411.5 | Add `index.ts` re-exports and run checks | Not Started | 2025-10-27 | Ensure no circular imports |

## Progress Log
### 2025-10-27
- Task created and design recorded in `memory/designs/DESIGN-20251027-safeKinematics.md`.

---

