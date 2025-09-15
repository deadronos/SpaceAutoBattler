## SpawnSystem

Last-Reviewed: 2025-09-15

The `SpawnSystem` class centralizes the creation and removal of entities, particularly ships, within the simulation. It ensures that entities are properly initialized, registered with all relevant adapters (physics, rendering, spatial index), and cleaned up upon removal.

### Public Methods

- **`constructor(state: GameState, adapters?: { ... })`**
  - **Purpose:** Initializes the `SpawnSystem`.
  - **Inputs:** The `GameState` and an optional object containing adapters.

- **`onSpawnEvent(handler: (event: SpawnEvent) => void): () => void`**
  - **Purpose:** Subscribes to spawn-related events.
  - **Inputs:** A `handler` function for `SpawnEvent`s.
  - **Outputs:** An unsubscribe function.

- **`spawnShip(intent: SpawnIntent): SpawnResult`**
  - **Purpose:** Spawns a single ship based on a `SpawnIntent`.
  - **Inputs:** A `SpawnIntent` describing the ship to be spawned.
  - **Outputs:** A `SpawnResult` indicating success or failure and containing the spawned entity.

- **`spawnFleet(team: Team, count: number, options?: { ... }): SpawnResult[]`**
  - **Purpose:** Spawns an entire fleet of ships for a given team.
  - **Inputs:** The `team`, the `count` of ships to spawn, and optional `options` for classes and formation.
  - **Outputs:** An array of `SpawnResult` objects for each spawned ship.

- **`removeShip(shipId: EntityId): boolean`**
  - **Purpose:** Removes a ship from the simulation.
  - **Inputs:** The `shipId` of the ship to remove.
  - **Outputs:** `true` if the ship was successfully removed, `false` otherwise.
  - **Logic:** This method also handles the cleanup of the ship from all registered adapters.

- **`getStats(): { ... }`**
  - **Purpose:** Returns statistics about the spawned ships.
  - **Outputs:** An object containing statistics like the total number of ships, ships per team, and ships by class.

Session note: Reviewed and updated 2025-09-15.
