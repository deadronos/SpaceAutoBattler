## AIController

Last-Reviewed: 2025-09-07

The `AIController` class is the central component for managing ship AI in the simulation. It is responsible for orchestrating ship behaviors, intents, and actions based on the game state and configurable AI personalities.

### Public Methods

- **`constructor(state: GameState)`**
  - **Purpose:** Initializes a new instance of the `AIController`.
  - **Inputs:** `state` (the `GameState` object).

- **`updateAllShips(dt: number)`**
  - **Purpose:** The main entry point for updating the AI of all ships in the simulation for a given time step.
  - **Inputs:** `dt` (the time delta for the simulation step).
  - **Logic:** Iterates through all ships and calls `updateShipAI` for each living ship. It also manages team-level concerns like alarms and scout assignments.

- **`updateShipAI(ship: Ship, dt: number)`**
  - **Purpose:** Updates the AI logic for a single ship.
  - **Inputs:** `ship` (the `Ship` object to update), `dt` (the time delta).
  - **Logic:** This method is the core of the ship-level AI. It handles:
    - Initializing the ship's AI state (`aiState`).
    - Re-evaluating the ship's current intent (e.g., `pursue`, `evade`, `patrol`) based on personality, threats, and other conditions.
    - Executing the chosen intent, which involves steering and movement.
    - Updating the ship's turret AI for independent targeting.
    - Managing shield regeneration.

- **`previewDecisionEngineEvade(ship: Ship): { score: number; wouldEvade: boolean }`**
  - **Purpose:** A public helper method to preview whether the decision engine would recommend an 'evade' intent for a ship based on its current situation (e.g., proximity to threats, recent damage).
  - **Inputs:** `ship` (the `Ship` object).
  - **Outputs:** An object containing the calculated `score` and a `wouldEvade` boolean.

- **`calculateSeparationForceWithCount(ship: Ship): { force: Vector3; neighborCount: number }`**
  - **Purpose:** A public helper to calculate the separation force needed to prevent a ship from clumping with nearby friendly ships.
  - **Inputs:** `ship` (the `Ship` object).
  - **Outputs:** An object containing the calculated separation `force` as a `Vector3` and the `neighborCount` that was considered.
