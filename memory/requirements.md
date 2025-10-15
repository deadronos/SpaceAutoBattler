# Requirements Log

## 2025-10-14 — Weapon Category Expansion (TASK248)

1. **WHEN** a projectile with `category === 'missile'` or `category === 'torpedo'` is spawned, **THE SYSTEM SHALL** initialise its homing target, arming timer, and any configured AoE radius so guidance and detonation behaviour follow `PROJECTILE_CONFIG`. *(Acceptance: unit tests spawn missiles and torpedoes via `fireProjectile` and assert runtime components match the config values.)*
2. **WHEN** a missile or torpedo collides with a target before its `armingTime` has elapsed, **THE SYSTEM SHALL** defer detonation and leave the impacted ship unharmed until the projectile becomes armed. *(Acceptance: damage system test drives an early collision and verifies shields/hull remain unchanged while the projectile persists.)*
3. **WHEN** a torpedo or missile detonates with an `aoeRadius` configured, **THE SYSTEM SHALL** apply damage to all enemy ships within that radius using effectiveness calculations and XP attribution consistent with existing projectile hits. *(Acceptance: AoE test positions multiple ships inside the radius and confirms cumulative damage plus XP attribution to the source ship.)*
4. **WHEN** a weapon with `category === 'beam'` fires, **THE SYSTEM SHALL** perform an immediate raycast to apply damage to the first intersected enemy and register a short-lived beam visual so renderer layers display the shot for its configured TTL. *(Acceptance: beam test fires a beam, verifies instant hull reduction on the hit ship, and asserts a beam visual record is enqueued.)*
5. **WHEN** a turret marked for point-defense detects an incoming missile within its PD range, **THE SYSTEM SHALL** prioritise targeting that projectile over ship targets and attempt to destroy it before it reaches allied ships. *(Acceptance: AI decision test seeds a PD turret, spawns an incoming missile, and asserts the turret selects the missile entity as its active target.)*

## 2025-10-14 — Beam Shader Falloff (TASK249)

1. **WHEN** the beam projectile material factory initialises, **THE SYSTEM SHALL** read the beam shader falloff configuration and populate the shader uniforms for near brightness, far brightness, and falloff exponent with those values. *(Acceptance: renderer unit test instantiates the factory and asserts the material uniforms mirror the config defaults.)*
2. **WHEN** the instanced beam layer uploads per-projectile data, **THE SYSTEM SHALL** provide a per-instance brightness scalar (defaulting to 1.0) so the shader can modulate intensity per shot without reallocating geometry buffers. *(Acceptance: instanced layer test updates beams without overrides and verifies the new instanced buffer attribute exists and is populated with 1.0.)*
3. **WHEN** the beam shader shades a fragment, **THE SYSTEM SHALL** apply inverse-squared falloff along the beam length that clamps to the configured near and far brightness bounds raised to the configured exponent. *(Acceptance: shader factory test inspects the compiled fragment shader string and asserts the falloff computation references the uniforms and inverse-squared term.)*

## 2025-10-14 — Beam Shader Instancing Compatibility (TASK250)

1. **WHEN** the beam projectile shader material initialises with instanced colors enabled, **THE SYSTEM SHALL** declare and consume the `instanceColor` attribute inline without referencing unavailable Three.js include chunks so shader compilation succeeds. *(Acceptance: renderer test asserts the vertex shader string contains `attribute vec3 instanceColor;` and omits `#include <instanceColor_pars_vertex>`.)*
2. **WHEN** a beam projectile renders without per-instance color data, **THE SYSTEM SHALL** default the shader's instance color to white so the beam remains visible. *(Acceptance: renderer test asserts the vertex shader includes the fallback branch assigning `vec3(1.0)` when `USE_INSTANCING_COLOR` is not defined.)*
3. **WHEN** a ship's shield ratio meets or exceeds the visibility threshold within a frame, **THE SYSTEM SHALL** treat the shield bubble as visible using the latest computed fraction and suppress the "should be visible" warning. *(Acceptance: shield utils test exercises a scenario with a stale prior fraction but a latest fraction above the threshold and expects `validateShieldVisibility` to return null.)*

## 2025-10-15 — Beam Visual Alignment (TASK251)

1. **WHEN** a beam weapon spawns, **THE SYSTEM SHALL** capture the firing source's local-space muzzle offset and shot direction so each beam visual stores `localOrigin` and `localDirection` metadata for rebuilds. *(Acceptance: unit test fires a beam, inspects the resulting beam entity, and asserts both vectors exist with components matching the expected transformed muzzle offset.)*
2. **WHEN** the beam visuals system advances and the source ship or turret is still alive, **THE SYSTEM SHALL** reconstruct the beam's world position and direction from the stored local metadata so the render origin stays within 0.5 units of the source muzzle despite source movement. *(Acceptance: system test moves/rotates the source ship between ticks and expects the beam transform position/direction to align with the recomputed world-space muzzle with ≤0.5 unit error.)*
3. **WHEN** a beam hits a target closer than the configured minimum visibility distance, **THE SYSTEM SHALL** clamp the beam's rendered length to that minimum while still respecting the configured maximum range to keep the impact visible. *(Acceptance: renderer-layer test spawns a beam with `length` below the threshold and asserts the instance scale Z component equals the minimum, capped by `maxLength`.)*
4. **WHEN** the beam visuals system cannot find the source ship/turret for a beam entity, **THE SYSTEM SHALL** destroy that beam within the same tick so no orphan visuals linger in the scene. *(Acceptance: system test deletes the source ship before advancing and expects the beam entity collection to no longer contain the beam after one call.)*

## 2025-10-15 — Beam Visual Fade Controls (TASK252)

1. **WHEN** a beam projectile uses the default visual configuration, **THE SYSTEM SHALL** render the beam at full brightness for its entire lifetime so close-range hits remain visible. *(Acceptance: renderer unit test constructs a beam visual without fade overrides and asserts the instance color scalar stays at `1.0` regardless of reported beam length.)*
2. **WHEN** a beam projectile defines fade parameters in its configuration, **THE SYSTEM SHALL** scale the rendered brightness according to the configured strength and exponent as the beam approaches its maximum length. *(Acceptance: renderer helper test seeds a beam with `fade.strength = 0.5`, `fade.exponent = 2` and verifies the resulting dim factor equals `1 - 0.5 * (length / maxLength) ** 2`.)*
3. **WHEN** fade parameters are omitted or invalid (non-finite strength/exponent), **THE SYSTEM SHALL** clamp them to safe defaults and fall back to no fade so beam visuals do not disappear unexpectedly. *(Acceptance: configuration resolver test passes NaN/negative values and expects the resolved fade config to report `strength = 0` and `exponent = 1`.)*

## 2025-10-06 — Thruster Trail GPU Migration (TASK246)

1. **WHEN** the `ParticleTrails` component initialises with GPU buffers enabled, **THE SYSTEM SHALL** allocate an `InstancedBufferGeometry` populated with spawn position, velocity, lifetime, and scale attributes sized to `PARTICLE_TRAILS_CONFIG.maxParticles`. *(Acceptance: `test/vitest/particle-trails-gpu.spec.tsx` mounts the component with injected resources and asserts each instanced attribute exists with the configured length.)*
2. **WHEN** a ship's thrust command meets or exceeds the configured minimum throttle during a render frame, **THE SYSTEM SHALL** write the ship's thruster spawn data into the GPU instanced attribute ring buffer using deterministic jitter so the geometry `instanceCount` increases and spawn arrays record the emission timestamp. *(Acceptance: the same Vitest spec advances a frame with a thrusting fighter and verifies the ring buffer slot stores the expected spawn time while `instanceCount` increments.)*
3. **WHEN** the render loop advances, **THE SYSTEM SHALL** update the shader time uniform on each frame so GPU-driven fading derives from the current clock value without CPU-side particle iteration. *(Acceptance: the Vitest spec drives successive frames and confirms the material `uTime` uniform tracks the clock time monotonically.)*

## 2025-10-05 — Ship LOD Visibility Regression

1. **WHEN** a ship crosses the configured near/far threshold because either its transform or the active camera position changed, **THE SYSTEM SHALL** recompute the LOD partition within the next render frame so full hull meshes mount for near ships. *(Acceptance: `test/components/lod/ShipLODManager.spec.ts` verifies the new partition refresh helper promotes ships to the near cohort after a simulated camera move.)*
2. **WHEN** the default battle camera loads at startup, **THE SYSTEM SHALL** classify the closest fleet elements as near ships so GLTF hulls render immediately without user interaction. *(Acceptance: unit coverage asserts ships spawned at ±300 units fall into the near set under the default distance threshold constants.)*
3. **WHEN** distant ships render via instanced impostors, **THE SYSTEM SHALL** keep the impostor mesh visible and billboarded toward the camera while updating per-instance transforms and colors each frame. *(Acceptance: `test/components/lod/ShipLODManager.spec.ts` exercises the impostor helper with a stubbed mesh and asserts visible, count, and quaternion values after an update call.)*

## Requirements — Star Disk Shader Integration

## 2025-10-02 — Rapier WASM Panic Diagnostics (TASK236)

1. **WHEN** `physicsWorld.step` throws a runtime error during a simulation tick, **THE SYSTEM SHALL** record step panic metadata (message, stack, tick index, simulation time, and delta) inside `simulation.rapierDiagnostics` so debugging tools can recover the failure context. *(Acceptance: Vitest spec forces a step throw and asserts the diagnostics capture message, stack, tick index, time, and delta.)*
2. **WHEN** a Rapier step panic is captured while Copilot debug mode is active, **THE SYSTEM SHALL** append a timestamped snapshot to `window.__copilot_rapierPanics` (trimming to the most recent 20 entries) to enable runtime inspection from Playwright. *(Acceptance: Vitest spec stubs `window` with the debug flag, triggers a panic, and confirms the snapshot buffer length and newest entry contents.)*
3. **WHEN** multiple Rapier step panics occur within the same simulation tick, **THE SYSTEM SHALL** increment a cumulative counter while updating `lastStepPanicTick` only once and emitting at most one snapshot for that tick to avoid log floods. *(Acceptance: Vitest spec invokes the recorder twice for the same tick and asserts the counter increments while only one snapshot is stored for that tick.)*

## 2025-10-03 — Star Disk Debug Animation Restoration (TASK234)

1. **WHEN** the StarDisk component renders with the `copilot_debug=1` query flag and no forced basic-material override is registered, **THE SYSTEM SHALL** attach the production `MainSequenceStarMaterial` so the animated shader remains visible during debug sessions. *(Acceptance: Vitest component spec mounts `StarDisk` with the query flag and asserts the mesh material remains a `ShaderMaterial` instance after a render frame.)*
2. **WHEN** the StarDisk render loop executes, **THE SYSTEM SHALL** advance the shader uniform time monotonically so the `iTime` uniform increases on each frame. *(Acceptance: Vitest spec spies on `updateMainSequenceStarUniforms`, advances multiple frames, and verifies successive calls receive strictly increasing `time` values.)*

## 2025-10-03 — Star Disk Simulation Fallback (TASK235)

1. **WHEN** the StarDisk component renders without the debug flag and the simulation clock fails to advance between frames, **THE SYSTEM SHALL** fall back to frame delta accumulation so the shader `iTime` uniform continues increasing, preventing a static star disk. *(Acceptance: Vitest spec stubs a stationary simulation clock and asserts uniform `time` values strictly increase across frames.)*
2. **WHEN** the simulation clock resumes advancing, **THE SYSTEM SHALL** realign the shader `iTime` uniform with simulation time within the same frame without introducing discontinuities. *(Acceptance: Vitest spec transitions from the fallback path to an advancing simulation and verifies the next uniform update matches the simulation time and remains ≥ the prior fallback value.)*

## 2025-10-02 — Star Disk Debug Lockdown (TASK233)

1. **WHEN** the StarDisk component renders without the `copilot_debug=1` query flag, **THE SYSTEM SHALL** avoid registering any debug helpers on `window` and remove any lingering debug overlays so production builds ship without the instrumentation surface. *(Acceptance: Vitest component spec renders `StarDisk` with a clean `window.location.search` and asserts no `window.__copilot_*` properties or `#copilot-star-screen-indicator` exist after mount.)*
2. **WHEN** the StarDisk component renders with the `copilot_debug=1` query flag, **THE SYSTEM SHALL** register the existing debug helper functions (layer toggles, material overrides) so automation can drive them while the flag remains present. *(Acceptance: Vitest spec sets `window.location.search='?copilot_debug=1'`, renders `StarDisk`, advances a frame, and confirms helper functions are attached.)*
3. **WHEN** StarDisk mounts without debug enabled, **THE SYSTEM SHALL** remove any pre-existing `window.__copilot_*` helper functions so prior debug sessions cannot force materials or render order in production. *(Acceptance: Vitest spec seeds helper functions before render, mounts without the flag, and verifies they are cleared.)*
4. **WHEN** StarDisk unmounts or debug mode is disabled, **THE SYSTEM SHALL** remove any debug overlays and helper functions it previously registered to avoid leaking UI artifacts. *(Acceptance: Vitest spec renders with debug enabled, unmounts, and asserts helpers/overlay are removed.)*

## 2025-09-30 — Rapier Startup Borrow Guard (TASK230)

1. **WHEN** the simulation tick processes deferred world mutations (carrier spawns, queued disposals, projectile instantiation), **THE SYSTEM SHALL** execute those mutations only after all per-frame kinematic writes have completed so Rapier never observes overlapping mutable borrows. *(Acceptance: Vitest regression drives a cold-start tick with queued fighter launches and asserts no Rapier panic is thrown while entities appear after the deferred flush.)*
2. **WHEN** turret systems update kinematic bodies, **THE SYSTEM SHALL** route translations and rotations through the safe setter that tolerates disposed or concurrently-mutated bodies, returning early on invalid input instead of throwing. *(Acceptance: unit test injects a disposed turret rigid body and verifies the safe wrapper prevents Rapier errors while leaving the remainder of the loop unaffected.)*
3. **WHEN** a new GameState initialises and advances its first frame, **THE SYSTEM SHALL** guarantee the deferred mutation queue runs exactly once per tick in deterministic insertion order so cold-start fleet spawns succeed without duplicate executions. *(Acceptance: regression inspects the queue order across repeated cold-start ticks and matches captured snapshots from stable seeds.)*
4. **WHEN** the physics step completes, **THE SYSTEM SHALL** clear deferred mutation queues before the next frame so stale operations cannot re-run on subsequent ticks. *(Acceptance: regression enqueues dummy operations, steps twice, and confirms the operation executes once and the queue is empty before the second tick.)*

**Validation 2025-09-30:** Covered by `test/vitest/simulation-queue.spec.ts`, `test/vitest/carrier-launch.spec.ts`, `test/vitest/safe-kinematics.spec.ts`, and the full Vitest suite (`npm test`). Manual verification confirmed no Rapier panics during cold-start carrier spawns.

## 2025-09-30 — Rapier Queue Extensions (TASK230 follow-up)

1. **WHEN** `fireProjectile` is invoked during a simulation tick, **THE SYSTEM SHALL** stage projectile creation via the deferred mutation queue so Rapier rigid body/collider allocation executes at the flush point, preventing nested mutable borrows during turret or AI loops. *(Acceptance: unit test exercises `fireProjectile`, asserts no projectile entity exists before flushing, then verifies creation after `flushDeferredMutations`.)*
2. **WHEN** `requestReset` schedules a simulation reset, **THE SYSTEM SHALL** enqueue the reset closure into a post-physics deferred queue that executes immediately after `physicsWorld.step`, ensuring resets never run mid-step and leaving the queue empty afterwards. *(Acceptance: refreshed `rapier-reset-stability.spec.ts` inspects queue length before and after `updateGame` and confirms single execution.)*
3. **WHEN** deferred mutation flushes or safe kinematic guards catch Rapier exceptions or invalid inputs, **THE SYSTEM SHALL** increment counters in `simulation.rapierDiagnostics` and capture the latest failure metadata so diagnostics highlight systems that may need additional guards. *(Acceptance: extended queue and kinematics unit tests force failures and assert diagnostic counters/metadata are updated.)*
4. **WHEN** pre-physics or post-physics deferred queues complete their flush, **THE SYSTEM SHALL** clear all queued operations so subsequent ticks begin from an empty queue and operations execute at most once. *(Acceptance: queue regression validates both queues report zero length after flush even when new ops are enqueued during execution.)*

## 2025-09-29 — Shield Bubble Visibility Regression (TASK227)

1. **WHEN** a ship entity reports `shield/maxShield ≥ 0.01`, **THE SYSTEM SHALL** render the shield bubble mesh after opaque hull geometry so the bubble remains visible regardless of hull draw order. *(Acceptance: Vitest regression reads `Ship.tsx` to confirm `ShieldBubble` uses a positive `SHIELD_RENDER_ORDER` constant greater than zero.)*
2. **WHEN** the shield bubble material initialises, **THE SYSTEM SHALL** disable depth testing (or render after the hull) while leaving depth write disabled so the bubble overlays hull pixels without affecting depth buffers. *(Acceptance: unit test exercises the shield material factory and asserts the resulting `ShaderMaterial` has `depthTest === false` and `depthWrite === false`.)*
3. **WHEN** a carrier or any hull spawns with full shields, **THE SYSTEM SHALL** surface a visible shield bubble within the first render frame, ensuring bloom registration remains active for the `shields` group. *(Acceptance: regression test instantiates a carrier entity and verifies bloom registration plus mesh visibility flag on the first frame.)*
4. **WHEN** a ship maintains `shield/maxShield ≥ 0.5`, **THE SYSTEM SHALL** keep the shield bubble alpha above a readable floor (≥0.35) so the sphere is unmistakable against the starfield. *(Acceptance: configuration test asserts `SHIELD_TUNING.minAlphaFloor ≥ 0.35` and per-hull `maxAlpha ≥ 0.8`.)*

## 2025-09-29 — Rapier Velocity Sampling Hardening (TASK228)

1. **WHEN** AI scoring or intercept helpers require a ship's movement vector, **THE SYSTEM SHALL** read from `ship.ship.velocity` maintained by the motion system instead of invoking `rigidBody.linvel()` so Rapier is never re-entered during decision ticks. *(Acceptance: unit test exercises `scoreInterceptIntent` with seeded velocities and asserts the helper never calls a mocked `linvel` spy.)*
2. **WHEN** a ship lacks a populated `ShipComponent.velocity` vector or the components are non-finite, **THE SYSTEM SHALL** return a zero vector without touching Rapier APIs to keep AI calculations stable in harnesses and during disposal frames. *(Acceptance: regression covers a ship with missing velocity and verifies `getShipVelocity` outputs zero without throwing or calling Rapier mocks.)*
3. **WHEN** tests simulate intercept calculations with moving targets, **THE SYSTEM SHALL** ensure the stored `ShipComponent.velocity` values propagate into intercept scoring so the resulting lead direction matches expectations within a small tolerance. *(Acceptance: Vitest spec seeds interceptor/target velocities and asserts the computed intercept heading reflects the stored velocities.)*

## 2025-09-29 — Carrier Spawn Queue (TASK226)

1. **WHEN** `updateCarrierLaunchSystem` iterates over carriers, **THE SYSTEM SHALL** queue fighter spawn operations and execute them only after the loop completes so Rapier never receives nested borrows that trigger the "recursive use" error. *(Acceptance: new Vitest regression exercises the launch cycle and asserts `spawnShip` is invoked after the carrier loop without throwing.)*
2. **WHEN** a carrier schedules fighter launches within a tick, **THE SYSTEM SHALL** cap the queued count so the total of existing and newly spawned fighters never exceeds `config.maxActive`. *(Acceptance: the regression test seeds a carrier at the cap and verifies no additional spawns are enqueued or executed.)*
3. **WHEN** a queued spawn executes, **THE SYSTEM SHALL** append the spawned fighter id to `carrier.activeFighterIds` and refresh the carrier tracking map before the next simulation tick. *(Acceptance: the regression test confirms the dequeued fighter id is recorded and survives a subsequent pruning pass.)*

## 2025-09-29 — Ship Level Bonus Caps (TASK153)

1. **WHEN** a ship crosses any level threshold above 1, **THE SYSTEM SHALL** recompute `maxHp` and `hp` using the base hull value scaled by the capped hull bonus so the resulting multiplier never exceeds +50%. *(Acceptance: `test/vitest/progression-system.spec.ts` levels a ship to level 11 and asserts `maxHp` equals `baseHp × 1.5` while current `hp` increases by the delta.)*
2. **WHEN** the level-up handler applies shield, damage, shield regen, or fire rate bonuses, **THE SYSTEM SHALL** clamp each stat to the configured `LEVEL_BONUSES` cap by recomputing from the base stat rather than compounding off prior increases. *(Acceptance: `test/vitest/progression-system.spec.ts` validates that level 11 stats match the capped multiplier and that a control ship without bonuses remains unchanged.)*
3. **WHEN** subsystem repair rates are recalculated after leveling, **THE SYSTEM SHALL** respect the progression cap so each subsystem’s `repairRate` stays within +50% of its baseline. *(Acceptance: the same Vitest suite inspects subsystem entries post level-up and ensures `repairRate` equals `base × 1.5`.)*
4. **WHEN** a ship gains levels beyond a stat’s `maxLevel`, **THE SYSTEM SHALL** keep the tracked level bonus total constant so repeated leveling produces no further change to the capped stat. *(Acceptance: the Vitest progression spec advances to level 20 and asserts fire rate and shield regen plateau once their caps are reached.)*

## 2025-09-29 — Ship Progression Test Hardening

1. **WHEN** unit tests instantiate ship entities without calling the production ship factory, **THE SYSTEM SHALL** apply a shared helper that hydrates progression defaults (XP, level, xpToNext, damageType, armor, and subsystem status records) so subsystem lookups never throw. *(Acceptance: `test/vitest/motion.system.spec.ts`, `test/vitest/ai-metrics.spec.ts`, and `test/vitest/projectile-resolve.spec.ts` all run without `subsystems.engine` access errors.)*
2. **WHEN** tests need to mutate subsystem health or statuses for specific scenarios, **THE SYSTEM SHALL** start from a fully populated subsystem record returned by the helper and allow per-test overrides without removing required keys. *(Acceptance: `test/vitest/turrets.spec.ts` and `test/vitest/shield-regen.spec.ts` adjust subsystem data while keeping `engine`, `weapons`, and `shields` entries defined.)*
3. **WHEN** future progression fields are introduced on `ShipComponent`, **THE SYSTEM SHALL** centralise test schema updates inside the helper so affected suites only require helper consumption instead of manual property updates. *(Acceptance: helper module exports typed surface reviewed by `test/vitest/projectile-bullettype.spec.ts` and `test/vitest/ai-regression.spec.ts` with no ad-hoc property additions.)*

## 2025-09-28 — AI Determinism & Coordination Overhaul (Task145)

1. **WHEN** the AI scores multiple intent candidates for a ship within the same tick, **THE SYSTEM SHALL** deterministically select the winner using quantised scores, intent priority ordering, threat rank, distance, and candidate index before falling back to seeded randomness only when all tiebreakers match. *(Acceptance: `test/vitest/ai-determinism.spec.ts` asserts identical command streams across seeded runs and verifies the tie-usage ratio stays ≤5%.)*
2. **WHEN** a ship experiences a critical event (≥10% HP loss in a single tick, target destruction, or a VIP gaining a new attacker), **THE SYSTEM SHALL** trigger an interrupt that forces the ship’s `nextThinkAt` to the current tick and records decision latency ≤1 tick. *(Acceptance: `test/vitest/ai-interrupts.spec.ts` simulates each trigger, checks `nextThinkAt` snapping, and confirms latency histogram updates.)*
3. **WHEN** the blackboard rebuilds target priorities each decision tick, **THE SYSTEM SHALL** calculate threat weights that incorporate hull class, remaining HP, VIP protection, and active focus-fire counts, exposing the selected target’s focus ratio via diagnostics. *(Acceptance: `test/vitest/ai-target-priority.spec.ts` seeds contrived fleets, validates ordering, and inspects logged focus ratios.)*
4. **WHEN** heading commands apply vertical perturbations, **THE SYSTEM SHALL** clamp the resulting Y component using role-based limits scaled by range band error so agile profiles reach up to 0.6 while heavy hulls stay ≤0.35. *(Acceptance: `test/vitest/ai-vertical.spec.ts` verifies clamp selection and band-error scaling across fighter, corvette, and destroyer profiles.)*
5. **WHEN** AI metrics aggregate after a scenario run, **THE SYSTEM SHALL** include tie counts, tie fallback counts, decision latency histograms, focus-fire ratios, and vertical amplitude distributions in both runtime metrics and exported scenario logs. *(Acceptance: `test/vitest/ai-metrics.spec.ts` and `test/vitest/ai-scenario-harness.spec.ts` read the enriched metrics payload and assert the new fields match expected values.)*

## 2025-09-28 — HUD Settings & Debug Panels

1. **WHEN** a user activates the HUD gear control, **THE SYSTEM SHALL** reveal a settings drawer anchored to the HUD panel and hide it when the gear is toggled again. *(Acceptance: `test/vitest/ui-settings-panels.spec.tsx` exercises the gear button, asserts the drawer toggles visibility, and checks ARIA attributes.)*
2. **WHEN** the settings drawer is visible, **THE SYSTEM SHALL** expose toggles for postprocessing, HUD health overlays, and AI V2 that mutate the existing `useUiStore` flags without reloading the scene. *(Acceptance: `test/vitest/ui-settings-panels.spec.tsx` clicks the drawer toggles and verifies store state updates plus component reactions via spies.)*
3. **WHEN** the UI store initialises for a fresh session, **THE SYSTEM SHALL** default `postprocessingEnabled` and `aiV2Enabled` to `true` while retaining deterministic hydration via config mirrors. *(Acceptance: `test/vitest/ui-store-defaults.spec.ts` asserts the initial store snapshot reflects the new defaults and honours `AI_CONFIG.v2Enabled` overrides.)*
4. **WHEN** the HUD wrench control is activated, **THE SYSTEM SHALL** present a modular debug drawer that lists all registered debug toggles (initially AI Debug and Explosion Debug) and updates their store flags via a shared registry. *(Acceptance: `test/vitest/ui-debug-panels.spec.tsx` registers sample toggles, opens the drawer, and ensures each control drives its associated store mutator.)*

## 2025-09-28 — Performance Monitor Overlay

1. **WHEN** the "Perf Monitor" toggle inside the HUD debug drawer is enabled, **THE SYSTEM SHALL** mount the `r3f-perf` panel within the active Canvas so frame, GPU, and scene metrics render without crashing the scene. *(Acceptance: `test/vitest/perf-monitor.spec.tsx` enables the toggle, renders the battlefield canvas, and asserts the perf panel mounts.)*
2. **WHEN** the "Perf Monitor" toggle is disabled, **THE SYSTEM SHALL** remove the perf panel overlay and detach its drag handlers so the HUD overlays return to their prior state. *(Acceptance: `test/vitest/perf-monitor.spec.tsx` flips the toggle off and asserts the DOM node representing the perf monitor disappears.)*
3. **WHEN** a user drags the perf monitor overlay, **THE SYSTEM SHALL** persist the panel position in the UI store and restore the same coordinates the next time the toggle is enabled within the session. *(Acceptance: `test/vitest/perf-monitor.spec.tsx` simulates pointer drag events, checks the stored coordinates, disables the toggle, and verifies the panel reappears at the saved position.)*

## 2025-09-28 — AI 3D Combat Stage 1

1. **WHEN** `spawnInitialFleets` executes with the default seeded RNG, **THE SYSTEM SHALL** derive ship Y offsets from `SPAWN_CONFIG.verticalSpreadFactor` with randomized team anchor heights so the median absolute altitude across all spawned ships exceeds 200 units. *(Acceptance: `test/vitest/spawn-geometry.spec.ts` adds `ensures seeded vertical dispersion exceeds threshold` which measures seeded runs.)*
2. **WHEN** `spawnInitialFleets` runs multiple times under the same seed, **THE SYSTEM SHALL** reproduce identical ship altitude sequences for each team to preserve determinism. *(Acceptance: `test/vitest/spawn-geometry.spec.ts` introduces `produces deterministic vertical offsets for seed 1337` comparing two seeded worlds.)*
3. **WHEN** `spawnInitialFleets` positions opposing teams, **THE SYSTEM SHALL** enforce a minimum centroid separation of `SPAWN_CONFIG.initialSeparationFactor × maxWeaponRange` to guarantee ≥ 1.5× max range spacing. *(Acceptance: existing `separates teams by configured factor` test updated to assert the stricter threshold.)*
4. **WHEN** the AI scheduler initializes, **THE SYSTEM SHALL** apply the experimental 15 Hz tick rate only when `AI_CONFIG.tickRateHzExperiment` is enabled, otherwise falling back to the 12 Hz baseline. *(Acceptance: new `test/vitest/ai-tick-rate.spec.ts` verifies the feature flag toggles the effective tick interval.)*
5. **WHEN** the 15 Hz experiment is active, **THE SYSTEM SHALL** execute at least 95% of the theoretical decision tick increase (15 Hz vs 12 Hz) over an equal-duration seeded scenario relative to the baseline. *(Acceptance: `test/vitest/ai-tick-rate.spec.ts` compares accumulated decision ticks for baseline and experimental runs and asserts the ratio ≥ 0.95 × expected.)*

## 2025-09-28 - AI KPI Instrumentation

1. **WHEN** the AI records its first projectile per ship during a simulation, **THE SYSTEM SHALL** persist the shot time and emit percentile summaries (p50 ≤ 20 s, p90 ≤ 30 s) through the metrics snapshot. *(Acceptance: `test/vitest/ai-metrics.spec.ts` seeds synthetic shot events, runs `aggregateKpis`, and asserts percentile outputs plus reset semantics.)*
2. **WHEN** intents are evaluated within the 30 s opening window, **THE SYSTEM SHALL** track Attack/Intercept decisions against total decisions so the opening aggression ratio remains ≥ 0.6. *(Acceptance: `test/vitest/ai-metrics.spec.ts` exercises `recordIntentMetrics` and verifies the computed ratio.)*
3. **WHEN** ships reconcile desired range bands, **THE SYSTEM SHALL** accumulate overall and per-hull in-band adherence (target ≥ 0.65) for KPI gating. *(Acceptance: `test/vitest/ai-metrics.spec.ts` feeds deterministic samples into `recordBandSample` and inspects aggregated ratios.)*
4. **WHEN** primary weapons fire with known elevation deltas, **THE SYSTEM SHALL** bucket shot distances and deltaY values per hull and report the proportion of shots with |deltaY| ≥ 100 units (target ≥ 0.25). *(Acceptance: `test/vitest/ai-metrics.spec.ts` records vertical shots and confirms histogram counters along with the vertical ratio output.)*

## 2025-09-28 — AI metrics resilience

1. **WHEN** `aggregateKpis` processes recorded first-shot timestamps, **THE SYSTEM SHALL** compute percentile outputs using the floor of `(n - 1) * p` so `p50` reflects the earliest timestamp at or above the target fraction and `p90` remains bounded by the next sampled time. *(Acceptance: `test/vitest/ai-metrics.spec.ts` expects `p50 = 18` and `p90 = 32` for the curated dataset.)*
2. **WHEN** AI command execution runs inside lightweight harnesses without a full Rapier runtime, **THE SYSTEM SHALL** surface shim implementations for `RigidBodyDesc`, `ColliderDesc`, and physics world hooks so `fireProjectile` executes without throwing while still emitting projectile entities. *(Acceptance: `test/vitest/ai-metrics.spec.ts` covers `executeAICommand` and `runLegacyShipBehavior` in the shimmed state.)*
3. **WHEN** `runAIScenario` completes a deterministic simulation, **THE SYSTEM SHALL** append a metrics snapshot to the exported log, including KPI summaries, first-shot times, histograms, and intent timeline data. *(Acceptance: scenario fixtures in `test/vitest/ai-scenario-harness.spec.ts` assert the serialized metrics payload.)*

## 2025-09-28 — Renderer Performance Audit Report

1. **WHEN** auditing each TypeScript module under `src/` for pooling, caching, instancing, and adaptive performance practices, **THE SYSTEM SHALL** assign a qualitative rating recorded in `docs/performance-report.md` (Excellent, Good, Fair, Poor) with supporting evidence. *(Acceptance: the report enumerates every `src` file with a rating and bullet justification.)*
2. **WHEN** notable strengths or regression risks are uncovered during the audit, **THE SYSTEM SHALL** summarize them in a dedicated Findings section that groups results by subsystem. *(Acceptance: the report includes grouped findings with references to source files.)*
3. **WHEN** the audit identifies improvement opportunities, **THE SYSTEM SHALL** capture recommended follow-up actions prioritized by estimated impact and effort. *(Acceptance: the report contains a Recommendations table mapping impact/effort and linked source files.)*
4. **WHEN** producing `docs/performance-report.md`, **THE SYSTEM SHALL** adhere to the repository markdown standards including YAML front matter fields and structured headings. *(Acceptance: report front matter includes the required metadata fields and passes markdown validator expectations.)*

## 2025-09-28 — Main Sequence Star Shader Integration

1. **WHEN** the celestial environment renders with the star disk feature enabled, **THE SYSTEM SHALL** instantiate the `mainsequencestar` fragment shader (adapted from Shadertoy) without requiring runtime parameter overrides. *(Acceptance: `test/vitest/star-disk-material.spec.ts` asserts the created `ShaderMaterial.fragmentShader` matches the imported GLSL and seeded uniforms align with expectations.)*
2. **WHEN** the star disk shader updates each frame, **THE SYSTEM SHALL** drive the `iTime` and `iResolution` uniforms from deterministic simulation time and the current renderer pixel dimensions. *(Acceptance: `test/vitest/star-disk-material.spec.ts` updates uniforms and verifies deterministic time advances and resolution clamping.)*
3. **WHEN** the shader samples its channels, **THE SYSTEM SHALL** bind the organic texture asset to `iChannel0` and the noise texture asset to `iChannel1`, falling back to deterministic generated textures if loading fails. *(Acceptance: `test/vitest/star-disk-material.spec.ts` validates both provided textures and generated fallback textures.)*
4. **WHEN** shader allocation fails, **THE SYSTEM SHALL** fall back to a basic emissive mesh material and emit a warning without crashing the scene graph. *(Acceptance: `test/vitest/star-disk.component.spec.tsx` mocks the factory failure and asserts the component renders `<meshBasicMaterial>` while logging the warning.)*

## 2025-09-27 — Build/Test Resilience

1. **WHEN** the Vitest smoke import suite enumerates project modules, **THE SYSTEM SHALL** load each module through bundled dynamic imports so TypeScript sources resolve without runtime extension errors. *(Validation: `test/vitest/smoke/import_all.spec.ts` passes with all modules imported.)*
2. **WHEN** `ProjectileObject` renders for any projectile entity, **THE SYSTEM SHALL** derive the sphere geometry radius from that entity’s projectile configuration or the default fallback. *(Validation: projectile geometry specs capture the configured radius for laser and heavy projectiles.)*
3. **WHEN** webpack’s TypeScript loader evaluates Vitest specs during `npm run build`, **THE SYSTEM SHALL** narrow error objects before reading their properties so compilation completes without type errors. *(Validation: `npm run build` finishes without TypeScript diagnostics.)*
4. **WHEN** projectile geometry tests exercise React hooks, **THE SYSTEM SHALL** provide stable mocked hooks that avoid invalid dispatcher access. *(Validation: projectile geometry specs run without `Invalid hook call` failures.)*

## 2025-09-27 — Star Disk View Compensation

1. **WHEN** the star disk component mounts with the feature enabled, **THE SYSTEM SHALL** orient the disk geometry using the configured star light direction instead of the active camera so the facing stays deterministic. *(Validation: `test/vitest/star-disk-orientation.spec.ts` verifies the helper quaternion maps local +Z to the configured direction and falls back to identity for invalid input.)*
2. **WHEN** the render loop advances with an active camera, **THE SYSTEM SHALL** compute a deterministic view-alignment vector per frame and push it into the star disk shader uniforms. *(Validation: `test/vitest/star-disk-material.spec.ts` exercises the new uniform update and confirms the values remain stable for mocked camera transforms.)*
3. **WHEN** the camera observes the star disk from glancing angles, **THE SYSTEM SHALL** adjust the shader’s radial falloff using the supplied view-alignment uniform so perceived corona brightness varies by no more than 10% relative to a head-on view. *(Validation: manual camera-orbit capture recorded in the star disk Playwright regression scenario; automated tolerance tracking pending follow-up task.)*

## 2025-09-27 — Ship Kill Explosion Effects

1. **WHEN** `resolveProjectiles` reduces a ship’s hull to zero or below, **THE SYSTEM SHALL** append a deterministic explosion event containing the world-space position, radius, faction variant, and seeded timeline within the same simulation tick. *(Acceptance: Vitest suite `test/vitest/explosions-event.spec.ts` instantiates a mock state, applies lethal damage, and asserts the emitted event payload matches expectations.)*
2. **WHEN** the renderer evaluates active explosion events each frame, **THE SYSTEM SHALL** drive the flash, shockwave, fireball, debris, and smoke stages according to the event’s seeded timeline and configuration values. *(Acceptance: renderer unit `test/vitest/explosions-renderer.spec.tsx` feeds a seeded event into the explosion renderer and asserts staged outputs and bloom registration.)*
3. **WHEN** an explosion occurs within the dynamic lighting falloff radius of nearby ships, **THE SYSTEM SHALL** emit a transient point light pulse scaled by distance while leaving camera transforms unchanged (i.e., no screen shake). *(Acceptance: component test `test/vitest/explosions-lighting.spec.tsx` verifies emitted light intensity, falloff clamps, and asserts camera state remains untouched.)*
4. **WHEN** an explosion event reaches the end of its configured duration, **THE SYSTEM SHALL** unregister all bloom selections, dispose transient lights, and recycle the event for reuse within the same frame. *(Acceptance: unit test `test/vitest/explosions-lifecycle.spec.ts` advances simulated time beyond the event lifetime and confirms cleanup hooks run exactly once.)*

## 2025-09-28 — AI Scenario Determinism Refresh

1. **WHEN** `runAIScenario` executes the escort intercept scenario with seed `777`, **THE SYSTEM SHALL** emit a normalized log whose commands, headings, thrust, and positions match `test/vitest/fixtures/ai-escort-scenario.json` within the three-decimal rounding tolerance. *(Acceptance: `test/vitest/ai-scenario-harness.spec.ts` verifies the normalized log equals the refreshed fixture.)*
2. **WHEN** the bomber intercept scenario runs with seed `2029`, **THE SYSTEM SHALL** capture deterministic `metrics.firstShotTimes` samples and propagate the values into the `metrics.kpis.firstShot` percentiles reflected in `test/vitest/fixtures/ai-bomber-intercept-scenario.json`. *(Acceptance: `test/vitest/ai-scenario-harness.spec.ts` asserts the normalized log including metrics matches the fixture.)*
3. **WHEN** the artillery retreat scenario progresses through its six ticks under seed `4041`, **THE SYSTEM SHALL** accumulate `metrics.shotDeltaY` and `metrics.shotDistance` histograms with non-zero counts consistent with the refreshed `test/vitest/fixtures/ai-artillery-retreat-scenario.json`. *(Acceptance: `test/vitest/ai-scenario-harness.spec.ts` compares the normalized log against the fixture.)*

## EARS Statements

1. **WHEN** the celestial environment renders with `features.starDisk !== false`, **THE SYSTEM SHALL** draw the star disk using the main sequence shader material anchored to `StarLight` configuration. *(Validation: visual snapshot shows shader-driven corona.)*
2. **WHEN** simulation time advances, **THE SYSTEM SHALL** drive shader animation uniforms from deterministic simulation time. *(Validation: unit assertion on uniform builder.)*
3. **WHEN** bloom post-processing is enabled, **THE SYSTEM SHALL** register the star disk with a dedicated bloom group so only intended pixels bloom. *(Validation: component test checks bloom registration.)*
4. **WHEN** shader compilation or uniform initialisation fails, **THE SYSTEM SHALL** fall back to the basic material and log a warning. *(Validation: forced failure test asserts fallback path.)*
5. **WHEN** `StarLight` color or intensity change, **THE SYSTEM SHALL** reflect the new lighting on the disk within the same frame. *(Status: open follow-up—no automated coverage yet; track as future enhancement.)*

## Legacy Star Disk Configuration (superseded by TASK134)

These historical requirements described behaviors tied to the deprecated `StarDiskShaderConfig`, debug overrides (`window.__STAR_DISK_DEBUG__`), and camera framing captured via Playwright before/after snapshots. The migration to the `mainsequencestar` shader retired those code paths; retain this section for archival reference only.


## 2025-09-26 — Planet Shadowing

1. **WHEN** a planet mesh renders under the configured directional star light, **THE SYSTEM SHALL** shade the hemisphere facing away from the light darker than the lit side using physically based lighting. *(Acceptance: viewport inspection confirms a terminator band and unit test asserts rim material retains standard lighting chunks.)*
2. **WHEN** star light intensity or direction changes, **THE SYSTEM SHALL** propagate the new lighting to both standard and rimmed planet materials within the same render frame. *(Acceptance: unit test verifies materials receive updated uniforms and manual render shows lighting shift.)*
3. **WHEN** rim glow is enabled for a planet, **THE SYSTEM SHALL** preserve the rim accent while respecting light-derived shading. *(Acceptance: shader unit test confirms rim contribution adds on top of the lit color instead of replacing it.)*
4. **WHEN** planet meshes are part of the celestial environment, **THE SYSTEM SHALL** allow them to cast and receive shadows from the star light. *(Acceptance: renderer configuration shows `castShadow`/`receiveShadow` enabled and Playwright capture displays occlusion on nearby bodies.)*

## 2025-09-27 — HUD Health Overlay Enhancements

1. **WHEN** the HUD health-bar toggle in the top menu is set to `on`, **THE SYSTEM SHALL** render per-ship overlay widgets for all visible player and AI vessels within the next render frame. *(Acceptance: planned Playwright flow in `test/playwright/hud-healthbars.spec.ts` activates the toggle and asserts overlays appear for each tracked entity.)*
2. **WHEN** a ship overlay renders, **THE SYSTEM SHALL** display stacked shield and health bars using the configuration colors (default: blue shield, green health) with proportions reflecting the entity’s current normalized shield/health values. *(Acceptance: Vitest snapshot in `test/vitest/hud-overlay-layout.spec.ts` mounts the component and verifies bar lengths and color tokens for seeded states.)*
3. **WHEN** a tracked ship’s shield or health value changes by ≥1% of max, **THE SYSTEM SHALL** animate the corresponding bar width to the new value within 150ms while preserving deterministic easing from the seeded RNG utilities. *(Acceptance: unit test in `test/vitest/hud-overlay-animation.spec.ts` simulates value deltas and checks transition timing and easing seeded outputs.)*
4. **WHEN** status effects (e.g., jammed, shield-down, engine-disrupted) are active on a ship, **THE SYSTEM SHALL** surface iconography and tooltip text adjacent to the overlay with contrast ratios meeting WCAG 2.1 AA (≥4.5:1) against the in-scene background. *(Acceptance: visual assertion in `test/vitest/hud-status-icons.spec.ts` measures computed contrast and presence of localized tooltip strings.)*
5. **WHEN** the HUD health-bar toggle is set to `off` or when overlays would overlap critical UI (radar, score banners), **THE SYSTEM SHALL** hide or reposition the overlays while maintaining accessibility-compliant alternatives in the top-level status ledger. *(Acceptance: Playwright regression toggles off the feature and asserts overlays disappear and the ledger updates with textual health summaries.)*

## Implementation mapping (authoritative file references)

- Rapier step panic diagnostics: implemented in `src/game/simulationQueue.ts` and recorded on `state.simulation.rapierDiagnostics` (maps to requirements in TASK236/TASK230).
- StarDisk shader and debug lockdown/fallbacks: implemented in `src/components/environment/StarDisk.tsx`, `src/renderer/MainSequenceStarMaterial` and related uniforms; harness and visual baselines live under `test/playwright/`.
- Progression and captain systems: implemented in `src/game/progression.ts` with configuration in `src/config/progression.ts` (maps to progression requirements and tests).

## 2025-10-03 — Motion PD Tuning (TASK241)

1. **WHEN** a ship hull defines motion.turnKp and motion.turnKd, **THE SYSTEM SHALL** apply those gains when computing angular velocity so the proportional yaw error and derivative damping reflect the hull configuration. *(Acceptance: Vitest spec stubs motion stats with custom gains and asserts the resulting angular acceleration matches the configured values.)*
2. **WHEN** a ship's yaw error drops below 5° and its angular velocity magnitude falls below the configured settling threshold, **THE SYSTEM SHALL** suppress additional slerp smoothing so the rigid body rotation converges without oscillation. *(Acceptance: motion system spec exercises near-aligned headings and verifies only physics integration adjusts the rotation when velocities are within threshold.)*
3. **WHEN** motion stats define motion.angularSettlingRate, **THE SYSTEM SHALL** damp residual angular velocity to at most that rate within 0.5 seconds of alignment to prevent visible bobbing. *(Acceptance: Vitest spec simulates repeated updates and asserts angular speed falls below the configured settling rate after 0.5 seconds.)*
