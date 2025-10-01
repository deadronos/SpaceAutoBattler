# [TASK231] - Sweep & Wrap Rapier Mutators

**Status:** In Progress  
**Added:** 2025-10-01  
**Updated:** 2025-10-01

## Original Request

Sweep the repository for Rapier mutator usages that currently mutate physics objects during simulation iteration and add deferred/post wrappers in `src/game/physics/safeKinematics.ts`. Add unit tests to validate enqueue and flush semantics and update callers where necessary.

## Thought Process

- Rapier exposes many mutators besides translation/rotation/velocity/mass (e.g. damping, gravity scale, collider friction/restitution, massProperties).
- Even if many of these are not currently used, adding deferred/post wrappers makes the contract explicit and prevents future regressions.
- Implement wrappers in the same style as existing functions: validate state.simulation, enqueue with try/catch, record diagnostics on errors.

## Implementation Plan

- Identify common mutators to cover: linear/angular damping, collider friction/restitution, gravityScale (if present), massProperties (if used).
- Add types and wrappers to `src/game/physics/safeKinematics.ts`.
- Add unit tests in `test/vitest/safe-kinematics.spec.ts` covering each wrapper's deferred/post behavior and diagnostic handling.
- Search for and migrate any existing callers to use new wrappers.

## Progress Tracking

| ID | Description | Status | Updated | Notes |
| --- | --- | --- | --- | --- |
| 1 | Add wrappers for damping & collider mutators | In Progress | 2025-10-01 | Implemented wrappers for linear/angular damping and collider friction/restitution and added tests. |
| 2 | Migrate callers | Not Started | - | Run repository search and update callers where mutators are used. |

## Progress Log

### 2025-10-01
- Added deferred and post wrappers for linear/angular damping and collider friction/restitution to `src/game/physics/safeKinematics.ts`.
- Added unit tests to `test/vitest/safe-kinematics.spec.ts` to exercise enqueue and flush behavior and diagnostic recording.
- Marked the task as In Progress.

## Acceptance Criteria

- [ ] Wrappers exist in `src/game/physics/safeKinematics.ts` for the chosen mutators.
- [ ] Unit tests demonstrate enqueue & flush behavior for both deferred and post variants and pass in CI.
- [ ] Any existing direct mutator usages in production code are migrated to use the wrappers.
