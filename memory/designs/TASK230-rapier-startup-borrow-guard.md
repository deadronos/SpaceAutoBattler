# Design: Rapier Startup Borrow Guard (TASK230)

Created: 2025-09-30  
Purpose: Prevent Rapier "recursive use" panics during cold-start ticks by funneling world mutations through a deterministic deferred queue and guarding turret kinematic updates with safe setters.

## Context

The first rendered frame after `GameProvider` creates a `GameState` triggers several systems:

1. Carrier launch scheduling queues fighter spawns while iterating `queries.ships`.
2. Turret systems immediately write kinematic translations for every turret entity.
3. Spawn operations currently execute inside the carrier loop, causing Rapier to see overlapping borrows between `createRigidBody` and `setNextKinematicTranslation`.

Rapier (compiled from Rust) defends against nested mutable borrows by throwing `recursive use of an object detected which would lead to unsafe aliasing`. The existing ship motion guard (`safeSetNextKinematicTranslation`) avoids similar issues for ships but turrets bypass it. The fix requires a structured execution order for world mutations.

## Goals

- Defer all Rapier-mutating work generated during system iteration until a single ordered flush point per tick.
- Reuse the safety guard for turret kinematic writes so disposed or concurrently-mutated bodies are skipped gracefully.
- Maintain deterministic flush order across ticks (stable seed output) and ensure queues are cleared even if an operation throws.
- Keep integration lightweight so existing systems can adopt the deferred queue without refactoring their control flow.

## Non-goals

- Reworking the AI decision pipeline or motion system beyond queue integration.
- Introducing worker/threaded execution; the queue remains single-threaded and synchronous.
- Refactoring existing projectile or explosion systems unless they need the queue in future follow-ups.

## Architecture Overview

### Components

1. **SimulationDeferredQueue** (new):
   - Stored on `GameState.simulation.deferredMutations: DeferredOp[]`.
   - Helper `enqueueDeferredMutation(state, op)` pushes operations.
   - Helper `flushDeferredMutations(state)` drains the queue in FIFO order, catching and logging individual errors while continuing.

2. **KinematicSafety Utilities**:
   - Extract `safeSetNextKinematicTranslation` (and rotation variant) into `src/game/physics/safeKinematics.ts` so both ship and turret systems share the same guard without circular imports.

3. **UpdateGame Sequence Adjustments**:
   - Maintain existing system ordering but insert `flushDeferredMutations(state)` after kinematic writers (`updateTurrets`, `updateMotionSystem`, `advanceProjectiles`) and before `physicsWorld.step`.
   - Null-check `sim.pendingReset` after flush to ensure queued resets still run exactly once.

4. **Carrier Launch Integration**:
   - Replace the local `pendingSpawns` array with calls to `enqueueDeferredMutation` for each fighter spawn closure.
   - Closures continue pushing fighter IDs into `carrier.activeFighterIds` and rely on the queue flush to append after the iteration completes.

### Sequence Diagram (per tick)

```text
updateGame()
  ├─ updateDecisionSystem
  ├─ prepareShips (may queue secondary ops later)
  ├─ updateCarrierLaunchSystem (enqueue spawn closures)
  ├─ updateTurrets (only safe kinematic writes)
  ├─ updateMotionSystem
  ├─ advanceProjectiles
  ├─ flushDeferredMutations (executes spawn closures, etc.)
  ├─ physicsWorld.step
  ├─ pendingReset?
  ├─ syncTransforms
  ├─ resolveProjectiles
  └─ updateExplosions
```

## Data Flow

- **Mutation Producers**: Systems generate closures capturing the minimal data required to mutate the world later (e.g., fighter blueprint, carrier reference).
- **Queue Storage**: Closures are appended to `state.simulation.deferredMutations`.
- **Flush Point**: `flushDeferredMutations` clones and clears the queue, then executes each closure sequentially. Execution order equals enqueue order to preserve determinism.
- **Error Handling**: Each closure is wrapped in a `try/catch`. Failures log a warning tagged with the task ID, but the flush continues to remaining items. After flush, the queue is empty.

## Interfaces

```ts
// src/game/simulationQueue.ts
export type DeferredMutation = () => void;
export function enqueueDeferredMutation(state: GameState, op: DeferredMutation): void;
export function flushDeferredMutations(state: GameState): void;
```

```ts
// src/game/physics/safeKinematics.ts
export function safeSetNextKinematicTranslation(
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void;
```

`KinematicBody` remains `{ setNextKinematicTranslation(t) }` as defined today. Ship control and turret systems import from the shared utility.

`GameState.simulation` gains:

```ts
{
  ...
  deferredMutations: DeferredMutation[];
}
```

## Error Handling Matrix

| Failure Mode | Detection | Response | Recovery |
|--------------|-----------|----------|----------|
| Closure throws (e.g., spawn blueprint invalid) | `flushDeferredMutations` try/catch | Log `console.warn('[TASK230] deferred mutation failed', err)` | Continue with remaining closures; queue already cleared |
| Queue grows unbounded | Development instrumentation (Vitest coverage + optional assertions) | Optional `if (queue.length > 1000) console.warn` | Future tuning; out of scope |
| Turret rigid body disposed | Safe setter returns early | No further action | Next tick will remove turret via `unregisterTurret` |
| Flush not invoked (bug) | Vitest regression asserts `deferredMutations.length === 0` post `updateGame` | Fail test | Fix implementation |

## Testing Strategy

1. **Unit: Deferred Queue** — Enqueue multiple spies, call `flushDeferredMutations`, assert execution order, single-run semantics, and empty queue afterward.
2. **Integration: Cold Start** — Create game state, run `updateGame` once, assert queue empties and carriers spawned fighters without throwing (use Rapier shims in Vitest harness).
3. **Unit: Turret Safety** — Simulate turret entity with mocked rigid body that throws on `setNextKinematicTranslation`; verify safe setter handles gracefully and rest of loop continues.
4. **Regression: Spawn Determinism** — Seed RNG, enqueue operations that mutate captured arrays, confirm order is deterministic across runs.

## Implementation Plan

1. **Infrastructure**
   - Add `simulationQueue.ts` helpers and extend `GameState.simulation`.
   - Include queue initialisation in `createGameState` and type definitions.

2. **Kinematics Utility Extraction**
   - Move `safeSetNextKinematicTranslation` (and supporting types) into `physics/safeKinematics.ts`.
   - Update `shipControl.ts` to import from the new module.

3. **System Integration**
   - Update `updateCarrierLaunchSystem` to enqueue spawn closures directly; remove manual flush.
   - Update `updateTurrets` to use the shared safe setter, including rotation if necessary.
   - Insert `flushDeferredMutations` in `updateGame` before `physicsWorld.step`.

4. **Testing**
   - Add Vitest spec(s) covering queue behavior and cold-start spawn.
   - Expand turret tests to cover disposed rigid body scenario.

5. **Validation & Docs**
   - Run `npm run typecheck` and `npm test`.
   - Update memory bank (tasks/progress) upon completion.

## Risks

- **Performance**: Extra array allocations per tick. Mitigation: reuse queue array (clear via `length = 0`), operations expected small per tick.
- **Forgotten Flush**: If future refactor relocates flush, queue may never clear. Mitigation: add invariant check in tests; optional runtime assertion in dev builds.
- **Closure Captures**: Large captures (full ship entities) may extend lifetime. Mitigation: keep closures minimal, prefer IDs and blueprint data.

## Follow-ups

- Consider migrating projectile spawning to the deferred queue to reduce risk during projectile iteration.
- Evaluate consolidating deferred reset logic (`pendingReset`) into the same queue for symmetry.

## Implementation Notes — 2025-09-30

- `src/game/simulationQueue.ts` now owns FIFO enqueue/flush helpers, and `GameState.simulation.deferredMutations` is initialised via `createGameState` so every tick starts from an empty queue.
- `src/game/physics/safeKinematics.ts` exports the shared `safeSetNextKinematicTranslation` used by both `shipControl.ts` and `turrets.ts`, ensuring disposed rigid bodies fail closed.
- Carrier launch logic enqueues spawn closures and relies on the global flush inserted in `src/game/systems.ts` prior to `physicsWorld.step`, eliminating Rapier cold-start aliasing panics in smoke scenarios.
- Regression coverage: `test/vitest/simulation-queue.spec.ts`, `test/vitest/carrier-launch.spec.ts`, and `test/vitest/safe-kinematics.spec.ts` assert queue semantics, cold-start execution, and safe kinematic handling. Full suite (`npm test`) and `npm run typecheck` executed on 2025-09-30.
- `src/components/Ship.tsx` guards non-finite `smoothing.thrusterIntensity` values before delegating to thruster hooks, maintaining prior renderer behaviour expected by `test/vitest/thruster-glow.spec.ts` after the queue refactor.
