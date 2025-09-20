## Projectile System

Last-Reviewed: 2025-09-15

The Projectile System is responsible for updating bullets/projectiles each simulation tick. It handles movement, collision queries, lifespan, and applying damage to hit ships.

### Responsibilities

- Move projectiles forward by their velocity delta each tick.
- Reduce lifetime and mark for removal when expired.
- Perform collision checks against ships using the spatial index or bounding volumes.
- On hit: apply damage to the target ship, register `lastDamageBy`/`lastDamageTime`, spawn impact effects via `GameState.assetPool` or `renderer` hooks, and mark the projectile as removed.

### Inputs & Outputs

- Inputs: `state` (GameState), `dt` (delta time)
- Outputs: Mutates `state.projectiles`, `state.effects`, and potentially `state.ships` (health/shield reductions)

### Determinism & Performance

- Deterministic given same initial state and RNG seed for any randomness (e.g., spread). Typically O(#projectiles + collision checks) per tick; spatial partitioning is used to reduce checks.

Session note: Reviewed and confirmed 2025-09-15.
