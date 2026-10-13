# Active Context — SpaceAutoBattler

Current focuses (short-term):

- **Performance Review v2.0.6b (Completed - 100%)**: Comprehensive performance review completed with rating analysis across all critical metrics. Results show excellent improvements: AI system 13.8% faster (40% headroom), test suite 21.9% faster, overall rating ⭐⭐⭐⭐⭐ 4.6/5.0. Documentation in `docs/performance-review-v2.0.6b.md`.
- Land shared capped-buffer helpers (`appendCappedMutable`/`appendCappedImmutable`) across diagnostics, shield ripples, metrics, and progression events (TASK415); unblock Vitest run by addressing missing optional `@rollup` native binary.
- Refine AI motion PD tuning (TASK095 / formerly referenced as TASK241) to eliminate bobbing and document hull-specific gains (spec/motion-tuning.md).
- **Star telemetry (removed)**: The former `window.__copilot_starDiskTelemetry` global and its `docs/star-disk-telemetry.md` documentation were removed with the StarDisk→StarSphere migration; Rapier diagnostics remain the runtime introspection surface.
- **TASK156 (In Progress)**: Validate Playwright ship hull rendering tests with local `build + serve` cycle, generate representative baselines (fighter/frigate/carrier), and add CI job for PR-level subset; initial PoC files and baseline script are present.
- **TASK157 (In Progress)**: Offload simulation to a Web Worker (Rapier + ECS + AI) with worker-driven ship snapshot streaming; maintain feature-flagged worker render debug modes and converge toward a proper RenderWorld mirror.
- Harden renderer validation through Vitest config checks and Playwright screenshot baselines to keep the environment deterministic and regression-ready
- Track follow-up performance captures for large-scene budgets (planet geometry segments, anisotropy settings) before enabling parallax billboards by default

Recent changes:

- **2025-12-29**: Completed performance review for v2.0.6b — measured all performance metrics (AI budget, projectile stress, build time, test suite, bundle size) and calculated percentage improvements vs v2.0.5g. Key findings: AI system 1.493ms (40% headroom, ↑13.8%), test suite 37.8s (↑21.9%), projectiles ↑6.9%, build ↑2.1%. Overall rating: ⭐⭐⭐⭐⭐ 4.6/5.0 EXCELLENT. Created comprehensive 450-line review document with detailed analysis and ratings. Updated summary document and memory bank progress.
- **2025-12-29**: Added `DynamicResScaler` component (`src/components/DynamicResScaler.tsx`) and unit tests (`test/vitest/dynamic-res-scaler.spec.ts`) to provide automatic DPR scaling for render performance. Next steps: tune defaults, add telemetry/HUD controls, add Playwright baseline cases for DPR transitions, and document final recommended defaults (tracked in TASK162).
- **TASK119 (In Progress — 80%)**: Updated `test/vitest/flak-proximity.spec.ts` to pass `originPosition` through `FireProjectileOptions` (not `FireProjectileOverride`) and re-indented call sites; `pnpm run typecheck` and `vp lint` pass. Vitest run is currently blocked in this sandbox by esbuild `spawn EPERM` during config load.
- **TASK157 (In Progress)**: Landed worker simulation snapshot pipeline + worker-driven ship render MVP (cones) and a render-only flag to stop main-thread ticking; fixed production Webpack chunk loading for worker split chunks and added Playwright coverage (`worker-sim.spec.ts`).
- **StarDisk telemetry (removed, was TASK092 / historically cited as TASK237)**: The `window.__copilot_starDiskTelemetry` debug global, its documentation (`docs/star-disk-telemetry.md`), and the associated StarDisk debug wiring were removed when the `StarDisk` component was replaced by `StarSphere`. The remaining `test/vitest/star-disk-telemetry.spec.ts` is a placeholder shape test; it no longer exercises a live global.
- Added HUD settings/debug drawers (TASK147), defaulting postprocessing + AI V2 to enabled and relocating overlay toggles from the top control bar.
- **2025-12-12**: Minor UI, systems, and tests landed:
  - `src/components/Hud.tsx`: Added accessible attributes for HUD progress bars — `role="progressbar"`, `aria-label`, `aria-valuenow`, and `aria-valuemax`; grouped HUD controls with `role="group"`/`aria-label`. Validated via `test/components/Hud.spec.tsx`.
  - `src/components/ProgressionPanel.tsx`: Panel supports drag-to-reposition using `useUiStore` to persist `position`, and formats XP with decimal precision (`toFixed(1)`). Also exposed `aria-live="polite"` to announce updates. Validated via `test/components/ProgressionPanel.spec.tsx`.
  - `src/components/Postprocessing.tsx`: Added guard for missing `camera.layers` and safe camera layer mask restore to prevent composer errors if `camera.layers` is not present. Validated via `test/components/postprocessing/bug-undefined-camera-layers.spec.tsx`.
  - `src/game/systems/turrets.ts`: Adjusted turret target selection score to respect priority by applying a `bonusScale` so hull preference composes with squared distance consistently. Validated via `test/vitest/turret-priority.spec.ts`.
- Migrated Vitest smoke importer to Vite glob loaders, rewrote projectile geometry specs to inspect JSX output, and revalidated `pnpm run typecheck`, `pnpm test`, and `pnpm run build` to stabilise the build/test pipeline post React 19 upgrade.
- Replaced the rimmed planet shader with a stock `MeshStandardMaterial` surface plus additive rim shell, restoring lit/dark hemispheres while keeping glow; planets continue to cast/receive star light shadows with tuned shadow maps.
- Captured requirements and design for an automated Playwright workflow that outputs before/after star disk screenshots using debug overrides.
- Implemented the debug override helper, Playwright comparison spec, and generated before/after artifacts under `playwright-debug/` with passing validation gates.
- Re-oriented `StarLight.direction` toward the default camera so the star disk is framed on load without changing lighting distance.
- Parameterised StarDisk palette offsets (hue/saturation/lightness) via config defaults and clamps, adding Vitest coverage for custom palettes.
- Surfaced additional StarDisk shader controls (core/rim/corona/glow strengths, texture tiling, scroll speeds) through config, shader uniforms, and Vitest coverage.
- Corrected StarDisk aspect ratio by feeding the reciprocal viewport aspect into shader uniforms and guarding extreme camera shapes.
- Raised star disk corona intensity and texture blend defaults, retuned fragment contributions for a hotter corona, and expanded Vitest coverage for fiery fallbacks.
- Generated deterministic star disk texture assets, updated shader/material uniforms to sample them, and expanded Vitest coverage to capture texture handling.
- Expanded star disk radial shaping with new uniforms (texture radial power, corona edge softness, base fill), updated GLSL to fill the disc organically, and extended Vitest coverage for defaults/clamping.
- Finalised fiery fidelity tuning: warmer palette, stronger texture weighting, balanced brightness, refreshed environment overrides, and extended Vitest assertions to cover hue/lightness thresholds; validated via `pnpm run typecheck`, `pnpm test`, and `pnpm run build`.
- Landed `CelestialEnvironment`, `StarLight`, `PlanetBody`, `PlanetRings`, and `ParallaxBillboard` components wired to the new config and optional rim shader.
- Added `usePlanetTexture` hook with SRGB/anisotropy handling, deterministic rotation based on simulation time, and feature toggles (star disk, billboards, rims).
- Integrated solar-corona star disk shader with deterministic uniforms, GLSL asset pipeline, and Vitest coverage for material lifecycle.
- Authored Vitest suites (`celestial-environment.spec.ts`, `planet-deterministic-rotation.spec.ts`, `planet-texture-fallback.spec.ts`) plus Playwright baselines (`celestial-visual-baseline.spec.ts`).
- Documented new TASK139 plan for haze taper controls (requirements/design) ahead of implementation.
- Implemented haze taper configuration + shader attenuation (TASK139) with deterministic clamps and new Vitest coverage (`star-disk-material`, `star-disk-haze-taper`), validated via `pnpm run typecheck`, `pnpm test`.
- Delivered TASK140: added boundary feather config defaults (`CelestialEnvironment`), new `iBoundaryFeather` uniforms with `deriveBoundaryUniform`, GLSL attenuation, and Vitest/component coverage (`star-disk-boundary`, expanded material/component specs); validation via `pnpm run typecheck`, `pnpm test`.

Recent alignment notes (2025-10-03)

- Updated memory entries to reflect current `src/` implementations: canonical `GameState` shape, `SeededRng` API, deferred mutation queues, Rapier diagnostics, and AI harness shapes.
- Reminder: `createGameState()` initialises `state.rng` with seed `1337` by default and systems must prefer `state.rng` over global randomness for determinism.
- Deferred mutation queues (`state.simulation.deferredMutations` and `state.simulation.postStepMutations`) are used across systems (carrier spawns, projectile instantiation, reset requests) to avoid Rapier mutable-borrow panics; continue to use these patterns in new features.

- Implementation notes (source-aligned): `createGameState()` constructs `state.turretsByShip = new Map()` to track turret entities per ship for fast cascade removal and initialises `state.simulation` with `step = 1/20`, `maxSubSteps = 5`, and populated `rapierDiagnostics` defaults. Systems should avoid assumptions about fallback turret scans and use `registerTurret`/`unregisterTurret` helpers.

Next steps:

- Integrate the before/after captures into documentation and track future refreshes as shader presets evolve.
- Capture a render comparison showcasing the new shader control ranges (core-focused vs corona-focused) for docs.
- Capture a perf snapshot (GPU/CPU frame time) with postprocessing on/off and parallax billboards toggled for documentation.
- Gather curated screenshots showcasing rim glow and star disk variants for docs and QA sign-off (include new fiery fidelity output).
- Refresh Playwright/visual baselines to cover the texture-enhanced star disk once art direction is approved.
- Decide whether to enable parallax billboards by default after perf validation; otherwise document the toggle rationale in `docs/`.
- Review renderer warnings surfaced during webpack build (asset sizes, dynamic import) and track mitigations if they become problematic.
- Determine how to visualise `simulation.rapierDiagnostics` inside the developer HUD so guard trips and mutation failures are observable during playtests.

Recent quick maintenance (2025-10-18):

- Inspected `src/components/PostprocessingLazy.tsx` to align memory entries with the current renderer wiring:
  - `PostprocessingLazy` uses `React.lazy` to dynamically import `./Postprocessing.js` and wraps it in `Suspense` with `fallback={null}`.
  - The component forwards a boolean prop `enabled={true}` to the lazy-loaded module.
  - Note: the lazy import references `Postprocessing.js` (JS extension) from a `.tsx` file — this is an intentional interop pattern used across the renderer to allow JS/TS mix and preserve runtime asset names.
  - No code changes were required; this inspection was recorded in the memory bank and a task file was created (TASK248) to document the update.

  Environment renderer component summaries (2025-10-18):
  - `CelestialEnvironment` (`src/components/environment/CelestialEnvironment.tsx`)
    - Top-level environment group that wires skysphere, `StarLight` (and star representation), planets, and parallax billboards based on `CELESTIAL_ENVIRONMENT` config.
    - Uses `Suspense` for skysphere and planet bodies to allow asset loading to suspend rendering.

  - `Skysphere` (`src/components/environment/Skysphere.tsx`)
    - Loads large equirectangular textures via `useTexture` and renders a large inverted sphere with `meshBasicMaterial` (BackSide). Configures SRGB color space and mipmap filters for quality.

  - `StarLight` (`src/components/environment/StarLight.tsx`)
    - Wraps ambient + directional lighting and positions a directional light according to `StarLightConfig.direction` and `distance`.
    - Configures shadow camera extents, biases, and `castShadow`, and mirrors an internal ref to an optional external ref for parent/component coordination.

  - `StarSphere` (`src/components/environment/StarSphere.tsx`)
    - Implements the main-sequence star visual as a sphere with a shader-driven halo and an opaque depth core to guarantee occlusion. It replaces the former `StarDisk` / `StarDiskMesh` billboard components (both removed).
    - Uses a custom shader pipeline (`useStarMaterial`, `useStarTextures`, `useStarSphereFrame`) for material creation, uniform updates, and time selection (simulation time preferred, accumulating delta as fallback for reduced-motion).
    - Writes depth through a slightly smaller depth-only sphere (`createStarSphereDepthMaterial`) while the visible mesh performs depth testing without depth writes, so nearby planets/rings occlude the star consistently.
    - Debug helpers referenced by automation live under `?copilot_debug=1` and are cleaned up via `useStarDebug` / `useDebugOverlayCleanup`; there is no live telemetry global (the old `window.__copilot_starDiskTelemetry` was removed).

  - `PlanetBody` (`src/components/environment/PlanetBody.tsx`)
    - Renders planet geometry using `usePlanetTexture` (texture loader + fallback color) and `meshStandardMaterial` for PBR shading. Supports tilt, deterministic rotation using `state.simulation` time, emissive boost, rim shell and optional rings.
    - Rings are a separate `PlanetRings` component passed through many config-driven parameters.

  - `PlanetRimShell` (`src/components/environment/PlanetRimShell.tsx`)
    - Small custom `ShaderMaterial` that computes fresnel-based rim glow using additive blending and double-sided rendering; intended to be attached as a primitive material to a slightly scaled sphere mesh.

  - `PlanetRings` (`src/components/environment/PlanetRings.tsx`)
    - Procedural ring geometry created with a hole-shaped `Shape` + `ExtrudeGeometry`. Uses a `ShaderMaterial` with many uniforms (banding, tint, shadowing, penumbra, brightness) and a `MeshBasicMaterial` fallback when postprocessing is disabled.
    - Supports a `bloomOnly` mode via `userData` flags so the bloom manager can route color contributions to bloom pass only.

  - `ParallaxBillboard` (`src/components/environment/ParallaxBillboard.tsx`)
    - Small, camera-facing plane that shifts position based on camera movement (`useFrame`) and a `parallaxFactor`. Uses `meshBasicMaterial` and `lookAt` to face the camera. Feature-gated via `enabled` prop and global `features` config.

  Notes / Engineering guidance:
  - Depth and occlusion: star visuals intentionally use a small opaque depth core or a depth-only pass (StarSphere) so planets/rings can occlude the star consistently. When adding new halo-like elements follow this pattern (depth core + additive halo) to preserve deterministic occlusion.
  - Postprocessing fallback: `PlanetRings` exposes both a shader and a `MeshBasicMaterial` fallback and toggles uniforms based on `postprocessingEnabled` from the UI store. When adding shader features consider adding a graceful fallback path so scene remains readable with postprocessing off.
  - Debugging hooks: several components publish debug helpers/refs onto `window` when `?copilot_debug=1` is present. These are useful for Playwright/automation tests but must remain guarded behind debug checks to avoid production side-effects.

Status updates:

- 2025-09-27: Memory bank audit discovered duplicate task IDs and proposed TASK135 to reconcile collisions.
- 2025-09-29: TASK135 completed — cross-references reconciled, `memory/tasks/_index.md` updated, and markdown/link linting run across `memory/` and `memory/tasks/` to remove stale references. Superseded task files were archived under `memory/tasks/COMPLETED/`.

- Updated: 2025-10-16
- Updated: 2025-10-28
- Updated: 2025-12-12
