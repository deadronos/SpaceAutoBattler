# Performance Optimization Roadmap

Targeting `[Violation] 'requestAnimationFrame' handler took Xms` issues.

## 1. ~~Prevent Simulation "Death Spiral"~~ ✅ DONE

**Location:** `src/components/BattlefieldSystems.tsx`

- **Issue:** The main loop executes `updateGame` multiple times (up to 5) when `delta` is high. If `updateGame` is slow (e.g., 60ms), running it 5 times creates a 300ms freeze, causing a larger `delta` next frame.
- **Action:**
  - Implement a strict time budget (e.g., 12-15ms) for the simulation loop.
  - Break the `while` loop if the budget is exceeded.
  - Dynamically reduce `MAX_ALLOWED_SIMULATION_SUBSTEPS` if FPS is consistently low.

## 2. ~~Optimize Spatial Hash Rebuilding~~ ✅ DONE

**Location:** `src/game/systems/projectileCollisions.ts` -> `resolveProjectiles` (re-exported by `src/game/systems/damage.ts`)

- **Issue:** `buildSpatialHash` is called every frame, allocating new Maps and Arrays for all ships (O(N)).
- **Action:**
  - Persist the `SpatialHash` instance between frames.
  - Implement an incremental update or clearer/dirty system.
  - Alternatively, throttle the rebuild to run only every N frames (e.g., every 3-5 frames) and accept slight inaccuracy for collision detection flexibility.

## 3. ~~Throttle Global AI & Sensor Updates~~ ✅ DONE

**Location:** `src/game/systems/decision/manager.ts`

- **Issue:** While decision-making (`runShipDecisions`) is time-sliced, the setup phases (`updateSensorSystem`, `refreshBlackboard`, `assignTeamRoles`) often run for ALL ships every single tick.
- **Action (as implemented):** rather than per-batch slicing, the setup phases are throttled to run every `SENSOR_UPDATE_INTERVAL` ticks over all ships — `if (manager.tickIndex % SENSOR_UPDATE_INTERVAL === 0) { updateSensorSystem(...); refreshBlackboard(...) }` (`src/game/systems/decision/manager.ts`). The AI base tick is 12 Hz (`src/game/config/aiConfig.ts`), not 60 Hz.
  - Superseded sub-ideas (not implemented): per-batch sensor slicing; incremental blackboard caching.

## 4. ~~Optimize Particle Trails~~ ✅ DONE

**Location:** `src/hooks/useParticleTrailSimulation.ts` (rendered by `src/components/ParticleTrails.tsx`)

- **Issue:** Iterates over every single ship and calculates thruster positions in world space on the CPU every frame.
- **Action:**
  - **Frustum Culling:** Implemented. Skip processing for ships that are not visible to the camera.
  - **LOD:** Implemented. Disable trails for distant ships (> 500 units).
  - **GPU Offload:** (Decided against for now as Culling/LOD was sufficient)

## 5. ~~Production Optimizations & Debug Stripping~~ ✅ DONE

**Location:** `src/renderer/starDisk/*` and `src/components/environment/StarSphere.tsx` (the old `starDisk/useStarDiskFrameLoop.ts` was removed with the StarDisk→StarSphere migration)

- **Issue:** Excessive object allocation (`new Vector3`, `new Map`) and debug checks running in the hot loop.
- **Action:**
  - **Debug Logic:** Wrapped all debug tools/telemetry in `import.meta.env.DEV` to ensure dead-code elimination in production.
  - **Object Pooling:** Reused `uniformUpdate` object to reduce GC pressure.
