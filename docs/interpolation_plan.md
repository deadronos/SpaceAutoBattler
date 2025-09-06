# Interpolation Plan for Smooth Rendering

## Objective
Implement visual interpolation to ensure smooth rendering of entities (ships, bullets) when the simulation runs at a lower fixed timestep (e.g., 10 TPS) than the rendering frame rate (e.g., 60+ FPS). This will prevent choppy movement and provide a fluid user experience.

## Affected Components

1.  **`src/types/index.ts` (or relevant type definitions):**
    *   Modify `Ship` and `Bullet` interfaces to include properties for storing their previous state.

2.  **`src/core/gameState.ts` (`simulateStep` function):**
    *   At the beginning of each simulation step, capture the current positions and orientations of entities as their "previous" state.

3.  **Rendering Logic (e.g., `src/renderer/threeRenderer.ts` or similar):**
    *   In the main rendering loop, calculate an interpolation factor based on the time elapsed since the last simulation step.
    *   Use this factor to blend between the entity's previous and current simulated state for rendering.

## Detailed Steps

### Step 1: Update Type Definitions

*   **File:** `src/types/index.ts` (or the file where `Ship` and `Bullet` interfaces are defined).
*   **Changes:**
    *   Add `prevPos: Vector3;` to both the `Ship` and `Bullet` interfaces.
    *   Add `prevOrientation: Orientation;` to the `Ship` interface (assuming bullets don't have complex orientation that needs interpolation; if they do, add it there too).

    ```typescript
    // Example for Ship interface
    export interface Ship {
      // ... existing properties
      pos: Vector3;
      prevPos: Vector3; // New
      orientation: Orientation;
      prevOrientation: Orientation; // New
      // ... other properties
    }

    // Example for Bullet interface
    export interface Bullet {
      // ... existing properties
      pos: Vector3;
      prevPos: Vector3; // New
      // ... other properties
    }
    ```

### Step 2: Capture Previous State in `simulateStep`

*   **File:** `src/core/gameState.ts`
*   **Function:** `simulateStep(state: GameState, dt: number)`
*   **Changes:** At the very beginning of the `simulateStep` function, *before* any physics or AI updates modify `ship.pos`, `ship.orientation`, or `bullet.pos`, add loops to copy the current state to the `prev` properties.

    ```typescript
    export function simulateStep(state: GameState, dt: number) {
      // --- NEW: Capture previous state for interpolation ---
      for (const ship of state.ships) {
        ship.prevPos = { ...ship.pos }; // Deep copy
        ship.prevOrientation = { ...ship.orientation }; // Deep copy
      }
      for (const bullet of state.bullets) {
        bullet.prevPos = { ...bullet.pos }; // Deep copy
      }
      // --- END NEW ---

      // ... existing AI logic, spatial grid update, etc.
      // (where ship.pos, ship.orientation, bullet.pos are updated)
    }
    ```
    *   **Note:** Ensure `prevPos` and `prevOrientation` are initialized correctly when new entities are spawned (e.g., in `spawnShip`). They can initially be set to the same values as `pos` and `orientation`.

### Step 3: Implement Interpolation in Rendering Logic

*   **File:** Likely in `src/renderer/threeRenderer.ts` or the main rendering loop function.
*   **Function:** The main rendering/animation loop (e.g., `animate` or `render` function).
*   **Changes:**
    1.  **Track Simulation Time:** The rendering loop needs access to the `GameState`'s `time` property (which is updated in `simulateStep`). It also needs to know the `fixedSimulationDt` (which is `1 / state.simConfig.tickRate`).
    2.  **Calculate Interpolation Factor:**
        ```typescript
        // Assuming 'state' is the current GameState object
        // And 'lastRenderTime' is the timestamp of the previous render frame
        // And 'fixedSimulationDt' is 1 / state.simConfig.tickRate (e.g., 1 / 10 = 0.1)

        // Calculate how much time has passed since the last simulation step
        // This assumes state.time is updated at the end of simulateStep
        const timeSinceLastSimStep = state.time % fixedSimulationDt; // Or more robustly: (currentTime - lastSimulatedTime)

        // Calculate the interpolation factor (0.0 to 1.0)
        let interpolationFactor = timeSinceLastSimStep / fixedSimulationDt;
        interpolationFactor = Math.max(0, Math.min(1, interpolationFactor)); // Clamp between 0 and 1
        ```
        *   **Refinement for `timeSinceLastSimStep`:** A more robust way to calculate `timeSinceLastSimStep` would be to pass the `state.time` from the *previous* `simulateStep` call into the rendering function, or have the rendering function track the `state.time` from the last time it rendered. The key is to know how much time has passed *within the current simulation step*.

    3.  **Apply Interpolation to Entities:**
        *   Iterate through your Three.js meshes/objects that represent ships and bullets.
        *   For each object, access its corresponding `Ship` or `Bullet` data from the `GameState`.
        *   Perform linear interpolation (LERP) for position and spherical linear interpolation (SLERP) for orientation.

        ```typescript
        // Example for a Ship
        const shipMesh = /* get Three.js mesh for this ship */;
        const shipData = /* get Ship data from GameState */;

        // Interpolate position
        shipMesh.position.x = shipData.prevPos.x + (shipData.pos.x - shipData.prevPos.x) * interpolationFactor;
        shipMesh.position.y = shipData.prevPos.y + (shipData.pos.y - shipData.pos.y) * interpolationFactor;
        shipMesh.position.z = shipData.prevPos.z + (shipData.pos.z - shipData.pos.z) * interpolationFactor;

        // Interpolate orientation (assuming Euler angles for simplicity, Quaternions are better for rotations)
        // If using Quaternions, use .slerp()
        shipMesh.rotation.x = shipData.prevOrientation.pitch + (shipData.orientation.pitch - shipData.prevOrientation.pitch) * interpolationFactor;
        shipMesh.rotation.y = shipData.prevOrientation.yaw + (shipData.orientation.yaw - shipData.prevOrientation.yaw) * interpolationFactor;
        shipMesh.rotation.z = shipData.prevOrientation.roll + (shipData.orientation.roll - shipData.orientation.roll) * interpolationFactor;

        // Similar logic for bullets
        ```

## Considerations

*   **Initial State:** Ensure `prevPos` and `prevOrientation` are correctly initialized when entities are spawned. They should initially be set to the same values as `pos` and `orientation` to avoid visual glitches on spawn.
*   **Performance:** While interpolation adds a small computational overhead to rendering, it is generally far less expensive than running the entire simulation at a high frame rate.
*   **Debugging:** Debugging can become slightly more complex as the visual state no longer directly matches the discrete simulation state. Tools that can visualize both the interpolated and raw simulated positions can be helpful.
*   **Quaternion vs. Euler Angles for Orientation:** For 3D rotations, using Quaternions and `slerp` (spherical linear interpolation) is generally preferred over Euler angles and LERP, as Euler angles can suffer from gimbal lock and non-uniform interpolation. If your `Orientation` type uses Euler angles, be aware of these limitations.
*   **Networked Games:** This fixed timestep with interpolation approach is fundamental for client-side prediction and smoothing in networked multiplayer games.
