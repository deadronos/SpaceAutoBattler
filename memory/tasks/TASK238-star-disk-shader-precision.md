# TASK238 - Star Disk Shader Precision Freeze

**Status:** In Progress
**Added:** 2025-10-03
**Updated:** 2025-10-05

## Original Request

Star disk shader renders again but appears frozen even though debug telemetry shows `iTime` increasing. Need to restore visible animation (likely via Playwright validation if possible).

## Thought Process

- The shader uniform updates confirm CPU-side time advances, so the issue likely stems from GPU precision loss rather than missing updates.
- Fragment shader currently forces `mediump` precision. On WebGL1, `mediump` floats lose sub-integer precision beyond ~1024 seconds, freezing time-based noise despite uniform changes.
- Upgrading to `highp` (when available) with a safe fallback should restore smooth animation while staying compatible with devices that only support medium precision.
- Wrapping `iTime` inside the shader still suffers because the huge uniform value is quantised to float32 before the modulo executes, so the shader never observes sub-second deltas. The wrap must occur on the CPU before uploading the uniform.

## Implementation Plan

- Inspect `mainsequencestar.glsl` precision qualifiers to confirm it clamps to `mediump`.
- Update the shader to request `highp` precision with a guarded fallback to `mediump` when `GL_FRAGMENT_PRECISION_HIGH` is unavailable.
- Re-run existing StarDisk tests (`npx vitest test/vitest/star-disk-debug-lockdown.spec.tsx`) and perform manual validation (or Playwright capture if feasible) to ensure no regressions.

## Progress Tracking

**Overall Status:** In Progress - 90%

| ID  | Description                                                        | Status       | Updated    | Notes |
| --- | ------------------------------------------------------------------ | ------------ | ---------- | ----- |
| 1.1 | Confirm fragment precision qualifier and identify precision limits | Completed    | 2025-10-03 | Shader sets `mediump`; medium precision likely causes freeze. |
| 1.2 | Apply guarded `highp` precision update                              | Completed    | 2025-10-03 | Switched shader to prefer `highp` with fallback to `mediump`. |
| 1.3 | Run targeted tests / validation                                     | Completed    | 2025-10-03 | Ran `npx vitest test/vitest/star-disk-debug-lockdown.spec.tsx` and `npx tsc --noEmit`. |
| 1.4 | Rebase shader time uniforms to prevent float precision stalls       | Completed    | 2025-10-04 | Wrap `iTime` with long-period modulo and reuse scaled derivatives. |
| 1.5 | Wrap StarDisk uniform time on CPU before upload to avoid GPU precision loss | In Progress | 2025-10-05 | Move modulo logic to component, keep shader math stable. |

## Progress Log

### 2025-10-03

- Documented task, analyzed shader precision, and noted plan to favor `highp` with fallback.
- Updated shader precision guards to request `highp` when available, keeping `mediump` as fallback.
- Executed targeted Vitest suite and type checks to confirm StarDisk behaviours remain stable.

### 2025-10-04

- Observed animation stall persisting despite upgraded precision; concluded long-running sessions overflow time-based noise arguments.
- Wrapped `iTime` with a multi-hour modulo and refactored downstream derivatives (`timeLow`, `timeSlow`, `timeFast`) to keep shader inputs numerically stable.
- Validated Vitest coverage and type checks still pass after time rebasing adjustments.

### 2025-10-05

- Confirmed shader-side modulo still freezes visuals because the float uniform saturates before `mod` runs; GPU never sees fractional changes.
- Reworked StarDisk `useFrame` loop to wrap time on the CPU prior to calling `updateMainSequenceStarUniforms`, retaining raw elapsed telemetry for debugging.
- Restored shader time math to its original form now that the CPU feeds wrapped values, ensuring animation pacing matches legacy tuning.
