# TASK230 - Rapier Startup Borrow Guard

**Status:** Completed  
**Added:** 2025-09-30  
**Updated:** 2025-09-30

## Original Request

Cold-starting the battlefield triggers Rapier's `recursive use of an object detected which would lead to unsafe aliasing` panic when carriers spawn fighters and turret systems immediately perform kinematic writes. We need to restructure the simulation tick so world mutations are deferred to a single flush point and turret updates reuse the safe kinematic guard, eliminating the panic while preserving determinism.

## Thought Process

- Rapier throws when nested mutable borrows occur during world mutation. Carrier spawn closures currently run inside the carrier loop, overlapping with turret kinematic writes that run later in the same tick.
- Ships already use a safe setter for kinematic translations; turrets bypass it, so disposed or mid-mutation bodies propagate raw Rapier errors.
- Introducing a deterministic deferred mutation queue allows systems to enqueue mutating work without executing it until the flush point, breaking the borrow overlap. The queue must be part of `GameState.simulation` to stay deterministic and easy to inspect.
- Turret updates should share the safe setter (moved to a neutral module) so disposed rigid bodies are ignored cleanly.
- Tests need to cover queue semantics, cold-start execution, and turret safety to prevent regressions.

## Implementation Plan

1. **Deferred Queue Infrastructure**
   - Extend `GameState.simulation` with `deferredMutations: DeferredMutation[]` and add helpers for enqueueing/flushing operations.
   - Initialise the queue in `createGameState` and expose helpers under `src/game/simulationQueue.ts`.

2. **Shared Kinematic Safety Utilities**
   - Extract `safeSetNextKinematicTranslation` into `src/game/physics/safeKinematics.ts` to avoid circular imports.
   - Update `shipControl.ts` and `turrets.ts` to consume the shared helper (and add a rotation variant if required).

3. **System Integration**
   - Replace carrier spawn flushing with queue enqueueing and invoke the global flush in `updateGame` before `physicsWorld.step`.
   - Ensure the queue is cleared every tick and remains deterministic; adjust pending reset handling if needed.

4. **Regression Coverage**
   - Add Vitest specs validating queue ordering, one-shot execution, and cold-start spawn behaviour without Rapier panics.
   - Add unit coverage for turret safe setter behaviour when rigid bodies throw or are disposed.

5. **Validation & Documentation**
   - Run `npm run typecheck` and `npm test` after implementation.
   - Update memory bank progress and docs upon completion.

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID  | Description                                                         | Status    | Updated    | Notes                                                                                               |
| --- | ------------------------------------------------------------------- | --------- | ---------- | --------------------------------------------------------------------------------------------------- |
| 1.1 | Implement deferred mutation queue helpers and wire into `GameState` | Completed | 2025-09-30 | Added `simulationQueue.ts`, initialised `simulation.deferredMutations` in state factory.            |
| 1.2 | Share safe kinematic utilities between ships and turrets            | Completed | 2025-09-30 | Extracted `safeSetNextKinematicTranslation` into `physics/safeKinematics.ts` and updated consumers. |
| 1.3 | Integrate queue with carrier launches and `updateGame` flush point  | Completed | 2025-09-30 | Carrier launches enqueue closures; `updateGame` flushes before stepping Rapier.                     |
| 1.4 | Author regression/unit tests covering queue + turret safety         | Completed | 2025-09-30 | Added `simulation-queue`, `safe-kinematics`, and refreshed `carrier-launch` specs.                  |
| 1.5 | Run validation suite and update memory documentation                | Completed | 2025-09-30 | `npm run typecheck`, `npm test` (472 tests) pass; memory docs updated.                              |

## Progress Log

### 2025-09-30

- Captured EARS requirements and design outlining the deferred mutation queue and turret safety integration.
- Created TASK230 tracking file with implementation plan aligned to the spec-driven workflow.

### 2025-09-30 (later)

- Implemented deferred mutation queue helpers, safe kinematics module, carrier launch integration, and queue flush in `src/game/systems.ts`; updated fixtures and renderer guard for thruster smoothing.
- Authored/updated Vitest coverage (`simulation-queue`, `safe-kinematics`, `carrier-launch`) and reran the full suite (`npm test`) plus `npm run typecheck` with all checks passing.
- Documented implementation results in design/requirements memory and prepared task closure summary.
