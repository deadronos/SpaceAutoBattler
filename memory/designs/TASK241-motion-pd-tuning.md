# TASK241 — Motion PD Tuning Design

## Overview

We will expose per-hull angular control parameters, refine the angular controller integration to eliminate the AI "bobbing" oscillation, and document tuning guidance for designers. The solution keeps the physics-driven update loop intact while letting each hull specify proportional/derivative gains, angular damping, and a settling rate that suppresses residual slerp corrections near alignment.

## Requirements Mapping

- R1: Custom `turnKp`/`turnKd` per hull must be honored when computing angular corrections.
- R2: Slerp smoothing should disengage once error and velocity fall inside a settling band to avoid reintroducing rotation error.
- R3: Residual angular velocity must decay below a configurable settling rate within 0.5s of alignment.

## Proposed Changes

1. **MotionStats Extensions**
   - Add `angularSettlingRate: number` (rad/s) describing the desired residual angular velocity ceiling after alignment.
   - Add `angularSettleToleranceDeg?: number` (deg) to define the heading error threshold where settling logic engages.
   - Provide defaults in `createDefaultMotionStats()` and ensure validation covers the new fields.
2. **Controller Update (`updateAngularMotion`)**
   - Replace hardcoded `kp`/`kd` with values pulled from `MotionStats`, including fallback defaults when undefined.
   - Compute yaw error magnitude and angular speed; when both fall below configured tolerances, skip PD impulse and perform exponential damping towards zero using `angularSettlingRate`.
   - Gate render-time slerp smoothing: apply only when outside the tolerance band or when smoothing factors explicitly demand it.
   - Clamp angular acceleration to respect existing `angularAcceleration` and `maxTurnRate` constraints.
3. **Hull Data Tuning**
   - Populate per-hull `turnKp`, `turnKd`, `angularSettlingRate`, and `angularSettleToleranceDeg` values based on mass/moment proxies.
   - Document how to adjust parameters for new hulls.
4. **Documentation**
   - Author `spec/motion-tuning.md` capturing parameter descriptions, recommended ranges, and tuning workflow.

## Data Flow & Control

- **Input**: AI command supplies desired heading vector; `MotionStats` supply tuning values.
- **Processing**: `updateAngularMotion` computes direction error, PD response, damping, and rotation integration.
- **Output**: Updated angular velocity and rotation quaternions; smoothing optionally refines to visual target.

## Interfaces & Types

- `MotionStats` (src/types/index.ts)
  - New fields: `angularSettlingRate: number`, `angularSettleToleranceDeg?: number`.
  - Defaults defined in `createDefaultMotionStats`.
- `validateMotionStats` (src/game/validation.ts)
  - Extend assertions for new fields (non-negative, practical bounds).

## Error Handling

- Validation rejects negative gains or settling rates; defaults keep safe values.
- Controller branches multiply by damping even when target heading invalid to prevent NaNs.
- Settling logic must fallback to existing damping when config missing.

## Testing Strategy

- Extend `test/vitest/motion.system.spec.ts` with cases:
  - Uses custom `turnKp`/`turnKd` and asserts angular acceleration matches expectation.
  - Simulates alignment within tolerance and verifies angular velocity decays below `angularSettlingRate` within simulated time.
  - Confirms slerp smoothing does not run when in settling band (spy/flag via stubbed smoothing config).
- Consider targeted math tests for `updateAngularMotion` if necessary.

## Open Questions

- Do we need hull-specific `rotationSlerp` adjustments for cinematic shots? (Assume no immediate change; document in tuning guide.)
- Should settling tolerances adapt dynamically with hull speed? (Out of scope for this iteration.)
