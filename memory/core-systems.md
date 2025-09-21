# Memory — core-systems

File: `src/game/systems.ts`

Responsibilities

- `updateGame(state, delta)`: top-level per-tick orchestration. The current order is:
  1. `prepareShips(state, delta)` — AI and ship-driven actions (movement, firing, embedded turret fallback).
  2. `updateTurrets(state, delta)` — turret entity updates (aiming, firing).
  3. `advanceProjectiles(state, delta)` — move projectiles kinematically and clamp to world.
  4. `state.physicsWorld.step(state.eventQueue)` — step Rapier physics.
  5. `syncTransforms(state)` — copy rigid body transforms back into ECS transform objects.
  6. `resolveProjectiles(state, delta)` — TTL handling, collision checks (distance-based), shield absorption & ripple emission, hull damage, and queued destruction.

Key details

- `prepareShips`: simple AI (nearest enemy), orientation, movement with world clamp, firing cooldown management and projectile spawn.
- `updateTurrets`: updates turret entity kinematics, aiming arcs, and firing when within arc.
- `advanceProjectiles`: kinematic movement for bullets with world clamp.
- `syncTransforms`: copy Rapier rigid body transforms back onto ECS entities for renderer.
- `resolveProjectiles`: TTL handling, shield absorption + ripple emission, hull damage, and entity cleanup.

Implementation notes

- Uses temporary Vector3 instances (`TEMP_DIR`, `TEMP_POS`) to avoid per-frame allocations in hot loops.
- Projectile visuals and physics sizes are determined via `PROJECTILE_CONFIG` mapping with a `DEFAULT_PROJECTILE_CONFIG` fallback.
- The collision / damage model is intentionally simple and distance-based (no Rapier collision events used for damage resolution in this path).

Follow-ups

- Tests should verify both the turret-entity flow (when turret entities exist) and the legacy embedded turret fallback (when `state.queries.turrets.entities.length === 0`).
- Consider adding explicit unit tests for turret priority selection and the scoring heuristic.
- If you plan to switch to Rapier collision events for projectile hit detection, note the need to update `resolveProjectiles` and remove the distance-based checks.

Generated: 2025-09-21 (automated draft)
