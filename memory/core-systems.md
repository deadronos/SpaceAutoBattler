# Memory — core-systems

File: `src/game/systems.ts`

Responsibilities:

- `updateGame(state, delta)`: orchestrates one simulation step; calls ship prep, projectile advance, Rapier step, transform sync, and projectile resolution.
- `prepareShips`: simple AI (nearest enemy), orientation, movement with world clamp, firing cooldown management and projectile spawn.
- `advanceProjectiles`: kinematic movement for bullets with world clamp.
- `syncTransforms`: copy Rapier rigid body transforms back onto ECS entities for renderer.
- `resolveProjectiles`: TTL handling, shield absorption + ripple emission, hull damage, entity cleanup.

Key details:

- Uses temp vectors to avoid allocations in hot loops.
- Shield ripple events are appended to `ShipEntity.shieldRipples` with capped history for rendering.
- Determinism: logic is purely derived from state, `delta`, and seeded RNG used on spawn; no random use here.

Follow-ups:

- Consider separation into smaller systems if behavior grows (targeting, movement, combat, cleanup).
- Add tests for edge cases: zero-distance targets, TTL expiry, world-boundary clamping.
