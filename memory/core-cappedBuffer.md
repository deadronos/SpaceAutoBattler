# Memory — core-cappedBuffer

File: `src/utils/cappedBuffer.ts`
Related: DESIGN055, TASK106

Summary

- Single source of truth for FIFO-trimmed diagnostic/history buffers. Eliminates the duplicate `push`/`shift` loops that previously lived in `simulationQueue`, `damage`, `metrics/recorders`, the star-disk debug hook, and `progression/events.appendCappedHistory`.
- All capped history appends in the runtime should funnel through this module so trimming semantics, cap normalization, and test coverage stay in sync.

Primary exports

- `appendCappedMutable<T>(buffer: T[], entry: T, cap: number): T[]` — mutating variant; returns the same buffer for chaining. Trims from the head with `splice(0, overflow)` so the call is allocation-free in the steady state.
- `appendCappedImmutable<T>(buffer: readonly T[] | undefined | null, entry: T, cap: number): T[]` — immutable variant; clones the input (or treats `null`/`undefined` as empty) and delegates to the mutating helper. Used by `progression/events.appendCappedHistory` to preserve its public signature.

Cap normalization

- `normalizeCap(cap)` floors non-finite or non-positive values to `0`.
- `cap === 0` short-circuits to a no-op (`buffer.length = 0`) — useful for disabling diagnostics in test or stripped builds.
- TypeError is thrown when the mutable variant receives a non-array buffer; the immutable variant tolerates `null`/`undefined` so callers can pass `state.something` directly.

Call sites (verified during the 2026-06 audit)

- `src/game/simulationQueue.ts` — Rapier panic snapshots (`__copilot_rapierPanics`), subsystem failure logs, deferred/post-physics mutation diagnostics.
- `src/game/combat/damage.ts` — shield ripple ring buffer, per-frame damage breakdown history.
- `src/renderer/metrics/recorders.ts` — frame-time, draw-call, and particle histograms.
- `src/components/environment/StarDiskProvider.tsx` (star-disk debug hook) — texture swap / orientation diagnostics.
- `src/game/progression/events.ts` — `appendCappedHistory` delegates here to keep its return-new-array contract.

Tests

- `test/vitest/utils/cappedBuffer.spec.ts` covers: cap trimming order, `cap = 0` clearing, NaN/Infinity handling, immutable clone semantics, and TypeError on non-array input.

References

- `src/utils/cappedBuffer.ts` (helper module)
- `test/vitest/utils/cappedBuffer.spec.ts` (unit tests)
- DESIGN055: Unify capped history helpers
- TASK106 / TASK415: implementation + refactor tracker
