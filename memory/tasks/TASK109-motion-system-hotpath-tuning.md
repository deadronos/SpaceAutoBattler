# TASK109 — Motion system hotpath tuning

**Status:** Completed  
**Added:** 2025-11-17  
**Updated:** 2025-11-17

## Original Request
Create a `/memory/tasks` implementation plan for DESIGN057 (motion system hotpath tuning) so the design can be executed and validated.

## Thought Process
- DESIGN057 highlights three hotspots in `updateMotionSystem`: iterating all ships instead of only those with active commands, potential per-ship allocations, and touching idle ships that cannot move.
- Capturing this as a tracked task keeps the spec-driven loop intact (requirements → plan → implementation → validation) and ensures we wire tests/benchmarks alongside the code changes.
- The task should drive a narrower archetype for commanded ships, early-outs for idle commands, and an allocation audit across `angular.ts`, `linear.ts`, and `physicsSync.ts`.

## Implementation Plan
- Add a Miniplex archetype (e.g., `shipsWithCommands`) during game state setup and switch `updateMotionSystem` to iterate that collection; keep a guarded fallback to the broader query if the archetype is absent.
- Introduce idle-motion tolerances (angular + thrust epsilons) in a small config module and early-return in the hot loop when commands are effectively no-op, skipping angular/linear updates and physics sync.
- Audit motion helpers (`angular.ts`, `linear.ts`, `physicsSync.ts`) to reuse shared temporaries from `sharedTemps.ts`; remove per-iter object creation and note the performance-critical contract in comments.
- Extend validation: unit/integration tests that assert the narrowed query excludes idle/commandless ships, confirm early-outs leave state unchanged for zero-thrust/near-heading cases, and add a lightweight perf/profiling note or capture comparing allocation counts before/after.

## Progress Tracking
**Overall Status:** Completed - 100%

### Subtasks
| ID  | Description | Status | Updated | Notes |
| --- | ----------- | ------ | ------- | ----- |
| 1.1 | Review DESIGN057 and current `updateMotionSystem` hot path. | Complete | 2025-11-17 | Confirmed requirements: narrower query, allocation audit, idle early-outs. |
| 1.2 | Draft this task file with plan and dependencies. | Complete | 2025-11-17 | Captured scope, design link, and validation needs. |
| 1.3 | Implement archetype swap, idle early-outs, and allocation-free helpers. | Complete | 2025-11-17 | Added `shipsWithCommands`, idle skip, shared temps, config thresholds. |
| 1.4 | Add tests/perf capture validating query size, idle skip, and zero allocations. | Complete | 2025-11-17 | Added Vitest hotpath spec asserting narrowed query and idle early-out. |

## Progress Log
### 2025-11-17
- Created the task to operationalize DESIGN057. Identified key work streams: commanded-ship archetype, idle early-outs, allocation audit, and tests/perf notes.
- Implemented `queries.shipsWithCommands` in state/types/fixtures, narrowed `updateMotionSystem` to that query with idle early-outs, and removed per-ship allocation in physics sync by reusing shared temps.
- Added motion idle thresholds config and a Vitest spec (`motion-system-hotpath.spec.ts`) covering commanded-only iteration and idle skip behavior.
