# Active Context — SpaceAutoBattler

Current focuses (short-term):

- Harden renderer validation through Vitest config checks and Playwright screenshot baselines to keep the environment deterministic and regression-ready.
- Track follow-up performance captures for large-scene budgets (planet geometry segments, anisotropy settings) before enabling parallax billboards by default.
- Validate the new projectile/reset queue coverage by sampling Rapier diagnostics after cold-start and reset flows; surface anomalies for follow-up if counters increment.

- Deferred mutation queue (TASK230) now funnels cold-start Rapier mutations through `simulation.deferredMutations`, shares safe kinematic guards across ships/turrets, updates fixtures, and revalidates via `npm run typecheck` + full `npm test` (472 passing). Includes renderer guard for non-finite thruster intensities consumed by thruster glow tests.
- Deferred carrier fighter spawning (TASK226) by queuing launch blueprints and flushing after iteration to resolve Rapier unsafe aliasing crashes; added Vitest regressions and reran `npm run typecheck` + `npm test`.
- Hardened ship progression test scaffolding (TASK152): shared helper now hydrates subsystem defaults, AI scenario harness ships receive progression stats, projectile resolution expectations adjusted for damage type multipliers, and full Vitest suite passes.
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

Next steps:

- Integrate the before/after captures into documentation and track future refreshes as shader presets evolve.
- Capture a render comparison showcasing the new shader control ranges (core-focused vs corona-focused) for docs.
- Capture a perf snapshot (GPU/CPU frame time) with postprocessing on/off and parallax billboards toggled for documentation.
- Gather curated screenshots showcasing rim glow and star disk variants for docs and QA sign-off (include new fiery fidelity output).
- Refresh Playwright/visual baselines to cover the texture-enhanced star disk once art direction is approved.
- Decide whether to enable parallax billboards by default after perf validation; otherwise document the toggle rationale in `docs/`.
- Review renderer warnings surfaced during webpack build (asset sizes, dynamic import) and track mitigations if they become problematic.
- Determine how to visualise `simulation.rapierDiagnostics` inside the developer HUD so guard trips and mutation failures are observable during playtests.

Status updates:

- 2025-09-27: Memory bank audit discovered duplicate task IDs and proposed TASK135 to reconcile collisions.
- 2025-09-29: TASK135 completed — cross-references reconciled, `memory/tasks/_index.md` updated, and markdown/link linting run across `memory/` and `memory/tasks/` to remove stale references. Superseded task files were archived under `memory/tasks/COMPLETED/`.

- Updated: 2025-10-02
