## Update Bullets

Last-Reviewed: 2025-09-07

This memory documents the `updateBullets` function responsible for advancing bullet/projectile positions and handling collision and lifetime logic.

### Responsibilities
- Integrate projectile velocities over `dt` to update positions.
- Decrement projectile lifetime and remove expired projectiles.
- Perform collision checks and apply damage to hit ships.
- Trigger visual effects via `GameState.assetPool` / renderer hooks.

### Input/Output
- Input: `state` (GameState), `dt` (delta time)
- Output: Mutates `state.projectiles`, `state.effects`, and `state.ships` (health/shield updates).

### Notes
- Uses spatial index for efficient collision queries when enabled.
- Deterministic given same state and RNG seed (for spread/randomness).