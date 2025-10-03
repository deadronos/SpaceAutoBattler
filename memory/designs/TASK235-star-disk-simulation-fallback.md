# TASK235 — Star Disk Simulation Fallback

**Status:** Completed  
**Updated:** 2025-10-03

## Problem Statement

- Without the debug flag, some scenes mount `StarDisk` while the simulation clock remains stationary, leaving the shader `iTime` uniform constant and the star disk static.
- We need a deterministic fallback that keeps the shader animating when the simulation stalls, then seamlessly rejoins simulation time once it resumes.

## Architecture Overview

- `StarDisk.tsx` owns the shader material reference and drives uniform updates inside a `useFrame` callback.
- The animation currently uses either simulation time (`sim.lastTickStart + sim.alpha * sim.step`) or a local `fallbackTimeRef` accumulating frame delta when no simulation is present.
- We will introduce a `lastUniformTimeRef` to enforce monotonic increases and reuse the fallback accumulator whenever the simulation fails to advance.

## Data Flow

```text
useFrame(delta)
  ├─ sample simulation clock (if present)
  ├─ compute candidate time from simulation
  ├─ detect stalled or invalid simulation and accumulate fallback delta
  ├─ ensure monotonic uniform time via `lastUniformTimeRef`
  └─ call `updateMainSequenceStarUniforms(material, { time, ... })`
```

## Interfaces

- `GameState.simulation`: consumes `lastTickStart`, `alpha`, `step` for deterministic time.
- `MainSequenceStarUniformUpdate`: receives `time` plus other uniforms.
- New refs: `fallbackTimeRef`, `lastUniformTimeRef` (number, seconds).

## Error Handling Matrix

| Scenario | Detection | Response |
| --- | --- | --- |
| Simulation time non-finite | `Number.isFinite(simTime)` fails | Skip to fallback accumulator |
| Simulation time stalls | `simTime <= lastUniformTimeRef` | Advance fallback using frame delta (or 1/60s minimum) |
| Zero/negative frame delta | `delta <= 0` | Use previous delta or 1/60s safeguard |
| Simulation resumes with jump | `simTime > lastUniformTimeRef` | Realign to simulation value and sync fallback ref |

## Testing Strategy

- Extend `test/vitest/star-disk-debug-lockdown.spec.tsx` to inject a stationary simulation clock, advance frames, and ensure uniform `time` increases.
- Add transition test verifying that once simulation time advances, the fallback realigns without decreasing `time`.
- Re-run existing debug coverage to guard regression on helper cleanup.

## Implementation Plan

1. Add `lastUniformTimeRef` in `StarDisk.tsx` and update the `useFrame` timing logic to detect stalled simulation and accumulate fallback deltas with a minimum step.
2. Harmonize fallback and simulation time by syncing refs when simulation resumes progression.
3. Update Vitest spec to allow configurable game state mocks, add tests for stalled simulation fallback and simulation resume alignment.
4. Execute targeted Vitest spec plus TypeScript check.

## Risks & Mitigations

- **Risk:** Divergence between fallback and simulation may introduce jumps when the clock resumes.  
  **Mitigation:** Clamp fallback to be at least the previous uniform time and immediately adopt the advancing simulation value.
- **Risk:** Excessive reliance on frame delta might reduce determinism in headless replays.  
  **Mitigation:** Only apply fallback when simulation fails to advance; once it progresses, we realign exactly to simulation time.

## Rollback Plan

- Revert changes to `StarDisk.tsx`, updated Vitest spec, and associated memory files if regressions appear.
