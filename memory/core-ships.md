# Memory — core-ships

File: `src/game/ships.ts`

Responsibilities:

- Declares `SHIP_STATS` per hull and provides `spawnShip()` to create ECS entity with Rapier body/collider.
- Initializes health/shield, combat stats, scale, model key, and shield ripple buffer.

Integration:

- Used by `state.ts` spawn helpers and by tests for deterministic setups.
- Colliders are registered in `GameState.colliderLookup` for potential future collision handling.

Tunables:

- Per-hull stats (hp, shield, damage, fireRate, projectile speed/range, movement speed, scale).
- Collider shapes/sizes if GLBs change scale.
