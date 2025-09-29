# TASK226 — Carrier Spawn Scheduling Design

## Problem Statement

Repeated fighter launches from carrier hulls trigger Rapier's `recursive use of an object` panic because `updateCarrierLaunchSystem` adds new rigid bodies via `spawnShip` while still iterating the live ship query. Rapier's WASM bindings reject this re-entrant world mutation, aborting the simulation mid-frame and cascading into AI systems that rely on rigid-body velocity reads.

## Confidence Assessment

- **Confidence Score:** 0.9 (High). The root cause is isolated to carrier spawning, and a deterministic queuing strategy mirrors patterns already used for deferred resets.
- **Execution Strategy:** Proceed with the full implementation plan without a PoC. No additional research required.

## Architecture

- Introduce an internal queue inside `updateCarrierLaunchSystem` that records pending fighter spawn operations while we iterate carriers.
- Each queued entry captures a fully resolved `ShipBlueprint` (position clone, heading, parent id) plus a closure that attaches the spawned fighter id to the originating carrier and refreshes the local alive map.
- After the carrier loop completes, execute the queued closures sequentially, ensuring Rapier mutations occur when no carrier iteration is active.
- Maintain deterministic launch ordering by enqueuing requests in the same sequence the direct calls previously executed.

## Data Flow

1. Build an `aliveById` lookup from the current ship list (unchanged).
2. Iterate the carrier list and prune stale fighter ids against `aliveById`.
3. For each carrier eligible to launch fighters, compute the spawn transform and heading, clone the position, and enqueue a spawn closure while incrementing the launch index and resetting the cooldown as today.
4. After the loop finishes, invoke each queued closure, which calls `spawnShip`, appends the fighter id to `carrier.activeFighterIds`, and updates `aliveById`.
5. The remainder of the simulation proceeds unchanged, now free of Rapier re-entrancy.

## Interfaces

- `updateCarrierLaunchSystem(state, dt)` (existing): gains an internal spawn queue but preserves signature and return type.
- No new public APIs are introduced; the change is fully encapsulated within the carrier system.

## Data Models

- No schema changes to `GameState`, `CarrierComponent`, or `ShipBlueprint` are required. The spawn queue uses local closures, avoiding new persistent state.

## Error Handling Matrix

| Scenario | Detection | Response |
| --- | --- | --- |
| Rapier spawn call throws or returns invalid entity | `spawnShip` throws | Propagate the exception (existing behaviour) so the caller can surface failure; carrier cooldown already reset, so no double-spawn occurs |
| Carrier enqueues zero launches | Queue length is zero | Skip execution loop; cooldown logic leaves state untouched |
| Carrier reaches `maxActive` mid-tick | Available slot computation returns ≤ 0 | Do not enqueue new spawns; queue remains empty and cooldown is unchanged |
| Queue contains closures that mutate stale carrier references | Carrier marked as destroyed before queue flush | Closure guarded by carrier reference; if the carrier no longer exists, the appended fighter id has no effect and the carrier's pruning pass next tick removes the orphan |

## Testing Strategy

- Extend `test/vitest/carrier-launch.spec.ts` with a regression covering the queued spawning path, asserting:
  - `spawnShip` is still invoked the expected number of times without throwing.
  - Newly spawned fighter ids are appended to `carrier.activeFighterIds` after the queue flush.
  - Launch attempts respect the active cap even when cooldown permits additional batches.
- Run `npm run typecheck` and `npm test` to validate the broader simulation remains stable.

## Implementation Notes

- Clone the launch position before enqueuing to avoid shared mutable vectors across queued entries.
- Keep the spawn queue array local to the function to prevent persistent state and unintended cross-tick reuse.
