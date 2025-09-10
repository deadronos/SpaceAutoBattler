## Steering API

Last-Reviewed: 2025-09-07

This memory documents steering helpers used by AI and movement systems.

### Functions

- `computeSteeringForce(ship: Ship, targetPos: Vector3, maxForce: number): Vector3`
- `applyThrust(ship: Ship, force: Vector3, dt: number)`

### Responsibilities

- Provide deterministic steering calculations used by AI intents (pursue, evade, roam).
- Offer utility methods for arrival, pursuit, and obstacle avoidance.
