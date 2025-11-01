# TASK103 - Refactor Motion System (split motion.ts)

**Status:** In Progress
**Added:** 2025-10-28
**Updated:** 2025-10-28

## Original Request
Split `src/game/systems/motion.ts` into smaller modules to improve testability and isolate physics sync.

## Thought Process
- `motion.ts` mixes angular PD control, linear thrust/strafe, damping/clamping, and deferred physics updates.
- Splitting into angular/linear/physics-sync modules will make unit testing the core algorithms straightforward and isolate Rapier-specific code.
- Keep `updateMotionSystem(state, dt)` as the public entrypoint to minimize ripple.

## Implementation Plan
- Create `src/game/systems/motion/` with `angular.ts`, `linear.ts`, `physicsSync.ts`, `sharedTemps.ts`, and `index.ts`.
- Keep `src/game/systems/motion.ts` as a small shim that re-exports from `motion/index.ts` or replace it after validation.
- Add unit tests under `test/systems/motion/` for angular and linear controllers and for physics sync behavior (mock deferred setters).
- Run `npx tsc --noEmit` and `npm test` after each step.

### Subtasks

| ID  | Description                                            | Status      | Updated | Notes |
| --- | ------------------------------------------------------ | ----------- | ------- | ----- |
| 103.1 | Create folder and add `angular.ts`                    | completed   | 2025-10-28 | Extracted angular control logic. |
| 103.2 | Add `linear.ts` for thrust/strafe/damping/clamping    | completed   | 2025-10-28 | Extracted linear updates. |
| 103.3 | Add `physicsSync.ts` to contain deferred kinematic setters | completed | 2025-10-28 | Keeps Rapier coupling isolated. |
| 103.4 | Add `sharedTemps.ts` for temporaries                  | completed   | 2025-10-28 | Shared Vector/Quat constants. |
| 103.5 | Create `index.ts` and shim `motion.ts`                | completed   | 2025-10-28 | Public API preserved. |
| 103.6 | Add unit tests for angular/linear                     | not-started | -       | Add tests in `test/systems/motion/`. |
| 103.7 | Run full test suite and fix issues                    | not-started | -       | Run typecheck and `npm test`. |

## Progress Log

### 2025-10-28
- Design written (DESIGN052) and task created. Extract plan and file list prepared.

