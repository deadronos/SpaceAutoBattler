# Physics API Summary

File: src/core/physics.ts

Purpose
- Provides a rapier-based physics stepper for optional physics integration. The module dynamically loads `@dimforge/rapier3d-compat` at runtime and exposes a PhysicsStepper with lifecycle and helper functions for interacting with the physics world.

Exports
- createPhysicsStepper(state: GameState): Promise<PhysicsStepper>
  - Asynchronously creates a Rapier World, configures timestep and iteration counts from PhysicsConfig, and returns an object implementing PhysicsStepper.
  - PhysicsStepper interface includes:
    - initDone: boolean
    - world: internal world object
    - step(dt: number): void — advances physics world and syncs rigid body transforms back into GameState ships
    - dispose(): void — removes colliders and rigid bodies and frees world resources
    - addShip(ship): any — creates a rigid body and collider for a ship, configured using PhysicsConfig collider dimensions
    - removeShip(shipId): void — removes bodies and colliders for the ship
    - raycast(origin, direction, maxDistance?): returns hit info or { hit: false }
    - sphereCast(center, radius): returns array of hits
    - applyForce(shipId, force): applies force to a rigid body
    - setGravity(gravity): sets world gravity vector

Behavioral Notes & Test Guidance
- The physics stepper is optional — the rest of the simulation can run without physics if not enabled. Tests should mock or stub the physics stepper when verifying pure game logic or when `@dimforge/rapier3d-compat` is not available in the test environment.
- createPhysicsStepper dynamically requires rapier. In environments where native WASM or native bindings are not available (some CI runners), tests should skip physics integration tests or use a lightweight stub of the PhysicsStepper.
- Methods are defensive and log errors; most methods return fallbacks (e.g., raycast returns { hit: false }). Tests should assert expected behavior when physics world is functioning and when it returns fallback values.

Suggested Tests
- Mock Rapier to confirm createPhysicsStepper returns an object with declared methods and that addShip/removeShip manage internal maps.
- Test step(dt) with a mock world where rigid bodies translation and linvel return predictable values; verify state.ships are updated accordingly.
- Test raycast/sphereCast handles exceptions and returns fallback structures when Rapier operations fail.

Memory: physics_api (written)
