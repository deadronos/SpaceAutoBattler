# Progress — SpaceAutoBattler

This file summarizes recent work and maintenance actions performed on the memory bank.

- 2025-12-29: Completed performance review for v2.0.6b — measured and rated performance patterns across all critical metrics, showing significant improvements over v2.0.5g baseline. Key results: AI system 13.8% faster (1.493ms, 40% headroom), test suite 21.9% faster (827 tests in 37.8s), projectiles 6.9% faster, build time 2.1% faster. Overall rating: ⭐⭐⭐⭐⭐ 4.6/5.0 EXCELLENT. Documented in `docs/performance-review-v2.0.6b.md` and updated `PERFORMANCE_REVIEW_SUMMARY.md`. Validation: `npm run perf:ai-budget`, `npm run bench:projectiles`, `npm run build`, `npm test` all passing.

- 2025-12-17: Worker simulation offload milestones (TASK157) — validated by `npm run typecheck`, `npm test`, `npm run build`, and Playwright worker E2E
  - Added worker-driven ships rendering MVP and a render-only mode flag that disables the main-thread simulation tick while keeping the scene visually driven by worker snapshots.
  - Fixed Webpack chunking/output paths so worker `importScripts` can load split chunks (notably Rapier) in production builds.
  - Hardened the Playwright worker E2E spec by fixing `waitForFunction` usage and exposing worker status/errors to avoid opaque timeouts.

- 2025-12-12: Misc UI, systems, and tests landed — validated by `npm run typecheck` + `npm test` (unit suites passing)
  - `src/components/Hud.tsx`: Added accessibility attributes on HUD progress bars (role=progressbar + aria attributes) and grouped HUD controls. `test/components/Hud.spec.tsx` added.
  - `src/components/ProgressionPanel.tsx`: Progression panel supports drag-to-reposition (persisted position via UI store), formats XP with decimal precision (one decimal), exposes aria-live, and has additional UI refinements. `test/components/ProgressionPanel.spec.tsx` added.
  - `src/components/Postprocessing.tsx`: Guard added for missing `camera.layers` to prevent composer errors; `test/components/postprocessing/bug-undefined-camera-layers.spec.tsx` added.
  - `src/game/systems/turrets.ts`: Target scoring adjusted to honor turret priority preferences; `test/vitest/turret-priority.spec.ts` added.
  - `package.json`: `pyright` added as a developer dependency to enable optional static analysis in the developer toolchain.

- 2025-10-29: Began TASK415 capped-buffer unification — added shared helpers in `src/utils/cappedBuffer.ts`, refactored Rapier panic snapshots, shield ripple diagnostics, AI intent timelines, and StarDisk debug exports to consume them, introduced immutable delegate for progression events, and authored Vitest coverage (`test/utils/cappedBuffer.spec.ts`). Validation: `npx tsc --noEmit` passes; Vitest run currently blocked by missing optional `@rollup/rollup-linux-x64-gnu` binary (npm bug #4828).
- 2025-10-02: Implemented StarDisk uniform telemetry monitoring (TASK237) — exposed `window.__copilot_starDiskTelemetry` with iTime progression tracking, frame-to-frame deltas, and Rapier panic correlation fields; added Vitest coverage (5 passing tests) and comprehensive documentation in `docs/star-disk-telemetry.md`. Validation: `npm run typecheck`, `npm test -- star-disk-telemetry`.
- 2025-10-02: Instrumented Rapier step panic diagnostics (TASK236) — extended `RapierDiagnostics` with panic metadata, wrapped `physicsWorld.step` to record + rethrow panics, published `window.__copilot_rapierPanics` snapshots behind debug flag override, refreshed test fixtures, and added Vitest coverage (`rapier-diagnostics`, `update-game-panic`). Validation: `npm run typecheck`, `npm test` (500 passing, existing Three.js warnings).
- 2025-10-03: Completed TASK235 Star Disk simulation fallback — added `lastUniformTimeRef` guard, delta-based fallback when simulation stalls, expanded Vitest coverage for stalled/resumed clocks, and reran `npx vitest test/vitest/star-disk-debug-lockdown.spec.tsx` plus `npm run typecheck`.
- 2025-10-03: Completed TASK234 Star Disk animation restoration — removed debug-only material swap, kept shader attached under `?copilot_debug=1`, added monotonic uniform assertions in `test/vitest/star-disk-debug-lockdown.spec.tsx`, and reran `npx vitest test/vitest/star-disk-debug-lockdown.spec.tsx` plus `npm run typecheck`.
- 2025-10-01: Extended deferred mutation queue to projectile spawning and pending reset logic, added post-step flush with diagnostics tracking, refreshed Vitest fixtures to cover new queue fields, expanded simulation queue tests for guard trip accounting, and updated requirements/design/active context documentation. Pending follow-ups: HUD exposure of diagnostics and regression snapshot harness. Validation pending (`npm run typecheck`, `npm test` queued next session).

- 2025-09-30: Completed TASK230 Rapier startup borrow guard — added `simulation.deferredMutations` queue, shared safe kinematic utility, carrier launch enqueue/flush integration, renderer thruster guard, refreshed regression coverage (`simulation-queue`, `carrier-launch`, `safe-kinematics`), and reran `npm run typecheck` + `npm test` (472 passing).
- 2025-01-27: Completed TASK154 Rapier reset stability — added deferred reset execution to eliminate runtime console errors during reset button usage. Extended SimulationClock with pendingReset field, implemented requestReset helper, modified updateGame to process resets after physics step, updated Controls.tsx, modernized EventQueue initialization, and added comprehensive Vitest coverage with 7 test cases. All 288 tests pass and TypeScript compilation successful.

- 2025-09-29: Completed TASK152 progression test hardening — hydrated AI scenario harness ships with progression defaults, updated projectile expectations for damage type modifiers, and confirmed `npm test` passes.
- 2025-09-29: Completed TASK226 carrier spawn scheduling — deferred carrier fighter spawns until after the ship iteration loop, eliminating Rapier unsafe aliasing errors, added regression coverage in `test/vitest/carrier-launch.spec.ts`, and revalidated via `npm run typecheck` + `npm test`.

- 2025-09-28: Completed TASK147 HUD settings/debug drawers — refactored control bar, added gear/wrench drawers with modular toggle config, defaulted postprocessing/AI V2 to enabled, updated styles, and landed Vitest coverage (`ui-store-defaults`, `ui-settings-panels`, `ui-debug-panels`) alongside `npm run typecheck` + `npm test`.

- 2025-09-28: Completed TASK139 haze taper implementation — added config knobs, material clamps, shader attenuation, new Vitest coverage, and validated via `npm run typecheck` + `npm test`. Visual capture remains as a follow-up once art direction finalises reference frames.
- 2025-09-27: Completed TASK140 boundary feather implementation — extended CelestialEnvironment boundary config, added `deriveBoundaryUniform` + GLSL attenuation, refreshed StarDisk component wiring, authored new Vitest/component specs, and re-ran `npm run typecheck` plus `npm test`.

- 2025-09-26: Memory bank audit — corrected future-dated entries, normalised timestamps, and noted duplicate task IDs (TASK102, TASK110). Created follow-up task TASK135 to reconcile task ID collisions and updated `memory/tasks/_index.md`.

- 2025-09-26: Declared GLSL precision and uniform bindings for the main sequence star shader to resolve runtime compilation errors; re-ran `npm run typecheck` and `npm test` to confirm stability.
- 2025-09-26: Restored main sequence star disk visibility by wiring a GLSL `main` entrypoint, added a unit assertion guarding the shader string, and reran `npm run typecheck` plus `npm test` (TASK134 follow-up).

Recent updates (automated agent)

- 2025-09-26: Stabilised smoke import loader map, rewrote projectile geometry specs to inspect JSX output, and confirmed `npm run typecheck`, `npm test`, `npm run build` pass after the React 19 upgrade (TASK133).
- 2025-09-26: Replaced custom rim material with a standard surface plus rim shell, refreshed documentation/tasks, and reran validation (`npm run typecheck`, `npm test`) to confirm planets stay visible with cast/receive shadows (TASK132).
- 2025-09-26: Refactored planet rim material to retain PBR lighting, enabled planet cast/receive shadows, tuned directional light shadow map, and added Vitest coverage for rim shader injection (TASK132).
- 2025-09-26: Reoriented `StarLight.direction` toward the default camera target so the star disk renders in-frame on load while preserving lighting distance; regenerated Playwright before/after captures.
- 2025-09-26: Implemented TASK131 Playwright capture workflow — added debug override helper, unit coverage, comparison spec, and generated before/after artifacts under `playwright-debug/` (typecheck, unit, and Playwright suites passing).
- 2025-09-26: Drafted requirements (memory/requirements.md), design (design.md §11), and TASK131 plan for Playwright-driven star disk before/after renders.
- 2025-09-26: Parameterised StarDisk palette offsets, introduced config schemas, updated material helper clamps, expanded Vitest coverage, and documented the change (TASK129).
- 2025-09-26: Surfaced additional StarDisk shader controls (strength multipliers, color blend, tiling, scroll speeds), updated GLSL/material wiring, expanded Vitest coverage, and documented defaults (TASK128).
- 2025-09-25: Implemented TASK130 radial spread tuning — added radial shaping uniforms, updated fragment shader with base fill + swirl, refreshed environment defaults, and validated via `npm run typecheck` and `npm test`.
- 2025-09-25: Completed TASK127 fiery fidelity pass — warmed palette, increased texture influence, rebalanced shader brightness, updated environment defaults, and revalidated via `npm run typecheck`, `npm test`, and `npm run build`.
- 2025-09-25: Corrected star disk aspect ratio, boosted corona intensity defaults, updated environment overrides, and expanded Vitest coverage for fiery fallbacks (TASK126).
- 2025-09-25: Baked deterministic star disk textures, integrated sampler-driven shader updates, and closed TASK125 with new Vitest coverage plus npm typecheck/test validation.
- 2025-09-25: Integrated star disk shader pipeline (GLSL assets, Vitest loader, deterministic uniforms) and closed TASK124 with validation notes.
- 2025-09-25: Authored celestial environment memory refresh (activeContext, progress, task index) and documented renderer focus, replacing legacy AI rollout notes.
- 2025-09-24: Delivered celestial environment renderer baseline — `CelestialEnvironment`, `StarLight`, `PlanetBody`, `PlanetRings`, rim material, and config toggles.
- 2025-09-24: Implemented `usePlanetTexture` hook with SRGB, anisotropy setup, and fallback colour; set shared geometry segments and deterministic rotation pipeline.
- 2025-09-24: Created task suite TASK110–TASK119 to track environment delivery (textures, config, materials, lighting, validation) and captured code references.
- 2025-09-21: Established core memory files (projectbrief, productContext, techContext, systemPatterns, core-\* references) and archived draft artifacts under `memory/ARCHIVE/`.

Historical log

- 2025-09-22 to 2025-09-25: AI V2 validation push — determinism suites, scenario harness, HUD overlays, perf budget guardrails (see archived entries for details).

Planned actions

- Keep per-file memory documents up-to-date when celestial config or renderer components change (especially `src/components/environment/*`).
- Capture perf/QA results (screenshot set, frame-time notes) once parallax billboards default decision is finalised.
- Ensure `core-systems.md` stays aligned when system ordering or AI budgets change alongside renderer updates.

## 2025-10-28 — Memory bank update

- 2025-10-28: Per request, validated and updated core memory files to follow `.github/instructions/memory-bank.instructions.md`. Confirmed presence of required core memory files (`projectbrief.md`, `productContext.md`, `activeContext.md`, `systemPatterns.md`, `techContext.md`, `progress.md`, `tasks/_index.md`) and refreshed audit timestamps in `memory/_index.md` and `memory/activeContext.md` to reflect this alignment. No code changes were made; documents updated only. (Validated by repository inspection.)
- 2025-10-18: Environment memory expansion (TASK249) — Read environment components under `src/components/environment/*` and summarised their roles, APIs, and key implementation notes (skysphere, star disk/sphere, star light, planet body, rim shell, rings, parallax billboards). Updated `memory/activeContext.md` with the summaries and created `memory/tasks/TASK249-update-environment-memory.md`.
- 2025-09-29: Completed TASK135 cross-reference reconciliation and ran markdown/link linting across `memory/` and `memory/tasks/`. Updated `memory/tasks/_index.md` to reflect final mappings and removed superseded references.

Memory audit: 2025-09-30 — updated several per-file memories to reflect source changes in `src/game/*`, `src/utils/*`, and renderer asset mappings.

## 2025-10-03 — Memory alignment

- Follow-up: consider running markdown linting across the memory folder and normalising list styles (bullets) where inconsistencies remain.

## 2025-10-16 — Memory bank source audit

- Next validation: run `npx tsc --noEmit` and `npm test` locally to confirm no breakages after docs-only edits (no code changes expected). If any CI or test failures appear, record results and follow-up with corrective edits.
