# Active Context — SpaceAutoBattler

Current focuses (short-term):

- Lock in the celestial environment baseline: star disk billboard, rim-glow shader, parallax billboards, and lighting balance driven by `CELESTIAL_ENVIRONMENT`.
- Harden renderer validation through Vitest config checks and Playwright screenshot baselines to keep the environment deterministic and regression-ready.
- Track follow-up performance captures for large-scene budgets (planet geometry segments, anisotropy settings) before enabling parallax billboards by default.

Recent changes:

- Corrected StarDisk aspect ratio by feeding the reciprocal viewport aspect into shader uniforms and guarding extreme camera shapes.
- Raised star disk corona intensity and texture blend defaults, retuned fragment contributions for a hotter corona, and expanded Vitest coverage for fiery fallbacks.
- Generated deterministic star disk texture assets, updated shader/material uniforms to sample them, and expanded Vitest coverage to capture texture handling.
- Finalised fiery fidelity tuning: warmer palette, stronger texture weighting, balanced brightness, refreshed environment overrides, and extended Vitest assertions to cover hue/lightness thresholds; validated via `npm run typecheck`, `npm test`, and `npm run build`.
- Landed `CelestialEnvironment`, `StarLight`, `PlanetBody`, `PlanetRings`, and `ParallaxBillboard` components wired to the new config and optional rim shader.
- Added `usePlanetTexture` hook with SRGB/anisotropy handling, deterministic rotation based on simulation time, and feature toggles (star disk, billboards, rims).
- Integrated solar-corona star disk shader with deterministic uniforms, GLSL asset pipeline, and Vitest coverage for material lifecycle.
- Authored Vitest suites (`celestial-environment.spec.ts`, `planet-deterministic-rotation.spec.ts`, `planet-texture-fallback.spec.ts`) plus Playwright baselines (`celestial-visual-baseline.spec.ts`).

Next steps:

- Capture a perf snapshot (GPU/CPU frame time) with postprocessing on/off and parallax billboards toggled for documentation.
- Gather curated screenshots showcasing rim glow and star disk variants for docs and QA sign-off (include new fiery fidelity output).
- Refresh Playwright/visual baselines to cover the texture-enhanced star disk once art direction is approved.
- Decide whether to enable parallax billboards by default after perf validation; otherwise document the toggle rationale in `docs/`.
- Review renderer warnings surfaced during webpack build (asset sizes, dynamic import) and track mitigations if they become problematic.

- Updated: 2025-09-25
