# TASK236 – Rapier WASM Panic Diagnostics

**Status:** Completed  
**Added:** 2025-10-02  
**Updated:** 2025-10-02

## Original Request

Instrument Rapier step execution so physics panics record structured diagnostics that automation can read (StarDisk animation currently freezes while console floods with WASM "memory access out of bounds" errors). We need telemetry surfaced to the Memory Bank and debug hooks.

## Thought Process

- StarDisk uniforms stop updating when Rapier panics abort the tick; diagnosing requires metadata tying the panic to tick index/time.
- Existing `rapierDiagnostics` tracks deferred mutation issues but lacks step panic awareness; extending that structure keeps state centralised.
- We already expose debug helpers via `window.__copilot_*`; adding a Rapier panic buffer fits the pattern used by StarDisk and WebGL debug hooks.
- Medium confidence because wrapping the WASM step path is straightforward, but ensuring no double-snapshot spam requires careful bookkeeping.

## Implementation Plan

1. **Recorder Utility (PoC)**
   - Extend `RapierDiagnostics` types and state initialisers with panic fields.
   - Implement `recordRapierStepPanic` helper with per-tick de-duplication and message/stack capture.
   - Unit-test helper with synthetic errors and string throws.
2. **Update Loop Integration**
   - Wrap `physicsWorld.step` in `updateGame` with try/catch that invokes the recorder and rethrows.
   - Verify guard counters still run when no panic occurs.
3. **Debug Exposure**
   - Add `publishRapierPanicSnapshot` to push ring-buffer entries (max 20) to `window.__copilot_rapierPanics` when `?copilot_debug=1` is present.
   - Ensure duplicate panics within same tick do not add extra snapshots while counters still increment.
4. **Testing & Validation**
   - Add `rapierDiagnostics.spec.ts` covering helper behaviour and ring buffer trimming.
   - Add/extend tests ensuring `updateGame` rethrows while recording diagnostics.
   - Run `npm run typecheck` and `npm test` to confirm suite health.
5. **Documentation & Follow-Up**
   - Update Memory Bank progress, note any remaining gaps (e.g., future HUD integration).
   - Capture open issues if further instrumentation proves necessary.

### Subtasks

| ID | Description | Status | Updated | Notes |
| --- | --- | --- | --- | --- |
| 1.1 | Extend simulation diagnostics types and state initialisers with panic fields | Complete | 2025-10-02 | Wired defaults in `createGameState` and fixtures. |
| 1.2 | Implement `recordRapierStepPanic` with per-tick de-duplication and tests | Complete | 2025-10-02 | Added helper plus snapshot publisher guarded by debug flag. |
| 1.3 | Wrap `physicsWorld.step` and expose debug snapshot buffer | Complete | 2025-10-02 | `updateGame` now records panics and rethrows. |
| 1.4 | Add Vitest coverage for diagnostics and update loop behaviour | Complete | 2025-10-02 | New `rapier-diagnostics` and `update-game-panic` specs pass. |
| 1.5 | Document validation results and update Memory Bank | Complete | 2025-10-02 | Progress log + active context refreshed with diagnostics notes. |

## Progress Tracking

**Overall Status:** Completed – 100%

### 2025-10-02

- Captured EARS requirements and drafted architecture/design document outlining diagnostic flow and testing strategy.
- Implemented panic recorder + debug snapshot ring buffer; updated type definitions and defaults across runtime/test helpers.
- Wrapped `physicsWorld.step` to capture panics and added targeted Vitest coverage (recorder behaviours + rethrow verification).
- Ran `npm run typecheck` and `npm test` — suites pass with existing warnings about Three.js duplicates.
- Updated Memory Bank progress/active context with Rapier panic diagnostics summary.
