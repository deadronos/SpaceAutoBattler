# Tasks Index (Memory Bank)

This folder contains canonical task documents named using the pattern `TASKNNN-topic.md` (zero-padded three-digit IDs starting at 001).


## In Progress

- [TASK106](TASK106-duplicate-buffer-caps.md) — Unify capped history helpers across diagnostics, metrics, and progression events (design: DESIGN055). (In Progress — implementation underway) (2025-10-29)
- [TASK010](TASK010-thruster-trails-gpu.md) — Move thruster trails to GPU-managed instanced buffers for scalable rendering. (In Progress — design published, implementation pending) (2025-10-06)
- [TASK009](TASK009-ship-hull-visibility.md) — Restore ship hull visibility by refreshing LOD partitioning after instancing refactor. (In Progress — requirements/design in flight) (2025-10-05)

- [TASK007](TASK007-rings-bloomOnly.md) — Add `rings.bloomOnly` config flag and create follow-up wiring/tests tasks. (In Progress — wiring & tests remaining) (2025-10-03)

## Pending

- [TASK107](TASK107-hotpath-main-simulation-loop.md) — Configurable profiling/guard gating and max-substep clamping for the main simulation hotpath (DESIGN056). (Pending — implementation pending) (2025-11-16)

## Completed

- [TASK101](TASK101-renderer-config-refactor.md) — Split `src/config/renderer.ts` into focused modules with façade and parity tests. (2025-10-27)
- [TASK102](TASK102-particle-trails-refactor.md) — Extracted trail resources + anchors modules and updated component/tests. (2025-10-27)
- [TASK019](TASK019-materials-presets-factory.md) — Centralized material preset objects and factory functions for improved code organization. (2025-10-27)
- [TASK018](TASK018-centralize-projectile-info.md) — Centralized projectile info helpers and refactored beam handling. (2025-10-27)
- [TASK017](TASK017-ai-harness-modernization.md) — Modernized AI test harness documentation and created deprecation/patterns guides. (2025-10-26)
- [TASK100](TASK100-renderer-large-file-plan.md) — Renderer large-file refactor planning. (2025-10-27)
- [TASK011](TASK011-version2-vision.md) — Authored Version 2.0 vision document outlining pillars, feature concepts, and validation plans. (2025-10-13)
- [TASK014](TASK014-tech-debt-report.md) — Documented legacy cleanup opportunities with ratings/effort and validated build/tests. (2025-10-26)
- [TASK015](TASK015-remove-legacy-ai-fallback.md) — Removed the legacy AI fallback, enforced AI V2 enablement, and updated tests. (2025-10-26)
- [TASK096](TASK096-lint-compliance.md) — Restore lint compliance across config, hooks, and effect updaters. (2025-10-03)

- [TASK095](TASK095-motion-pd-tuning.md) — Reduce AI bobbing with hull-specific motion tuning and documentation. (2025-10-03)
- [TASK090](TASK090-star-disk-simulation-fallback.md) — Restored star disk animation when the simulation clock stalls without debug helpers enabled. (2025-10-03)
- [TASK089](TASK089-star-disk-animation.md) — Restored star disk shader animation with debug flag active and added monotonic uniform tests. (2025-10-03)
- [TASK091](TASK091-rapier-wasm-panic-diagnostics.md) — Captured Rapier step panic diagnostics, wired debug snapshot buffer, and added regression coverage. (2025-10-02)
- [TASK088](TASK088-star-disk-debug-lockdown.md) — Locked down StarDisk debug helpers so forced-on-top instrumentation only activates with the explicit `?copilot_debug=1` flag and added Vitest coverage. (2025-10-02)
- [TASK097](TASK097-thruster-glow-regression.md) — Restore thruster glow regression coverage and reinstate hook identifiers. (2025-10-04)

- [TASK092](TASK092-star-disk-telemetry-monitoring.md) — Monitor StarDisk uniform telemetry (iTime progression) with Rapier panic correlation for debugging animation freezes (2025-10-02).

- [TASK081](TASK081-level-bonus-caps.md) — Enforced level bonus caps so leveling respects progression limits and subsystem repair rates plateau at configured maxima (2025-09-29).
- [TASK080](TASK080-fix-progression-tests.md) — Hardened Vitest ship stubs with progression defaults; full suite passes (2025-09-29).
- [TASK073](TASK073-ai-determinism-overhaul.md) — Implement AI determinism-focused scoring, targeting, responsiveness, vertical, and diagnostics improvements per design memo.

- [TASK077](TASK077-performance-audit-report.md) — Repository-wide renderer performance audit with batched ratings and recommendations recorded in `docs/performance-report-v0.1.1.md`.
- [TASK076](TASK076-perf-monitor-overlay.md) — Landed draggable `r3f-perf` overlay with HUD toggle, persisted position state, and passing Vitest coverage.
- [TASK075](TASK075-hud-settings-debug-panels.md) — HUD settings/debug drawers with shared toggle config, tests, and validation.
- [TASK074](TASK074-ai-3d-combat-stage1.md) — Enable 3D Combat Stage 1 spawn geometry and cadence (issue #194).
- [TASK078](TASK078-update-ai-scenario-fixtures.md) — Refresh AI scenario harness fixtures to align with new deterministic metrics outputs.
- [TASK071](TASK071-design-ai-improvement-v0.1.1.md) — Implement AI Improvement v0.1.1 vertical engagement, spawn, and range updates per design memo.
- [TASK072](TASK072-ai-metrics-resilience.md) — Restored percentile helper, Rapier shims, and AI scenario metrics fixtures; `npm test` passes.
- [TASK033](TASK033-ai-intercept-reposition.md) — Landed intercept/reposition/regroup scoring and executors with documentation updates.
- [TASK034](TASK034-ai-scenario-harness.md) — Authored headless scenario harness with golden log regression tests.
- [TASK035](TASK035-ai-rollout-automation.md) — Wired AI V2 rollout automation, env flag toggles, and CI alignment.
- [TASK036](TASK036-ai-scenario-fixtures.md) — Added bomber intercept and artillery retreat scenarios with logs.
- [TASK038](TASK038-planet-texture-assets.md) — Canonicalised planet texture asset keys and registry. (2025-10-27)
- [TASK037](TASK037-implement-skysphere.md) — Implemented 8192x4096 skysphere with equirectangular mapping and Suspense boundary. (Renamed from TASK110 to resolve ID collision.)
- [TASK039](TASK039-celestial-environment-config.md) — Authored celestial environment config schema and defaults.
- [TASK040](TASK040-planet-texture-loading.md) — Implemented `usePlanetTexture` hook with SRGB/anisotropy setup.
- [TASK041](TASK041-planet-material-baseline.md) — Established baseline planet material with emissive boost controls.
- [TASK042](TASK042-celestial-components.md) — Integrated CelestialEnvironment/StarLight/PlanetBody components.
- [TASK043](TASK043-star-light-integration.md) — Finalised directional + ambient lighting aligned with config.
- [TASK044](TASK044-deterministic-rotation.md) — Locked deterministic rotation safeguards tied to simulation time.
- [TASK045](TASK045-planet-performance.md) — Bounded geometry segments and documented pending perf capture follow-up.
- [TASK046](TASK046-planet-rendering-tests.md) — Added Vitest coverage for config shape and loader fallbacks.
- [TASK047](TASK047-celestial-implementation.md) — Tracked full celestial integration, noting remaining documentation/QA items.
- [TASK048](TASK048-visual-polish-track.md) — Delivered star disk, rim glow, lighting balance, and feature toggles.
- [TASK049](TASK049-robustness-testing-track.md) — Added deterministic rotation tests, texture fallback validation, and Playwright baselines.
- [TASK050](TASK050-feature-expansion-track.md) — Shipped gas giant rings, parallax billboards, and config toggles.
- [TASK051](TASK051-selective-bloom-fix.md) — Fixed selective bloom contrast using group-based routing.
- [TASK133](TASK133-build-test-resilience.md) — Stabilise vitest smoke imports, projectile geometry tests, and webpack build after TypeScript migration.
- [TASK052](TASK052-star-disk-shader.md) — Ported solar corona shader for StarDisk with deterministic uniforms and tests.
- [TASK063](TASK063-reconcile-task-id-collisions.md) — Reconcile duplicate task IDs and normalise the `tasks/` folder naming and index references (created 2025-09-26).

- [TASK232](TASK232-update-memory-bank-tasks.md) — Updated Memory Bank files to align with current `src/` implementations (types, `createGameState()`, `SeededRng`, and simulation defaults). (2025-10-16)

- [TASK012](TASK012-update-memory-bank.md) — Quick memory sync: inspect `src/components/PostprocessingLazy.tsx`, record findings, and update memory bank entries. (Completed) (2025-10-18)
- [TASK013](TASK013-update-environment-memory.md) — Expand memory notes for `src/components/environment/*` with component summaries and engineering guidance. (Completed) (2025-10-18)
- [TASK021](TASK021-refactor-damage-calculation.md) — Centralize damage math into `src/game/combat/damage.ts` and provide a thin adapter for applying results. (Completed) (2025-10-27)
- [TASK022](TASK022-extract-subsystems-module.md) — Extract subsystem lifecycle and repair logic into `src/game/subsystems.ts` and add deterministic tests. (Completed) (2025-10-27)
- [TASK023](TASK023-split-progression-modules.md) — Split `src/game/progression.ts` into `xp.ts`, `leveling.ts`, and `events.ts` with an index re-export. (Completed) (2025-10-27)

- [TASK001](TASK001-instanced-particles-explosions.md) — Instanced particles & explosions (Completed) (2025-10-05)
- [TASK002](TASK002-thruster-muzzle-instancing.md) — Thruster & muzzle instancing + bloom registration (Completed) (2025-10-05)
- [TASK003](TASK003-ship-lod-impostors.md) — Ship LOD impostors & instanced distant-ship rendering (Completed) (2025-10-05)
- [TASK004](TASK004-debris-fragments-instancing.md) — Debris & fragment instancing (Completed) (2025-10-05)
- [TASK005](TASK005-material-texture-atlas.md) — Material & texture atlas for instance-friendly materials (Completed) (2025-10-05)

## Abandoned

- _None tracked._
