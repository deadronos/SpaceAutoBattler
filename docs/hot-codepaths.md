I’ll scan the src tree and key engine systems in parallel to pinpoint the main runtime hot paths.

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src)

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/AGENTS.md)

Searched for regex `useFrame\(|step\(|update\(|physics|Rapier|Loop` (`**/src/**`), 200 results

I’ll dig into the main game and render loops under src to pinpoint ~5 hotspots and then propose targeted performance tweaks for each.

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/README.md)

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/game/systems.ts)

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/game/physics/index.ts)

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/game/systems/motion/index.ts)

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/game/systems/projectiles/advance.ts)

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/hooks/useShipInterpolation.ts)

Searched for regex `useFrame\(` (`**/src/**`), 21 results

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/components/BattlefieldSystems.tsx)

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/components/layers/ProjectilesInstancedLayer.tsx#120-120), lines 120 to 221

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/components/thrusters/ThrusterInstancedManager.tsx#100-100), lines 100 to 192

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/components/explosions/ExplosionRendererCore.tsx#40-40), lines 40 to 183

Starting: _Inspect key systems and loops for perf issues_ (2/3)

I’ve identified the core frame and system loops; now I’ll inspect a few representative per-entity and rendering loops to rank the top hotspots and craft targeted perf suggestions.

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/hooks/useShipThrusters.ts#150-150), lines 150 to 224

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/components/layers/ProjectilesInstancedLayer.tsx#1-1), lines 1 to 181

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/components/explosions/DynamicLightManager.tsx)

Starting: _Summarize top 5 hotspots with improvements_ (3/3)

Read [](file:///d%3A/GitHub/SpaceAutoBattler/src/hooks/interpolation/updateInterpolation.ts)

Completed: _Summarize top 5 hotspots with improvements_ (3/3)

Here are the five most likely hot codepaths under src and concrete performance ideas for each.

**1. `BattlefieldSystems` → `updateGame` (main simulation loop)**  
Files: BattlefieldSystems.tsx, systems.ts

- **Why it’s hot**: Runs every render frame via `useFrame`, and may call `updateGame` multiple times per frame (fixed-step loop with `sim.accumulator` / `sim.maxSubSteps`). Inside `updateGame` every subsystem runs plus a Rapier `physicsWorld.step()`, and each subsystem invocation is wrapped in `measureSubsystem` (two `performance.now()` calls + try/catch) and `runSafely` (nested try/catch and snapshotting).
- **Potential issues**:
  - Always-on subsystem timing (`performance.now()` around every subsystem) adds measurable overhead, especially if you do multiple physics substeps per frame.
  - Always-on defensive `runSafely` + `safeSnapshot` on every subsystem can be costly; `safeSnapshot` walks a fair chunk of state when an error occurs.
  - If `sim.step` is very small and `sim.maxSubSteps` high, you can end up doing many tight loops of all subsystems + Rapier per frame.
- **Improvements**:
  - **Gate profiling**: Add a flag (e.g. `sim.profileSubsystems` or a debug UI toggle) and only call `measureSubsystem` when enabled; otherwise call subsystems directly without `performance.now()`. Optionally sample every Nth tick (e.g. profile 1/30 ticks) instead of every tick.
  - **Gate defensive wrappers**: In production/“stable” runs, consider a lighter path where subsystems are invoked directly; keep `runSafely` + `safeSnapshot` under a `sim.enableSubsystemGuards` or dev-build check.
  - **Tune substep parameters**: Use config/memory to ensure `sim.step` and `sim.maxSubSteps` are tuned for your target hardware (e.g. cap to a small integer like 2–3 for typical play); high substep counts explode cost because every call includes AI, motion, projectiles and Rapier.
  - **Keep Rapier fast-path clean**: Avoid doing any extra work between `physicsStart` and `physicsWorld.step()` (no logging, no allocations); that part looks good now—just avoid adding work there.

---

**2. `updateMotionSystem` (per-ship physics / motion)**  
File: index.ts

- **Why it’s hot**: Runs once per simulation step and loops all ships (`state.queries.ships.entities`), doing angular motion, linear motion and `applyVelocityToPhysics` (which touches Rapier kinematic bodies).
- **Potential issues**:
  - You iterate all ships but only update ones with `ship.ai?.command`; the filter is per-ship in the loop instead of at query level.
  - Depending on implementation of `updateAngularMotion`, `updateLinearMotion`, and `applyVelocityToPhysics`, you may be allocating new vectors or doing expensive math per ship per substep.
- **Improvements**:
  - **Narrow the query**: If possible, define a dedicated Miniplex archetype like `shipsWithCommands` (ships that have both `ship` and `ai.command`) and iterate that instead of `state.queries.ships.entities`, eliminating the per-iteration `if (!ship.ai?.command) continue;`.
  - **Audit math utilities**: Ensure `updateAngularMotion`, `updateLinearMotion`, and `physicsSync` reuse pre-allocated `Vector3`/`Quaternion` instances (as you already do in other hot paths) and avoid constructing objects in the loop.
  - **Early outs for idle ships**: If a `command` implies “no movement” (e.g. zero thrust and turn), consider early-outing before calling the motion helpers to skip unnecessary calculations.

---

**3. `advanceProjectiles` (projectile simulation)**  
File: advance.ts

- **Why it’s hot**: Iterates all `projectiles` every simulation step; handles homing logic, computes new positions, clamps to world, and schedules kinematic updates via `deferSetNextKinematicTranslation` and `deferSetNextKinematicRotation`.
- **Potential issues**:
  - **Category resolution per tick**: `const category = projectile.projectile.category ?? resolveProjectileCategory(projectile.projectile.bulletType);` recalculates category for every projectile every step if `category` isn’t pre-populated.
  - **Target lookup per tick**: For homing shots, `findShipById(state, projectile.projectile.targetId)` each step can be expensive if the lookup is linear over many ships.
  - **Two deferred calls per projectile**: Every non-beam projectile queues both translation and rotation mutations; for thousands of projectiles, that’s a lot of queue writes.
- **Improvements**:
  - **Persist projectile metadata**: At spawn time (in `physicsAdapter` / `spawnProjectileEntity`), compute and store `projectile.projectile.category` and any other static info (e.g., resolved `ResolvedProjectileInfo`) on the entity so `advanceProjectiles` can read it without calling `resolveProjectileCategory`.
  - **Faster homing lookups**: Instead of `findShipById` each frame, maintain an `id → ship` map or attach a stable `targetRef` on the projectile when locking on; only refresh when targets die or leave the world.
  - **Batch or specialize kinematic updates**: If many projectiles share the same motion pattern, consider a batched Rapier update or a “pure visual” path for certain projectile types that don’t need a physical collider after initial spawn.
  - **Skip dormant projectiles**: If any projectiles are out-of-bounds, expired, or in a “waiting” phase, avoid doing the math/defers for them by early-out flagging them as inactive.

---

**4. `ProjectilesInstancedLayer.useFrame` (projectile rendering)**  
File: ProjectilesInstancedLayer.tsx

- **Why it’s hot**: Runs every render frame; loops through all projectiles and updates instanced matrices. This is likely the biggest rendering-side hot path when lots of bullets are in flight.
- **Potential issues**:
  - Per-frame `key` and category computation: `const key = projectile.projectile.bulletType ?? 'bullet:laser'` and `const category = projectile.projectile.category ?? info.category` for every projectile.
  - `manager.allocate(projectile.id)` performs an ID → instance-index lookup every frame, which may involve a map or search inside the manager.
  - Even with `HIGH_DENSITY_THRESHOLD` and `HIGH_DENSITY_UPDATE_INTERVAL`, you still fully rebuild instancing state on most frames at high projectile counts.
- **Improvements**:
  - **Cache projectile display config**: At spawn, assign precomputed `renderKey` and `resolvedInfo` onto the projectile entity (e.g., `projectile.render.key`, `projectile.render.info`) so `ProjectilesInstancedLayer` only reads those fields instead of recomputing `key` and category.
  - **Simplify allocation strategy**: If `projectile.id` is dense or bounded, consider using a ring-buffer or index counter per group instead of an ID→index map; or update only when projectiles are created/destroyed and reuse indices otherwise.
  - **LOD / quality scaling**: Use a quality setting or camera distance to lower `maxTotal` when projectiles are far away, or render far-away projectiles as cheaper trails / screen-space effects instead of full 3D instanced meshes.
  - **Skip transform recomputation**: For projectiles that didn’t move this frame (e.g. beams with fixed endpoints, or if you step physics at a lower rate than render), you can avoid recomputing the matrix every render frame and only update on physics ticks.

---

**5. `useShipInterpolation` → `updateInterpolation` (ship visual smoothing)**  
Files: useShipInterpolation.ts, updateInterpolation.ts

- **Why it’s hot**: Runs once per frame for every rendered ship. `updateInterpolation` does interpolation, visual bobbing, banking, and smoothing using trigonometric functions and exponentials.
- **Potential issues**:
  - Every frame you compute bobbing (`Math.sin`/`Math.cos`) and banking (`Math.exp` in critically damped mode) even for ships that might be off-screen or very small on screen.
  - Interpolation/smoothing work is always done when `useShipInterpolation` is attached, regardless of LOD or ship importance.
- **Improvements**:
  - **LOD-aware smoothing**: Integrate the existing ship LOD system so that distant or impostor-level ships either skip bobbing/banking entirely or use a cheaper path (e.g. disable `visualCfg.bob` and `bank` when LOD is “impostor”).
  - **Cheap paths for extremes**: Add early exits in `updateInterpolation` when `alpha` is exactly 0 or 1 and visual smoothing is disabled; in those cases you can copy transforms once and skip bobbing/banking math.
  - **Config-driven toggles**: Extend `RENDERER_VISUAL_CONFIG` with per-feature toggles (`enableShipBob`, `enableShipBanking`) so you can easily scale back these effects on lower-end devices or when the frame budget is tight.
  - **Reuse and precompute constants**: Where possible, precompute non-entity-specific values (e.g. `2 * Math.PI` for frequency) once, or store derived bob/bank parameters in the ship’s motion config so you don’t re-derive them every frame.

---

If you’d like, I can next:

- Sketch small code changes (behind feature flags) to gate profiling/guards in `updateGame`, and
- Draft a config-driven “performance mode” that switches off or simplifies 2–3 of these hot paths for heavier scenes.
