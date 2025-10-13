# Tasks Index (Memory Bank)

This index tracks active tasks and their memory files. Use the `/memory/tasks` folder for task-specific planning. Note completed tasks can also be in `./COMPLETED` once manually moved.

## Known issues

## In Progress

- [TASK246](TASK246-thruster-trails-gpu.md) — Move thruster trails to GPU-managed instanced buffers for scalable rendering. (In Progress — design published, implementation pending) (2025-10-06)
- [TASK245](TASK245-ship-hull-visibility.md) — Restore ship hull visibility by refreshing LOD partitioning after instancing refactor. (In Progress — requirements/design in flight) (2025-10-05)

- [TASK240](TASK240-rings-bloomOnly.md) — Add `rings.bloomOnly` config flag and create follow-up wiring/tests tasks. (In Progress — wiring & tests remaining) (2025-10-03)

## Completed

- [TASK247](TASK247-version2-vision.md) — Authored Version 2.0 vision document outlining pillars, feature concepts, and validation plans. (2025-10-13)
- [TASK242](TASK242-lint-compliance.md) - Restore lint compliance across config, hooks, and effect updaters. (2025-10-03)

- [TASK241](TASK241-motion-pd-tuning.md) — Reduce AI bobbing with hull-specific motion tuning and documentation. (2025-10-03)
- [TASK235](TASK235-star-disk-simulation-fallback.md) — Restored star disk animation when the simulation clock stalls without debug helpers enabled. (2025-10-03)
- [TASK234](TASK234-star-disk-animation.md) — Restored star disk shader animation with debug flag active and added monotonic uniform tests. (2025-10-03)
- [TASK236](TASK236-rapier-wasm-panic-diagnostics.md) — Captured Rapier step panic diagnostics, wired debug snapshot buffer, and added regression coverage. (2025-10-02)
- [TASK233](TASK233-star-disk-debug-lockdown.md) — Locked down StarDisk debug helpers so forced-on-top instrumentation only activates with the explicit `?copilot_debug=1` flag and added Vitest coverage. (2025-10-02)
- [TASK243](COMPLETED/TASK243-thruster-glow-regression.md) — Restore thruster glow regression coverage and reinstate hook identifiers. (2025-10-04)

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
- [TASK006](TASK006-instanced-particles-explosions.md) — Instanced particles & explosions (High priority) (2025-10-05)
- [TASK007](TASK007-thruster-muzzle-instancing.md) — Thruster & muzzle instancing + bloom registration (High priority) (2025-10-05)
- [TASK008](TASK008-ship-lod-impostors.md) — Ship LOD impostors & instanced distant-ship rendering (Medium priority) (2025-10-05)
- [TASK009](TASK009-debris-fragments-instancing.md) — Debris & fragment instancing (Medium priority) (2025-10-05)
- [TASK010](TASK010-material-texture-atlas.md) — Material & texture atlas for instance-friendly materials (High priority) (2025-10-05)

## Abandoned

- _None tracked._

