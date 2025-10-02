# TASK236 – Rapier WASM Panic Diagnostics

**Status:** Draft  
**Last Updated:** 2025-10-02  
**Confidence:** 0.72 (medium) – known patterns for queue instrumentation exist, but Rapier panic surfacing is new territory.

## Problem Statement

Rapier runtime panics currently surface as opaque WASM "memory access out of bounds" errors without structured telemetry. StarDisk animation stalls when the physics loop aborts, leaving only console noise. We need deterministic diagnostics that capture panic context and expose it to automation without destabilising the main simulation loop.

## Linked Requirements

- `memory/requirements.md` → section **2025-10-02 — Rapier WASM Panic Diagnostics (TASK236)**

## Proposed Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ updateGame (systems.ts)                                      │
│   ├─ flushDeferredMutations                                   │
│   ├─ try { physicsWorld.step(eventQueue) }                    │
│   │      catch panic → recordRapierStepPanic()                │
│   ├─ flushPostPhysicsMutations                                │
│   └─ sync / resolve / FX                                      │
└──────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────┐
│ recordRapierStepPanic (simulationQueue.ts)                    │
│   ├─ Update GameState.simulation.rapierDiagnostics            │
│   ├─ Maintain per-tick de-duplication + counters              │
│   └─ When debug flag true → publish snapshot to window.* hook │
└──────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────┐
│ window.__copilot_rapierPanics (ring buffer of 20 snapshots)   │
│   • tick index, sim time, delta                               │
│   • error message + stack                                     │
│   • occurrence timestamp & cumulative counts                  │
└──────────────────────────────────────────────────────────────┘
```

### Execution Strategy (Medium Confidence)

1. Build minimal panic recorder utility and unit-test against synthetic errors (acts as PoC).
2. Integrate recorder into `updateGame` try/catch, rethrowing the original error to preserve behaviour.
3. Expand plan to cover debug exposure and state wiring once PoC validates diagnostics capture.

## Interfaces & Contracts

- **Type Updates** (`src/types/simulation.ts`)
  - Extend `RapierDiagnostics` with:
    - `stepPanics: number`
    - `lastStepPanicTick: number`
    - `lastStepPanicTime: number`
    - `lastStepPanicDelta: number`
    - `lastStepPanicMessage?: string`
    - `lastStepPanicStack?: string`
  - Add optional ring buffer metadata: `stepPanicSnapshots: RapierStepPanicSnapshot[]` (internal use).
- **New Utility** (`simulationQueue.ts`)
  - `recordRapierStepPanic(state: GameState, error: unknown): void`
    - Mutates diagnostics and calls `publishRapierPanicSnapshot` when allowed.
  - `publishRapierPanicSnapshot(snapshot: RapierStepPanicSnapshot): void`
    - Appends to `window.__copilot_rapierPanics`, trimming to size ≤ 20.
  - `RapierStepPanicSnapshot` interface exported for tests.
- **Update Loop Contract** (`systems.ts`)
  - Wrap `physicsWorld.step(eventQueue)` in try/catch, invoke recorder, rethrow error.
  - Ensure repeated panics within same tick increment `stepPanics` but avoid duplicate snapshots.

## Data Model Changes

- `RapierDiagnostics`
  - Augment existing structure with panic bookkeeping noted above.
  - Maintain `stepPanics` as total ever observed (monotonic).
  - Preserve existing mutation/guard counters untouched.
- `GameState.simulation`
  - Initialisers in `createGameState` and `createTestGameState` must seed new fields with zero/-1 defaults.

## Error Handling Matrix

| Scenario | Detection | Recorder Response | External Exposure | Rethrow |
| --- | --- | --- | --- | --- |
| `physicsWorld.step` throws Error | try/catch around `step` | Increment `stepPanics`, update `lastStepPanic*`, memoise snapshot per tick | Append snapshot to `window.__copilot_rapierPanics` when debug flag true | Yes (preserve current behaviour) |
| Non-Error throw (string/number) | Same catch | Coerce via `String(error)` for message, omit stack | Same as above | Yes |
| Multiple throws same tick | `sim.lastTickIndex` check | Increment counter, skip duplicate snapshot | No new snapshot | Yes |
| Snapshot ring buffer overflow | Buffer length check | Remove oldest entries until length ≤ 20 | n/a | n/a |

## Unit Testing Strategy

- **rapierDiagnostics.spec.ts** (new)
  1. *Captures metadata*: Stub state & error, call recorder, assert diagnostics fields populated and snapshot appended when debug flag set.
  2. *De-duplicates per tick*: Invoke recorder twice within same tick, verify `stepPanics` increments twice, `lastStepPanicTick` unchanged, buffer length remains 1.
  3. *Handles non-Error throws*: Pass string throw, ensure message coerced and stack omitted without crash.
  4. *Snapshot trimming*: Drive >20 inserts, confirm buffer trimmed to 20 with newest retained.
- **systems.spec.ts** (new or existing): Validate `updateGame` rethrows after recording by mocking `physicsWorld.step` to throw and expecting the error to bubble.

## Implementation Plan (High-Level)

1. **PoC** (Confidence gate)
   - Implement `recordRapierStepPanic` in isolation with unit tests using fixture state.
2. **Integrate**
   - Wrap physics step in `updateGame` with recorder invocation.
   - Update diagnostics types and state factories.
3. **Expose Debug Hooks**
   - Implement `publishRapierPanicSnapshot` with ring buffer + URL flag check.
4. **Docs & Memory**
   - Update task file, design status, and mention new diagnostics in relevant docs if needed.
5. **Validation**
   - Run `npm run typecheck` & `npm test`.

## Open Questions / Assumptions

- Assumes existing `?copilot_debug=1` flag is the canonical signal for exposing globals.
- Re-throwing the panic is acceptable since behaviour today already leads to console failure.
- No production performance impact because catch block only executes on exceptional path.

## Follow-Up Opportunities

- Consider wiring panic snapshots into HUD debug panels.
- Future work: automatically pause simulation when panic recorded for easier inspection.
