# Requirements — Star Disk Shader Integration

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
