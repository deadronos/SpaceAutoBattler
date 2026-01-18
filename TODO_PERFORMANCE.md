# Performance Optimization Roadmap

Targeting `[Violation] 'requestAnimationFrame' handler took Xms` issues.

## 1. Prevent Simulation "Death Spiral"

**Location:** `src/components/BattlefieldSystems.tsx`

- **Issue:** The main loop executes `updateGame` multiple times (up to 5) when `delta` is high. If `updateGame` is slow (e.g., 60ms), running it 5 times creates a 300ms freeze, causing a larger `delta` next frame.
- **Action:**
  - Implement a strict time budget (e.g., 12-15ms) for the simulation loop.
  - Break the `while` loop if the budget is exceeded.
  - Dynamically reduce `MAX_ALLOWED_SIMULATION_SUBSTEPS` if FPS is consistently low.

## 2. Optimize Spatial Hash Rebuilding

**Location:** `src/game/systems/damage.ts` -> `resolveProjectiles`

- **Issue:** `buildSpatialHash` is called every frame, allocating new Maps and Arrays for all ships (O(N)).
- **Action:**
  - Persist the `SpatialHash` instance between frames.
  - Implement an incremental update or clearer/dirty system.
  - Alternatively, throttle the rebuild to run only every N frames (e.g., every 3-5 frames) and accept slight inaccuracy for collision detection flexibility.

## 3. Throttle Global AI & Sensor Updates

**Location:** `src/game/systems/decision/manager.ts`

- **Issue:** While decision-making (`runShipDecisions`) is time-sliced, the setup phases (`updateSensorSystem`, `refreshBlackboard`, `assignTeamRoles`) often run for ALL ships every single tick.
- **Action:**
  - Apply time-slicing to `updateSensorSystem`.
  - Only update sensors for the specific batch of ships being processed that tick.
  - Cache blackboard metrics and update them incrementally or at a lower frequency (e.g., 10Hz instead of 60Hz).

## 4. Optimize Particle Trails

**Location:** `src/components/ParticleTrails.tsx`

- **Issue:** Iterates over every single ship and calculates thruster positions in world space on the CPU every frame.
- **Action:**
  - **Frustum Culling:** Skip processing for ships that are not visible to the camera.
  - **LOD:** Disable trails or reduce particle count for distant ships.
  - **GPU Offload:** Move the thruster position calculation to a compute shader or vertex shader if possible to remove the CPU overhead entirely.

## 5. Production Optimizations & Debug Stripping

**Location:** `src/components/environment/starDisk/useStarDiskFrameLoop.ts` & others

- **Issue:** Excessive object allocation (`new Vector3`, `new Map`) and debug checks running in the hot loop.
- **Action:**
  - Wrap all debug logic in `if (import.meta.env.DEV) { ... }` blocks so they are dead-code eliminated in production.
  - Use object pooling for `Vector3` / `Quaternion` calculations in `useFrame` loops to reduce Garbage Collection pressure.
