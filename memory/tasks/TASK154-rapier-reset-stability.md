# TASK154 - Rapier Reset Stability

**Status:** Pending  
**Added:** 2025-09-29  
**Updated:** 2025-09-29

## Original Request

Continue the Rapier reset fix to eliminate the Rapier console errors that appear when the in-game reset button is pressed during active physics stepping (e.g., warnings about invalid event queue usage and collider removals mid-step).

## Thought Process

- Rapier logs console errors when the simulation state is reset while `World.step` is running because colliders and the event queue are mutated mid-step.
- Resetting should be deferred until after the current physics integration finishes, likely via a queued action processed on the next update tick.
- Event queue setup still uses the legacy boolean constructor; the modern API prefers an options object, which might resolve console warnings and align with upstream expectations.
- We need to review how `resetGame` interacts with render and AI loops so deferred resets do not leave the UI in an inconsistent state.

## Technical Design

**Architecture:**

- Introduce a reset scheduling flag/closure on `GameState` processed at the end of `updateGame` once the physics step completes.
- Ensure `Controls` triggers the scheduler instead of calling `resetGame` directly.
- Modernize the event queue initialization in `createGameState` to use the options object signature.

**Data Flow:**

1. UI dispatches a `requestReset` function that stores `(state) => resetGame(state)` on `GameState.simulation.pendingReset`.
2. `updateGame` checks `pendingReset` after the physics step and executes it when not stepping.
3. `resetGame` clears the pending reset flag to avoid repeated execution.

**Interfaces:**

- Extend `SimulationClock` with an optional `pendingReset?: (() => void) | null`.
- Add `requestReset(state: GameState)` helper returning void and consumer for `Controls`.

**Data Models:**

- `SimulationClock` new field documenting lifecycle and ensuring serialization awareness for tests.

## Error Handling Matrix

| Scenario | Detection | Response |
| --- | --- | --- |
| Reset requested during physics step | `pendingReset` flag set while stepping | Defer execution until post-step hook runs |
| Event queue initialization fails | Rapier constructor throws | Log error, dispose partially created state, rethrow to stop provider setup |
| Deferred reset executed twice | `pendingReset` not cleared | Clear flag immediately after invoking `resetGame` |

## Unit Testing Strategy

- Add Vitest coverage ensuring `requestReset` defers execution until after the main loop tick completes.
- Assert event queue initialization is invoked with the options object shape.
- Validate that repeated reset requests within the same frame coalesce into a single reset run.

## Implementation Plan

1. Update `SimulationClock` type and initialise the new `pendingReset` field in `createGameState`.
2. Add a `requestReset` helper in `state.ts` that sets `pendingReset` and expose it to UI controls.
3. Modify `updateGame` to execute and clear `pendingReset` after `physicsWorld.step` and before subsequent systems.
4. Replace direct `resetGame` usage in UI with `requestReset`.
5. Switch Rapier `EventQueue` instantiation to the options-object constructor.
6. Write/adjust Vitest specs covering deferred reset behaviour and event queue creation.
7. Re-run `npm run typecheck` and `npm test` to confirm stability.

## Progress Tracking

**Overall Status:** Not Started — 0%

### Subtasks

| ID | Description | Status | Updated | Notes |
| --- | --- | --- | --- | --- |
| 1.1 | Extend `SimulationClock` with `pendingReset` field and default | Not Started | — | — |
| 1.2 | Implement deferred reset scheduling + UI integration | Not Started | — | — |
| 1.3 | Update tests and validation scripts | Not Started | — | — |

## Progress Log

_No progress recorded yet._
