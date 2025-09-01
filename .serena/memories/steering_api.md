## Steering

The `steering.ts` module provides a collection of functions for handling ship movement, orientation, and steering behaviors. These functions are used by the `AIController` to implement various AI intents like pursuing, evading, and grouping.

### Exported Functions

- **`calculateEscapeScore(shipPos: Vector3, targetPos: Vector3, threats: readonly Vector3[], friendlies: readonly Vector3[], bounds: SimBounds, settings: BehaviorConfig['globalSettings']): number`**
  - **Purpose:** Calculates a safety score for a potential escape position for a ship. A higher score indicates a safer position.
  - **Inputs:** The ship's current position, the target escape position, lists of threats and friendlies, the simulation bounds, and behavior settings.
  - **Outputs:** A numerical score for the potential escape position.
  - **Logic:** The score is calculated by considering penalties for proximity to threats and boundaries, and bonuses for increasing the distance from the nearest threat.

- **`moveTowards(ship: Ship, targetPos: Vector3, dt: number, settings: BehaviorConfig['globalSettings'], speedOverride?: number): void`**
  - **Purpose:** Moves a ship towards a target position.
  - **Inputs:** The `ship` to move, the `targetPos`, the time delta `dt`, behavior `settings`, and an optional `speedOverride`.
  - **Logic:** This function updates the ship's orientation to look at the target, and then updates its velocity and position to move it forward. It also handles acceleration, damping, and speed clamping based on the `PhysicsConfig`.

- **`calculateSeparationForceWithCount(shipPos: Vector3, neighbors: readonly Vector3[], separationDistance: number, magnitudeThreshold: number, random: RandomFn): { force: Vector3; neighborCount: number }`**
  - **Purpose:** Calculates a separation force to prevent a ship from clumping with nearby friendly ships.
  - **Inputs:** The ship's position, a list of `neighbors`, the desired `separationDistance`, a `magnitudeThreshold`, and a `random` function.
  - **Outputs:** An object containing the calculated separation `force` as a `Vector3` and the `neighborCount` that was considered.
  - **Logic:** The force is calculated by considering the positions of nearby neighbors and pushing the ship away from them. It includes fallbacks to handle symmetrical situations.