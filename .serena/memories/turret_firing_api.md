## Turret Firing

Last-Reviewed: 2025-09-07

This memory documents the turret firing logic used by ships.

### Responsibilities

- Decide when turrets should fire based on turret cooldown, target lock, and ship commands.
- Compute projectile spawn position and direction, applying turret-level spread.
- Deduct ammo or energy if applicable and place projectile entities into `state.projectiles`.
- Record `lastFired` timestamps and manage turret cooldowns.

### API

- `fireTurrets(ship: Ship, state: GameState, now: number)`
  - Advances turret cooldowns and spawns projectiles when appropriate.

### Notes

- Turret firing is deterministic; uses seeded RNG for spread.
