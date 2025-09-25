# Active Context — SpaceAutoBattler

Current focuses (short-term):

- Lock in the celestial environment baseline: star disk billboard, rim-glow shader, parallax billboards, and lighting balance driven by `CELESTIAL_ENVIRONMENT`.
- Harden renderer validation through Vitest config checks and Playwright screenshot baselines to keep the environment deterministic and regression-ready.
- Track follow-up performance captures for large-scene budgets (planet geometry segments, anisotropy settings) before enabling parallax billboards by default.

Recent changes:

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

Next steps:

- Capture palette comparison renders illustrating how offset tweaks change core/rim/corona balance for documentation.
- Integrate the before/after captures into documentation and track future refreshes as shader presets evolve.
- Capture a render comparison showcasing the new shader control ranges (core-focused vs corona-focused) for docs.
- Capture a perf snapshot (GPU/CPU frame time) with postprocessing on/off and parallax billboards toggled for documentation.
- Gather curated screenshots showcasing rim glow and star disk variants for docs and QA sign-off (include new fiery fidelity output).
- Refresh Playwright/visual baselines to cover the texture-enhanced star disk once art direction is approved.
- Decide whether to enable parallax billboards by default after perf validation; otherwise document the toggle rationale in `docs/`.
- Review renderer warnings surfaced during webpack build (asset sizes, dynamic import) and track mitigations if they become problematic.

- Updated: 2025-09-27
