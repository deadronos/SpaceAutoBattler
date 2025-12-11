# DESIGN055 — Shared capped-buffer helpers

## Summary

Duplicate FIFO trimming logic lives in four modules (`simulationQueue`, `damage`, `metrics/recorders`, and the star disk debug hook), each manually pushing new entries then shifting when buffers exceed a hard-coded length. This design introduces a single utility module that encapsulates the append-and-cap behavior, provides both mutating and immutable variants, and codifies error handling so debug surfaces stay resilient.

## Requirements Traceability

- R1 → Requirement 1: central helper enforces configured cap on every append.
- R2 → Requirement 2: helper preserves FIFO ordering when trimming.
- R3 → Requirement 3: immutable variant returns fresh arrays for progression history.
- R4 → Requirement 4: helper tolerates non-positive capacities without throwing.

## Current State

- `src/game/simulationQueue.ts` maintains `__copilot_rapierPanics` with a manual `while` loop.
- `src/game/systems/damage.ts` trims shield ripple histories using an inline `if (list.length > 64) list.shift();`.
- `src/game/metrics/recorders.ts` enforces the intent timeline cap with bespoke logic.
- `src/components/environment/starDisk/useStarDiskFrameLoop.ts` repeats the pattern for shader diagnostics.
- No shared helper exists, so behavior diverges across modules (e.g., some drop one entry per append, others splice nothing when cap <= 0).

## Proposed Architecture

```
┌──────────────────────────────┐
│ src/utils/cappedBuffer.ts    │
│  • appendCappedMutable<T>()  │
│  • appendCappedImmutable<T>()│
└──────────────┬───────────────┘
               │
   ┌───────────┴─────────────┐
   │                         │
Existing call sites import helper and remove bespoke logic:
   • simulationQueue.publishRapierPanicSnapshot
   • damage.applyProjectileDamage (shield ripple list)
   • metrics.recordIntentMetrics
   • useStarDiskFrameLoop debug dump
   • progression.events.appendCappedHistory delegates to immutable helper
```

## Data Flow

1. Call site composes an entry object (e.g., panic snapshot, ripple, diagnostics payload).
2. The caller invokes `appendCappedMutable(buffer, entry, max)`.
3. The helper pushes the entry, trims `buffer.length - cap` items from the head if needed, and returns the same reference for chaining.
4. If immutability is required, `appendCappedImmutable` clones the input (falling back to `[]` when undefined), delegates to the mutating helper, and returns the new array.
5. Callers persist the returned array or rely on in-place mutation depending on their use case.

## Interfaces

```ts
export function appendCappedMutable<T>(buffer: T[], entry: T, cap: number): T[];

export function appendCappedImmutable<T>(
  buffer: readonly T[] | undefined | null,
  entry: T,
  cap: number,
): T[];
```

- Both helpers normalise `cap` via `Math.max(0, Math.floor(cap))`.
- The mutable helper throws a `TypeError` if `buffer` is not an array to surface misuses early in production code.
- The immutable helper treats `undefined`/`null` as `[]` and always returns a new array reference.

## Data Models

- Buffer entries remain opaque generic types `T`. No schema changes are introduced.
- Caps remain defined by the owning module (`MAX_RAPIER_PANIC_SNAPSHOTS`, `64`, `MAX_INTENT_TIMELINE_ENTRIES`, `20`).

## Error Handling

| Scenario                                  | Behavior                                                           | Consumer expectation                                |
| ----------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| `buffer` is not an array (mutable helper) | Throw `TypeError` to surface programmer error early                | Callers fix wiring; tests cover the guard           |
| `cap <= 0`                                | Return empty array (mutable clears buffer, immutable returns `[]`) | Debug tooling avoids runaway growth, remains stable |
| `entry` is `undefined`                    | Helper still pushes value; trimming logic unaffected               | Callers decide if undefined entries are acceptable  |
| `cap` smaller than existing length        | Helper drops `buffer.length - cap` oldest elements in one splice   | Ensures FIFO semantics and deterministic history    |

## Testing Strategy

- `test/utils/cappedArray.spec.ts`
  - Mutating helper appends entries, trims correctly, and handles `cap <= 0`.
  - Immutable helper returns a new reference, preserves ordering, and respects caps.
  - Guard rails (non-array buffer) exercised via `expect(() => appendCappedMutable(...)).toThrow`.
- Existing progression/event tests updated to import the helper, ensuring runtime use continues to pass.

## Implementation Tasks

1. Add `src/utils/cappedBuffer.ts` with both helper functions and shared trimming logic.
2. Replace manual loops in the four call sites with helper invocations.
3. Update `appendCappedHistory` to delegate to `appendCappedImmutable`.
4. Author Vitest coverage under `test/utils/cappedArray.spec.ts`.
5. Run `npx tsc --noEmit` and targeted Vitest suite to confirm parity.

## Open Questions

- None identified; all call sites share identical FIFO semantics and tolerate the helper's guard behavior.
