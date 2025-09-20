# AI / Systems API (summary)

Current implementation: `src/game/systems.ts` — this file contains the compact, simulation-integrated AI and physics-step helpers used in the prototype.

Key exported or surface-level helpers (conceptual):

- `updateGame(state: GameState, delta: number)` — main simulation step. Calls `prepareShips`, `advanceProjectiles`, steps the Rapier world, syncs transforms, and resolves projectiles.
- `prepareShips(state: GameState, dt: number)` — per-ship update that handles simple AI decisions: nearest-enemy selection, movement clamping, orientation, cooldown updates, and firing via `fireProjectile`.
- `findNearestEnemy(state: GameState, origin: Vector3, team: Team)` — helper performing a linear nearest-enemy search used by `prepareShips`.
- `fireProjectile(state: GameState, shipEntity, projectileBlueprint)` — helper to spawn projectile entities and set TTL/damage.
- `advanceProjectiles(state: GameState, dt: number)` — moves projectiles forward (simple kinematic integration) and decrements TTL.
- `resolveProjectiles(state: GameState)` — checks TTL and distance-based collisions, applies damage, and calls `destroyEntity` for removed entities.

Data shapes to be aware of (refer to `src/types/index.ts`):

- `GameState` — canonical runtime state (physics world, ECS world, colliderLookup, rng, queries, time counters).
- `ShipComponent` — position, orientation, hull, health, cooldowns.
- `ProjectileComponent` — owner, ttl, damage, velocity.

Notes:

- This file is the authoritative place to look when you need to modify or extend in-sim AI behavior. It intentionally keeps AI logic small and deterministic; for larger AI work consider extracting the design notes from `memory/core-aiController.md`.
# ai_controller_api

```
/**
 * AI Controller - Configurable AI behaviors for ships
 */
```

> Auto-generated stub — please review and expand.
