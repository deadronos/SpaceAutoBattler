# TASK226 - Carrier Spawn Scheduling

**Status:** Completed  
**Added:** 2025-09-29  
**Updated:** 2025-09-29

## Original Request

Investigate and resolve the runtime error `recursive use of an object detected which would lead to unsafe aliasing in rust` raised by Rapier during carrier fighter launches and intercept intent scoring. The error surfaces while carriers spawn fighters (`spawnShip` inside `updateCarrierLaunchSystem`) and when AI reads rigid-body velocity via `getShipVelocity`.

## Thought Process

- The Rapier error indicates we are invoking world-mutating APIs (`createRigidBody`, `createCollider`) while Rapier already holds an active borrow from the same world, which typically happens when spawning is interleaved with iteration over the live ship query.
- Carriers currently call `spawnShip` directly inside the loop over `state.queries.ships.entities`. Miniplex updates the backing array immediately when a new entity is added, producing re-entrant access to Rapier internals while we still hold references derived from the same world step.
- Deferring the fighter instantiation until after we finish iterating the carriers should eliminate the conflicting borrow while keeping launch cadence deterministic. We can queue ship blueprints during the loop and execute the actual `spawnShip` calls afterwards.
- We must continue to respect launch caps, cooldowns, and deterministic jitter by recording all necessary blueprint data (position, heading, parent carrier id) at queue time.
- Once spawns complete, carriers need their `activeFighterIds` refreshed and the `aliveById` map updated so future pruning works without recognising placeholders.

## Implementation Plan

1. Update `updateCarrierLaunchSystem` to collect pending fighter spawn requests instead of invoking `spawnShip` immediately while iterating the ship query.
2. Store fully resolved launch blueprint data (including cloned spawn position and heading) and enqueue a closure that pushes the spawned fighter id onto `carrier.activeFighterIds` once executed.
3. After the carrier loop completes, execute the queued spawn closures sequentially so Rapier mutations occur outside of the query iteration.
4. Add a regression unit test ensuring that carriers still respect the `maxActive` cap while the new deferred spawning path is in place, and that queued launches attach the spawned fighter ids to the carrier.
5. Run `npm run typecheck` and `npm test` to validate the change, confirming the Rapier runtime error is eliminated.
6. Document the change in the memory bank (`requirements.md`, design file, task log) and update `progress.md` upon completion.

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID | Description | Status | Updated | Notes |
| --- | --- | --- | --- | --- |
| 1.1 | Draft EARS requirements and design covering deferred carrier spawns | Complete | 2025-09-29 | Added TASK226 requirements and design doc in memory bank |
| 1.2 | Implement spawn queuing in `updateCarrierLaunchSystem` with updated tests | Complete | 2025-09-29 | Deferred spawn queue implemented with regression coverage |
| 1.3 | Run validation suite and document completion in memory bank | Complete | 2025-09-29 | `npm run typecheck` and `npm test` both pass |

## Progress Log

### 2025-09-29

- Logged Rapier unsafe aliasing error surfaced during carrier launch and intercept scoring. Initiated TASK226 to queue carrier spawns after iteration to avoid re-entrant Rapier borrows.
- Authored EARS requirements and design document describing the deferred spawn queue approach and validation strategy.
- Implemented queued spawn execution in `updateCarrierLaunchSystem`, added new carrier launch regression tests, and verified via `npm run typecheck` + `npm test`.
