# Memory — core-celestialEnvironment

Files: `src/config/environment.ts`, `src/components/environment/*`, `src/hooks/usePlanetTexture.ts`, `test/vitest/celestial-environment.spec.ts`, `test/vitest/planet-deterministic-rotation.spec.ts`, `test/vitest/planet-texture-fallback.spec.ts`, `test/playwright/celestial-visual-baseline.spec.ts`

## Responsibilities & Flow

- `CELESTIAL_ENVIRONMENT` defines renderer-only data for celestial bodies, star lighting, feature toggles, and parallax billboards. The config stays deterministic (no references to `GameState`).
- `CelestialEnvironment` component materializes the config: mounts `StarLight`, planets (suspense-wrapped), optional parallax billboards, and star disk.
- `StarDisk` consumes shader presets that now include radial shaping (`textureRadialPower`, `coronaEdgeSoftness`, `baseFillStrength`) to keep animation spread across the disc; defaults live in `CELESTIAL_ENVIRONMENT.starDisk.shader`.
- `StarLight.direction` points toward the default camera target so the disk sits in-frame on boot while preserving the configured distance for lighting fidelity.
- `StarLight` converts config direction/distance into a positioned directional light plus optional ambient fill; exposes children so `StarDisk` inherits transforms.
- `PlanetBody` loads textures, applies optional tilt + deterministic rotation (based on `GameState.simulation.lastTickStart + alpha * step`), and now marks meshes to cast/receive shadows from the star light.
- `PlanetRings` and `PlanetRimShell` provide optional visual polish elements controlled by config flags; rim glow renders as a thin additive shell so the primary `MeshStandardMaterial` keeps full lighting and shadow support.
- `ParallaxBillboard` renders distant quads that move relative to camera position scaled by `parallaxFactor`; currently disabled by default via feature toggle pending perf capture.
- `usePlanetTexture` centralises texture loading with Drei caching, SRGB encoding, min/mag filters, anisotropy capping (up to 16), and fallback colour/error reporting for missing keys.

## Determinism & Performance Notes

- Rotation derives exclusively from simulation clock; there is no reliance on wall clock or real-time events.
- Geometry density is bounded via `PLANET_GEOMETRY_SEGMENTS` (default 64×32). Update this constant if asset budgets change.
- Rings and rim materials avoid per-frame allocations by reusing `Quaternion`/`Vector3` instances and memoised materials.
- Parallax billboards are optional due to potential perf impact; enabling them should follow perf validation recorded in active context.

## Testing & Validation

- `celestial-environment.spec.ts` asserts config integrity (texture keys, rotation axis normalisation, star light direction, geometry segments).
- `planet-deterministic-rotation.spec.ts` mirrors `PlanetBody` rotation math to guarantee deterministic outcomes for identical simulation times.
- `planet-texture-fallback.spec.ts` verifies fallback colour consistency and error messaging when textures are missing.
- Playwright suite `celestial-visual-baseline.spec.ts` captures screenshot baselines (default, close-up, UI-integration, camera angles) and checks for console errors.

## Follow-ups & Watchouts

- Capture GPU/CPU frame time snapshots with parallax billboards toggled before enabling the feature by default; document results in `docs/` and update config.
- Consider KTX2 or GPU-compressed textures if texture memory or bandwidth becomes an issue; hook can be extended to request compressed variants.
- Rim shell uses a lightweight shader shell that shares geometry; ensure shell meshes are disposed alongside the base planet when environments unmount.
- Update this memory record whenever new celestial features (additional planets, nebulae, volumetric effects) are introduced or config schema changes.
