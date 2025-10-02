# Tasks Index (Memory Bank)

This index tracks active tasks and their memory files. Use the `tasks/` folder for task-specific planning.

## Known issues

## In Progress

- [TASK154](TASK154-playwright-ship-screenshots.md) — Implement Playwright ship mock render tests for deterministic visual validation of hull rendering with scene introspection and screenshot comparison.
- [TASK239](TASK239-ring-halo-artifact.md) — Eliminate wedge-shaped ring/halo artifacts (Postprocessing OFF). (2025-10-02)

## Completed

- [TASK235](TASK235-star-disk-simulation-fallback.md) — Restored star disk animation when the simulation clock stalls without debug helpers enabled. (2025-10-03)
- [TASK234](TASK234-star-disk-animation.md) — Restored star disk shader animation with debug flag active and added monotonic uniform tests. (2025-10-03)
- [TASK236](TASK236-rapier-wasm-panic-diagnostics.md) — Captured Rapier step panic diagnostics, wired debug snapshot buffer, and added regression coverage. (2025-10-02)
- [TASK233](TASK233-star-disk-debug-lockdown.md) — Locked down StarDisk debug helpers so forced-on-top instrumentation only activates with the explicit `?copilot_debug=1` flag and added Vitest coverage. (2025-10-02)
- [TASK224](TASK224-implement-progression-panel.md) — Implement progression panel overlay with ship XP, levels, and event tracking (ISSUE224). (2025-09-30)
- [TASK229](TASK229-split-postprocessing.md) — Split Postprocessing composer/effect lifecycle into modular helpers with unit coverage. (2025-09-29)
- [TASK230](TASK230-rapier-startup-borrow-guard.md) — Deferred Rapier world mutations behind a deterministic queue, shared safe kinematic guards, and refreshed regressions. (2025-09-30)
- [TASK226](TASK226-carrier-spawn-scheduling.md) — Deferred carrier fighter spawn execution to eliminate Rapier unsafe aliasing crashes and added regression coverage (2025-09-29).
- [TASK227](TASK227-shield-bubble-visibility.md) — Restored shield visibility with overlay render order, depth-test disablement, and brighter alpha tuning plus regression coverage (2025-09-29).
- [TASK154](TASK154-rapier-reset-stability.md) — Implemented deferred reset execution to eliminate Rapier console errors during reset button usage (2025-01-27).
- [TASK225](TASK225-shield-bubble-visibility.md) — Fixed missing shield bubble rendering when shields regenerate after spawning depleted (2025-02-14).
- [TASK237](TASK237-star-disk-telemetry-monitoring.md) — Monitor StarDisk uniform telemetry (iTime progression) with Rapier panic correlation for debugging animation freezes (2025-10-02).
 
- [TASK237](TASK237-star-disk-telemetry-monitoring.md) — Monitor StarDisk uniform telemetry (iTime progression) with Rapier panic correlation for debugging animation freezes (2025-10-02).
- [TASK153](TASK153-level-bonus-caps.md) — Enforced level bonus caps so leveling respects progression limits and subsystem repair rates plateau at configured maxima (2025-09-29).
- [TASK152](TASK152-fix-progression-tests.md) — Hardened Vitest ship stubs with progression defaults; full suite passes (2025-09-29).
- [TASK145](TASK145-ai-determinism-overhaul.md) — Implement AI determinism-focused scoring, targeting, responsiveness, vertical, and diagnostics improvements per design memo.

- [TASK149](COMPLETED/TASK149-performance-audit-report.md) — Repository-wide renderer performance audit with batched ratings and recommendations recorded in `docs/performance-report-v0.1.1.md`.
- [TASK148](TASK148-perf-monitor-overlay.md) — Landed draggable `r3f-perf` overlay with HUD toggle, persisted position state, and passing Vitest coverage.
- [TASK147](TASK147-hud-settings-debug-panels.md) — HUD settings/debug drawers with shared toggle config, tests, and validation.
- [TASK146](TASK146-ai-3d-combat-stage1.md) — Enable 3D Combat Stage 1 spawn geometry and cadence (issue #194).
- [TASK150](TASK150-update-ai-scenario-fixtures.md) — Refresh AI scenario harness fixtures to align with new deterministic metrics outputs.
- [TASK143](TASK143-design-ai-improvement-v0.1.1.md) — Implement AI Improvement v0.1.1 vertical engagement, spawn, and range updates per design memo.
- [TASK144](TASK144-ai-metrics-resilience.md) — Restored percentile helper, Rapier shims, and AI scenario metrics fixtures; `npm test` passes.
- [TASK142](TASK142-ship-kill-explosionfx.md) — Implement ship kill explosion FX pipeline across simulation, config, renderer, and tests per design memo.

- [TASK141](TASK141-hud-health-overlays.md) — Implemented HUD health overlays with deterministic easing, occlusion safeguards, and Vitest coverage.
- [TASK140](TASK140-star-disk-boundary-feather.md) — Delivered star disk boundary feather uniforms, shader attenuation, and regression tests.
- [TASK139](TASK139-star-disk-haze-taper.md) — Implement star disk haze taper with camera-aware gradient fade and updated shader uniforms.
- [TASK138](TASK138-star-disk-view-compensation.md) — Fix star disk billboarding by locking orientation and adding view-compensation uniforms.
- [TASK134](TASK134-main-sequence-star-shader.md) — Ported `mainsequencestar` shader, refactored StarDisk material/component, and added unit coverage for uniforms and fallback path.
- [TASK132](TASK132-planet-shadowing.md) — Planet shadowing enhancement (standard material + rim shell with cast/receive shadows).
- [TASK131](TASK131-star-disk-render-capture.md) — Automated before/after star disk screenshot captures via Playwright.
- [TASK130](TASK130-star-disk-radial-spread.md) — Expand star disk radial energy to fill the disc with organic animation.
- [TASK129](TASK129-star-disk-palette-offsets.md) — Parameterise star disk palette offsets for configurable hue/saturation/lightness skew.
- [TASK128](TASK128-star-disk-shader-controls.md) — Expose additional star disk shader controls through config and shader uniforms.
- [TASK127](TASK127-star-disk-fidelity.md) — Refined star disk shader to match fiery reference without washing out texture detail.
- [TASK125](TASK125-star-disk-textures.md) — Bake procedural star disk textures and integrate them into shader pipeline.
- [TASK126](TASK126-star-disk-fiery-tuning.md) — Corrected star disk aspect ratio and retuned shader for a hotter corona.
- [TASK100](COMPLETED/TASK100-memory-bank-summary.md) — Memory-bank summary entry for initial knowledge-base bootstrap.
- [TASK101](COMPLETED/TASK101-implement-miniplex-zustand.md) — Implemented Miniplex + Zustand integration with lifecycle hooks and UI store replacement.
- [TASK136](COMPLETED/TASK136-implement-physical-movement.md) — Implemented Miniplex + deterministic physical movement system, renderer smoothing, and tests.  (Renamed from TASK102 to resolve ID collision.)
- [TASK102](COMPLETED/TASK102-ai-v2-skeleton.md) — Established AI V2 blackboard, scheduler, and profile plumbing behind feature flag. (Retained TASK102 identifier.)
- [TASK103](COMPLETED/TASK103-ai-traits.md) — Added AI trait multipliers with deterministic seeding and coverage.
- [TASK104](COMPLETED/TASK104-ai-metrics.md) — Instrumented AI metrics and documented rollout.
- [TASK105](COMPLETED/TASK105-ai-v2-validation.md) — Added determinism/scorer/executor/legacy suites, perf budget script, HUD overlay updates.
- [TASK106](COMPLETED/TASK106-ai-intercept-reposition.md) — Landed intercept/reposition/regroup scoring and executors with documentation updates.
- [TASK107](COMPLETED/TASK107-ai-scenario-harness.md) — Authored headless scenario harness with golden log regression tests.
- [TASK108](COMPLETED/TASK108-ai-rollout-automation.md) — Wired AI V2 rollout automation, env flag toggles, and CI alignment.
- [TASK109](COMPLETED/TASK109-ai-scenario-fixtures.md) — Added bomber intercept and artillery retreat scenarios with logs.
- [TASK110](COMPLETED/TASK110-planet-texture-assets.md) — Canonicalised planet texture asset keys and registry. (Retained TASK110 identifier.)
- [TASK137](COMPLETED/TASK137-implement-skysphere.md) — Implemented 8192x4096 skysphere with equirectangular mapping and Suspense boundary.  (Renamed from TASK110 to resolve ID collision.)
- [TASK111](COMPLETED/TASK111-celestial-environment-config.md) — Authored celestial environment config schema and defaults.
- [TASK112](COMPLETED/TASK112-planet-texture-loading.md) — Implemented `usePlanetTexture` hook with SRGB/anisotropy setup.
- [TASK113](COMPLETED/TASK113-planet-material-baseline.md) — Established baseline planet material with emissive boost controls.
- [TASK114](COMPLETED/TASK114-celestial-components.md) — Integrated CelestialEnvironment/StarLight/PlanetBody components.
- [TASK115](COMPLETED/TASK115-star-light-integration.md) — Finalised directional + ambient lighting aligned with config.
- [TASK116](COMPLETED/TASK116-deterministic-rotation.md) — Locked deterministic rotation safeguards tied to simulation time.
- [TASK117](COMPLETED/TASK117-planet-performance.md) — Bounded geometry segments and documented pending perf capture follow-up.
- [TASK118](COMPLETED/TASK118-planet-rendering-tests.md) — Added Vitest coverage for config shape and loader fallbacks.
- [TASK119](COMPLETED/TASK119-celestial-implementation.md) — Tracked full celestial integration, noting remaining documentation/QA items.
- [TASK120](COMPLETED/TASK120-visual-polish-track.md) — Delivered star disk, rim glow, lighting balance, and feature toggles.
- [TASK121](COMPLETED/TASK121-robustness-testing-track.md) — Added deterministic rotation tests, texture fallback validation, and Playwright baselines.
- [TASK122](COMPLETED/TASK122-feature-expansion-track.md) — Shipped gas giant rings, parallax billboards, and config toggles.
- [TASK123](COMPLETED/TASK123-selective-bloom-fix.md) — Fixed selective bloom contrast using group-based routing.
- [TASK133](TASK133-build-test-resilience.md) — Stabilise vitest smoke imports, projectile geometry tests, and webpack build after TypeScript migration.
- [TASK124](TASK124-star-disk-shader.md) — Ported solar corona shader for StarDisk with deterministic uniforms and tests.
- [TASK135](TASK135-reconcile-task-id-collisions.md) — Reconcile duplicate task IDs and normalise the `tasks/` folder naming and index references (created 2025-09-26).

## Pending

- _None tracked._
- [TASK232](TASK232-update-memory-bank-tasks.md) — Update memory bank task files and `_index.md` to record progress for the deferred Rapier migration work. (2025-10-01)

## Abandoned

- _None tracked._
