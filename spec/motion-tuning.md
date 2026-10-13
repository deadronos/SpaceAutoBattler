# Motion Tuning Guide

This guide explains how to configure the physics-backed yaw controller so designers can eliminate AI "bobbing" while keeping each hull responsive.

## Key Parameters

- **turnKp** — Proportional gain applied to yaw error (rad). Higher values yield faster correction.
- **turnKd** — Derivative gain applied to current angular velocity. Raises damping to prevent overshoot.
- **angularSettlingRate** — Maximum residual angular speed (rad/s) allowed once the hull is inside the settling band. Values near zero cause the ship to stop completely once aligned.
- **angularSettleToleranceDeg** — Heading error threshold (degrees) that triggers the settling clamp and disables visual slerp smoothing.

All values live under `ShipStats.motion` in `src/data/ships/*.ts`. Validation forbids negative values and clamps tolerances to ≤ 45°.

## Recommended Hull Values

| Hull      | turnKp | turnKd | Settling Rate (rad/s) | Settle Tolerance (°) |
| --------- | -----: | -----: | --------------------: | -------------------: |
| Fighter   |    6.2 |    1.2 |                 0.012 |                  3.0 |
| Corvette  |    5.0 |    1.1 |                  0.01 |                  3.5 |
| Frigate   |    4.2 |    1.0 |                 0.009 |                  4.0 |
| Destroyer |    3.6 |   0.95 |                 0.008 |                  4.5 |
| Carrier   |    3.0 |    0.9 |                 0.007 |                  5.0 |

> **Tip:** Start with the recommended pair for a new hull that shares a mass class, then adjust `turnKp` ±0.3 to reach the desired snap speed. Increase `turnKd` if oscillations appear; lower it if turns feel sluggish.

## Tuning Workflow

1. Capture a replay of the hull executing a 90° turn.
2. Increase `turnKp` until the ship approaches the target heading quickly.
3. Raise `turnKd` in 0.05 increments if you observe oscillation or "bobbing" near alignment.
4. Adjust `angularSettlingRate` downward until the ship stops drifting within 0.5 s of alignment.
5. Expand `angularSettleToleranceDeg` (up to 10°) when cinematic smoothing is visible but minor snap-back remains.
6. Re-run motion tests (`npm test -- motion.system`) to confirm convergence and coverage.

Settling logic automatically disables render-time `rotationSlerp` when the hull is within tolerance, ensuring the physics solution stays authoritative.
