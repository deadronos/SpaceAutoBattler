# TASK251 - Beam Visual Alignment

**Status:** Completed  
**Added:** 2025-10-15  
**Updated:** 2025-10-15

## Original Request

Beam visuals appear offset from any ships even though the TTL is only 0.45s, making it unlikely the firing ship moved far enough to justify the gap. Impacting beams also seem to fail rendering entirely, leaving only non-hitting beams visible.

## Thought Process

- Observed instanced beam layer relies on the beam entity's transform each frame; offset visuals imply transform-origin drift or stale direction/origin data.
- Beam spawn logic runs inside `fireProjectile` with hitscan damage; visuals are added post-physics, so failures point to follow-up tracking in `advanceBeamVisuals` or renderer scaling.
- Lack of visible impact beams suggests the recorded beam length collapses to ~0, preventing geometry from rendering despite damage being applied.
- To stabilise visuals we likely need to store per-beam local offsets/directions relative to the source, update transforms deterministically each frame, and clamp render length for near-instant hits.

## Implementation Plan

1. Capture 2–5 EARS requirements in `memory/requirements.md` focused on origin tracking, impact visibility, and orphan cleanup.  
2. Publish `memory/designs/TASK251-beam-visual-alignment.md` detailing data flow (local offsets → world transforms), renderer implications, error handling, and unit test strategy.  
3. Extend beam spawn pipeline (`fireProjectile`) and `BeamVisualComponent` typings with stored local origin/direction metadata while maintaining backward compatibility.  
4. Update `advanceBeamVisuals` to reconstruct world-space origin/direction from stored local data (falling back to turret/ship cues) and prune beams whose sources vanish.  
5. Adjust `BeamVisualsInstancedLayer` to honour updated transforms, enforce a minimum render length, and cover edge cases through new Vitest specs.  
6. Add/refresh tests validating transform alignment after ship motion, short-range hits retaining visibility, and regression coverage for beam spawning. Run `npx tsc --noEmit` and targeted Vitest suites.

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID  | Description | Status | Updated | Notes |
| --- | ----------- | ------ | ------- | ----- |
| 1.1 | Record TASK251 EARS requirements. | Complete | 2025-10-15 | Added four requirements covering local metadata capture, transform rebuild, length clamp, and orphan removal. |
| 1.2 | Draft design doc and error matrix. | Complete | 2025-10-15 | Authored `memory/designs/TASK251-beam-visual-alignment.md` with architecture, error matrix, and testing plan. |
| 1.3 | Update component types and spawn metadata. | Complete | 2025-10-15 | Added local origin/direction fields to `BeamVisualComponent` and populated them in `fireProjectile`. |
| 1.4 | Rework `advanceBeamVisuals` origin/direction updates. | Complete | 2025-10-15 | Added local metadata reconstruction with turret fallback and immediate orphan teardown. |
| 1.5 | Enforce renderer length clamps and update layer logic. | Complete | 2025-10-15 | Added resolver helper with min/max clamps and wired matrix composition to use clamped length. |
| 1.6 | Expand Vitest coverage and run validations. | Complete | 2025-10-15 | Added system/helper specs, extended projectile behaviour assertions, ran `npx tsc --noEmit` and targeted Vitest suites. |

## Progress Log

### 2025-10-15

- Logged TASK251 with initial hypothesis (beam transform drift + zero-length impacts) and outlined high-level remediation plan pending requirements/design drafting.
- Captured four EARS requirements in `memory/requirements.md` defining metadata capture, transform reconstruction tolerance, minimum visible length, and orphan teardown behaviours.
- Published design doc covering spawn metadata, runtime reconstruction, renderer clamping, error handling, and Vitest strategy.
- Extended beam spawn logic to persist local muzzle origin/direction metadata (/src/types/combat.ts, /src/game/systems/projectiles.ts).
- Retooled `advanceBeamVisuals` to prefer stored local metadata before turret/ship fallbacks and keep fallback muzzle offsets.
- Introduced beam render length clamp helper and minimum visibility constant in `BeamVisualsInstancedLayer` with updated instancing math.
- Authored system/helper Vitest coverage for alignment/removal and beam length clamps, plus expanded projectile behaviour assertions; ran `npx tsc --noEmit` and `npx vitest test/vitest/beam-visuals.system.spec.ts test/vitest/projectile-behaviours.spec.ts`.
