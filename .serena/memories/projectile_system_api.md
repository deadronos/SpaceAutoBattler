## ProjectileSystem

The `ProjectileSystem` class is responsible for managing the entire lifecycle of projectiles (bullets) in the simulation. This includes their creation, movement, collision detection, and destruction.

### Public Methods

- **`constructor(state: GameState, adapters?: { physics?: PhysicsAdapter; renderer?: RendererAdapter; spatial?: SpatialIndex; time?: TimeAdapter; })`**
  - **Purpose:** Initializes the `ProjectileSystem`.
  - **Inputs:** The `GameState` and an optional object containing adapters for physics, rendering, spatial indexing, and time.

- **`onProjectileEvent(handler: (event: ProjectileEvent) => void): () => void`**
  - **Purpose:** Allows other parts of the application to subscribe to projectile-related events.
  - **Inputs:** A `handler` function to be called when a `ProjectileEvent` is emitted.
  - **Outputs:** A function that can be called to unsubscribe from the events.

- **`fire(intent: FireIntent): EntityId | null`**
  - **Purpose:** Creates and fires a new projectile based on a `FireIntent`.
  - **Inputs:** A `FireIntent` object describing the firing request.
  - **Outputs:** The `EntityId` of the newly created bullet, or `null` if firing was not possible (e.g., due to cooldown or range).

- **`update(dt: number): void`**
  - **Purpose:** Updates the state of all projectiles in the simulation for a given time step.
  - **Inputs:** `dt` (the time delta).
  - **Logic:** This method handles:
    - Updating projectile positions based on their velocity.
    - Decrementing their time-to-live (TTL) and removing them if expired.
    - Applying boundary physics.
    - Checking for and processing collisions with ships.

- **`removeBullet(bulletId: EntityId): boolean`**
  - **Purpose:** Removes a specific bullet from the simulation.
  - **Inputs:** The `bulletId` of the bullet to remove.
  - **Outputs:** `true` if the bullet was found and removed, `false` otherwise.

- **`getStats(): { totalBullets: number; ... }`**
  - **Purpose:** Returns statistics about the projectiles currently in the simulation.
  - **Outputs:** An object containing statistics like the total number of bullets, bullets per team, average TTL, and average speed.