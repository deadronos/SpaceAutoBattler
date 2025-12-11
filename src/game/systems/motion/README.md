# game/systems/motion/ - Movement & Steering

Handles ship movement, velocity, acceleration, and steering calculations.

## Motion Files

| File               | Purpose                                                         |
| ------------------ | --------------------------------------------------------------- |
| **linear.ts**      | Linear motion calculations (velocity, acceleration in 3D space) |
| **angular.ts**     | Angular/rotational motion (torque, angular velocity)            |
| **math.ts**        | Shared math utilities for motion calculations                   |
| **physicsSync.ts** | Synchronizes motion with Rapier3D physics bodies                |
| **sharedTemps.ts** | Temporary vectors/matrices reused to avoid allocations          |
| **index.ts**       | Main motion system export and orchestration                     |

## Motion System

The motion system provides:

- Newtonian physics-based movement
- Acceleration and velocity application
- Rotation and angular velocity
- Steering behavior calculation
- Physics body synchronization

## Integration with Physics

- Works with Rapier3D rigid bodies
- Updates velocities based on applied forces
- Handles drag and friction
- Manages collision responses

## Performance Optimization

- Reuses temporary vectors to avoid allocations in hot path
- Batch updates for multiple ships
- Deterministic via seeded RNG
