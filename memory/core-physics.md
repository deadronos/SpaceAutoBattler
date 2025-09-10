# core-physics.md

## Purpose

Short memory describing `src/core/physics.ts` — the Rapier-based physics stepper used by the simulation.

## Location

src/core/physics.ts

## Summary

`createPhysicsStepper(state)` dynamically initializes a Rapier physics `World` and returns a `PhysicsStepper` object that provides stepping, body management, and basic queries (raycast, sphereCast). The stepper is intended to be used in the simulation loop or inside a worker (`simWorker.ts`) and writes physics-driven transforms back into `GameState.ship` objects.

## Key Responsibilities

- Dynamically import or require `@dimforge/rapier3d-compat` to avoid loading WASM at module eval time.
- Configure the physics world using `PhysicsConfig` (timestep, iteration counts, collider defaults).
- Provide an API:
  - `initDone`: boolean
  - `world`: the Rapier world instance
  - `step(dt)`: advance physics by dt and update ship positions/velocities in `state.ships`.
  - `addShip(ship)`: create rigid body and collider for a ship and return the rigid body.
  - `removeShip(shipId)`: remove collider/rigid body for a ship.
  - `raycast(origin, direction, maxDistance?)`: perform raycast and return hit info.
  - `sphereCast(center, radius)`: perform a spherecast and return hits.
  - `applyForce(shipId, force)`: apply a force to a rigid body.
  - `setGravity(newGravity)`: update world gravity vector.
  - `dispose()`: cleanup colliders and bodies and free world resources.

## Integration Points

- Intended for use inside `simWorker.ts` or an in-thread fallback in `main.ts` if worker is disabled.
- Reads `state.ships` and writes back `ship.pos` and `ship.vel` after each `step`.
- Uses `PhysicsConfig` and `PhysicsConfig.colliders` to select collider sizes per ship class.

## Performance & Safety Notes

- Wraps calls in try/catch to avoid throwing across worker boundaries and logs errors.
- `addShip` and `removeShip` are resilient to repeated/removal attempts.
- `step` updates ship data in-place; the simulation owns the authoritative positions when physics is enabled.

## Edge Cases & Fallbacks

- If Rapier isn't available or initialization fails, callers should handle the exception upstream and optionally use an in-thread fallback physics stepper.
- Ray/sphere cast implementations log and return safe defaults on failure.

## Where to look

- `src/simWorker.ts` for worker-side usage and message protocol.
- `src/core/gameState.ts` to see when and how the physics stepper is created/used in the simulation tick.

## References

- src/config/physicsConfig.ts
- src/simWorker.ts
