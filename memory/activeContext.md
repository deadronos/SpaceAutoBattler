# Active Context — SpaceAutoBattler

Current focuses (short-term):

- Refine AI motion PD tuning (TASK241) to eliminate bobbing and document hull-specific gains (spec/motion-tuning.md).
- Monitor StarDisk uniform telemetry (`window.__copilot_starDiskTelemetry`) alongside Rapier diagnostics to verify iTime progression after addressing WASM faults (TASK237 complete)
- Validate Playwright ship hull rendering tests (TASK154) with local build + serve cycle and generate initial baselines
- Harden renderer validation through Vitest config checks and Playwright screenshot baselines to keep the environment deterministic and regression-ready
- Track follow-up performance captures for large-scene budgets (planet geometry segments, anisotropy settings) before enabling parallax billboards by default

Recent changes:

- **TASK237 (Completed - 100%)**: Implemented StarDisk uniform telemetry monitoring to track iTime progression and correlate with Rapier panics:
  - Added `window.__copilot_starDiskTelemetry` debug global with 11 telemetry fields
  - Tracks iTime, deltaTime, isProgressing, frameCount, time sources (sim/render/fallback)
  - Correlates with Rapier diagnostics: panicCount, lastPanicTick, ticksSincePanic
  - Gated behind `isCopilotDebugEnabled()` for zero overhead when disabled
  - Created comprehensive documentation in `docs/star-disk-telemetry.md`
  - Added Vitest test suite with 5 passing tests (`star-disk-telemetry.spec.ts`)
  - Validation: `npm run typecheck`, `npm test -- star-disk-telemetry`
- Added HUD settings/debug drawers (TASK147), defaulting postprocessing + AI V2 to enabled and relocating overlay toggles from the top control bar.
- Migrated Vitest smoke importer to Vite glob loaders, rewrote projectile geometry specs to inspect JSX output, and revalidated `npm run typecheck`, `npm test`, and `npm run build` to stabilise the build/test pipeline post React 19 upgrade.
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
- Finalised fiery fidelity tuning: warmer palette, stronger texture weighting, balanced brightness, refreshed environment overrides, and extended Vitest assertions to cover hue/lightness thresholds; validated via `npm run typecheck`, `npm test`, and `npm run build`.
- Landed `CelestialEnvironment`, `StarLight`, `PlanetBody`, `PlanetRings`, and `ParallaxBillboard` components wired to the new config and optional rim shader.
- Added `usePlanetTexture` hook with SRGB/anisotropy handling, deterministic rotation based on simulation time, and feature toggles (star disk, billboards, rims).
- Integrated solar-corona star disk shader with deterministic uniforms, GLSL asset pipeline, and Vitest coverage for material lifecycle.
- Authored Vitest suites (`celestial-environment.spec.ts`, `planet-deterministic-rotation.spec.ts`, `planet-texture-fallback.spec.ts`) plus Playwright baselines (`celestial-visual-baseline.spec.ts`).
- Documented new TASK139 plan for haze taper controls (requirements/design) ahead of implementation.
- Implemented haze taper configuration + shader attenuation (TASK139) with deterministic clamps and new Vitest coverage (`star-disk-material`, `star-disk-haze-taper`), validated via `npm run typecheck`, `npm test`.
- Delivered TASK140: added boundary feather config defaults (`CelestialEnvironment`), new `iBoundaryFeather` uniforms with `deriveBoundaryUniform`, GLSL attenuation, and Vitest/component coverage (`star-disk-boundary`, expanded material/component specs); validation via `npm run typecheck`, `npm test`.

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

  - `StarDisk` / `StarDiskMesh` / `StarSphere` (`src/components/environment/StarDisk.tsx`, `StarDiskMesh.tsx`, `StarSphere.tsx`)
    - Implements the main-sequence star visual: a shader-driven halo/disk with an opaque depth core to guarantee occlusion.
    - Uses a custom shader pipeline (material creation, uniform updates, time-wrapping, texture hooks) and exposes many debug hooks under `?copilot_debug=1` (telemetry, force-material, layer/opacity controls).
    - `StarDisk` performs per-frame uniform/time selection (simulation time preferred, fallback to render clock) and publishes `window.__copilot_starDiskTelemetry` when debug is enabled.
    - `StarDiskMesh` provides core + halo geometry and handles applying shader or fallback materials with explicit renderOrder constants to ensure correct layering.
    - `StarSphere` is a sphere-based variant that writes depth with a separate depth-only pass (shader-backed depth pass) to create stable occlusion for the visible shader pass.

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
