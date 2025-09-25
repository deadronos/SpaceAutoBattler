# Design — Star Disk Shader Integration

## 1. Summary

- Goal: replace the static `StarDisk` billboard material with a Shadertoy-inspired solar corona shader that reacts to star config while remaining deterministic for tests.
- Scope: new GLSL shader assets, `StarDisk` component refactor, renderer config extensions, and bloom registration.
- Confidence: 0.87 (High). Prior shader work in repo plus clear porting path allow a full implementation without a PoC.
- Extension (2025-09-25): integrate procedural textures approximating Shadertoy’s `Organic2` and `RGBA Noise Small`, correct aspect handling, retune uniforms to achieve the target glow, and expose deterministic generation script plus texture blend/flicker controls.

## 2. Requirements (EARS)

1. **WHEN** the celestial environment renders with `features.starDisk !== false`, **THE SYSTEM SHALL** draw the star disk using the new shader material anchored to `StarLight` configuration. *(Acceptance: render snapshot shows shader-driven corona instead of flat color.)*
2. **WHEN** simulation time advances, **THE SYSTEM SHALL** drive shader animation uniforms from `GameState.simulation` to keep frames deterministic across runs. *(Acceptance: unit test comparing uniform time to simulated clock.)*
3. **WHEN** bloom post-processing is enabled, **THE SYSTEM SHALL** register the star disk with a dedicated bloom group so only intended pixels bloom. *(Acceptance: StarDisk mesh has bloom layer from `useBloomRegistration`.)*
4. **WHEN** shader asset compilation or uniform creation fails, **THE SYSTEM SHALL** fall back to the previous basic material and surface a console warning. *(Acceptance: error-handling path exercised in unit test by forcing shader init failure.)*
5. **WHEN** `StarLight.config` color/intensity change, **THE SYSTEM SHALL** update shader color/brightness uniforms within the same frame. *(Acceptance: React test verifies uniform updates after prop changes.)*

## 3. Confidence & Execution Strategy

- Deterministic time sourcing already exists in `PlanetBody`; reuse pattern to keep visuals stable.
- Shader port is self-contained and mirrors prior `starNest` adaptation, reducing unknowns.
- Plan: implement full feature with automated tests and documentation updates under a single branch iteration.

## 4. Architecture Overview

- `StarDisk` owns a memoised `ShaderMaterial` created from new GLSL vertex/fragment sources.
- Uniform pump consumes:
  - Star config (color, intensity, distance) and optional shader overrides from `CELESTIAL_ENVIRONMENT`.
  - Simulation clock from `useOptionalGameState()` with fallback to renderer time when absent.
- Texture loader (new): load deterministic data textures for noise modulation, exposing them through `StarDiskMaterial` helper; fallback to procedural snoise when unavailable.
- `useBloomRegistration` assigns a new `bloomGroup` (e.g., `star`).
- Fallback path swaps to previous `meshBasicMaterial` when shader creation throws.

```mermaid
flowchart TD
    config[CELESTIAL_ENVIRONMENT.starDisk + shader overrides] --> starDisk[StarDisk component]
    state[GameState.simulation time] --> uniforms[Uniform Scheduler]
    starDisk --> uniforms
    uniforms --> shader[Star Disk ShaderMaterial]
    shader --> bloom[BloomProvider (group 'star')]
    starDisk --> billboard[Camera-facing billboard]
```

## 5. Data Flow & Lifecycle

1. `StarDisk` memoises shader uniforms structure on mount, loading deterministic PNG textures (`organic`, `noiseRgba`) via `@react-three/drei`'s `useTexture` with repeat/nearest sampling to feed `uTextureOrganic` and `uTextureNoise` uniforms.

2. On each frame, deterministic time and derived brightness feed into uniforms (`uTime`, `uBrightness`, `uRadius`).

3. Color/intensity updates trigger React `useEffect` to patch uniforms without recreating material.

4. Bloom registration runs once per ref change and synchronises with `BloomProvider` selection layers.

5. `useEffect` cleanup disposes the shader, textures, and unregisters bloom handles.

## 6. Interfaces & Data Models

- Extend `CelestialEnvironmentConfig.starDisk`:

  ```ts
  interface StarDiskShaderConfig {
    coronaIntensity?: number;
    coronaFalloff?: number;
    noiseScale?: number;
    bloomGroup?: string; // default 'star'
    timeMultiplier?: number;
    colorShift?: number; // warm/cool tint slider
    textureMix?: number; // blend strength for organic sampler
    textureFlicker?: number; // flicker weight from noise sampler
  }
  ```

  ```ts
  starDisk?: {
    size?: number;
    opacity?: number;
    distanceMultiplier?: number;
    shader?: StarDiskShaderConfig;
  };
  ```

- New helper: `buildStarDiskUniforms(config: StarLightConfig, disk: StarDiskShaderConfig | undefined): StarDiskUniforms` returning a serialisable object for tests.
- Texture sourcing: `STAR_DISK_TEXTURE_PATHS` + React `useTexture` hook ensure deterministic PNG sampling with optional fallbacks (`organic`, `noiseRgba`).
- Shader uniforms (GLSL): `uTime`, `uBrightness`, `uRadius`, `uAspect`, `uOpacity`, `uCoronaScale1`, `uCoronaScale2`, `uCoronaIntensity`, `uCoronaFalloff`, `uNoiseScale`, `uTextureMix`, `uTextureFlicker`, `uColorCore`, `uColorPrimary`, `uColorSecondary`, `uTextureOrganic`, `uTextureNoise`.
- React hook signature: `useStarDiskMaterial(params: UseStarDiskMaterialParams): ShaderMaterial | null` (optional abstraction for testing and fallback).

## 7. Error Handling Matrix

| Scenario | Detection | Impact | Mitigation |
| --- | --- | --- | --- |
| WebGL shader compilation error | `ShaderMaterial` logs `material.onBeforeCompile` error | Star disk missing; black circle | Catch error, log warning, fall back to `meshBasicMaterial`. |
| Texture load failure | Loader throws or returns undefined | Loss of high-frequency detail | Log warning, use procedural snoise path and cached neutral textures. |
| Bloom registration context absent | `useBloomRegistration` returns null | Disk not on bloom layer | Guard hook usage and log debug message; still render without bloom. |
| GameState unavailable (e.g., loading) | `useOptionalGameState()` returns null | Animation stalls | Fallback to renderer clock for time. |
| Config override NaN/invalid | Runtime uniform update receives invalid numbers | Shader artifacts | Clamp/sanitize overrides before writing uniforms. |
| Shader disposed but frame updates continue | Access to null uniforms | React warnings | Clear refs in cleanup and gate frame callback on material existence. |

## 8. Testing Strategy

- **Unit (Vitest)**
  - `buildStarDiskUniforms.spec.ts`: verifies deterministic time mapping, color conversions, and config overrides.
  - `StarDisk.spec.tsx`: shallow render using React Testing Library + `@react-three/test-renderer` to assert fallback handling when shader hook returns null.
- Add tests ensuring texture loader returns deterministic data, fallback path when fs read fails, and aspect correction in uniform updates.
- **Integration / Visual**
  - Update `test/playwright/celestial-visual-baseline.spec.ts` screenshot or add new baseline for star disk glow.
  - Optional: add GPU-free assertion verifying bloom layer registration via debug toggle.
- **Manual**
  - Toggle bloom and star disk features in debug UI, ensure shader responds to `timeScale` changes.

## 9. Implementation Plan

1. Port GLSL shader into `src/renderer/shaders/starDisk.{vertex,fragment}.glsl`, replacing texture references with procedural noise.
2. Add TypeScript helpers (`buildStarDiskUniforms`, config types) and extend `CELESTIAL_ENVIRONMENT` defaults with shader overrides.
3. Refactor `StarDisk` to use new hook/material, integrate deterministic time and bloom registration, maintain billboard behaviour.
4. Implement fallback material path and cleanup logic, ensuring no GPU resource leaks.
5. Author Vitest suites for uniforms + component fallback; adjust Playwright baseline doc as needed.
6. Update documentation (`memory/core-celestialEnvironment.md`, new shader doc) and record tests run.

## 10. Open Questions & Follow-ups

- Evaluate if we need a cached noise texture or rely purely on procedural noise (decision to be made during implementation based on performance).
- Determine tolerable bloom intensity for QA snapshots; may require tuning `POSTPROCESSING_CONFIG`.
- Consider exposing shader parameters to runtime debug UI for artists after baseline lands.

## 11. 2025-09-25 — Aspect Ratio & Fiery Update

### Goals

- Restore a perfectly circular star disk regardless of viewport aspect.
- Strengthen the visual energy of the corona using the new organic/noise textures.
- Maintain deterministic behavior and existing fallbacks.

### Adjustments

- `StarDisk.tsx`
  - Feed the reciprocal viewport aspect to the shader (`uniforms.uAspect = 1 / max(aspect, ε)`), avoiding distortion on wide screens.
  - Clamp the aspect uniform to prevent division-by-zero when `viewport.aspect` is 0 in edge cases (e.g., suspended rendering).
  - Ensure frame hook skips updates after material disposal.
- `starDisk.fragment.glsl`
  - Update the UV transform to multiply by `uAspectInv` (the reciprocal) so scaling stays symmetric.
  - Refine corona layering: boost energy by redistributing the organic/ noise contribution and warming the tint.
- `buildStarDiskMaterialConfig`
  - Raise defaults: `coronaIntensity` ≈ 1.45, `textureMix` ≈ 0.82, `textureFlicker` ≈ 0.65, slight positive `colorShift`.
  - Document the fiery preset and add clamps ensuring values stay within prior safe envelopes.

### Error Handling

- Aspect reciprocal uses `Math.max(aspect, 0.0001)` to avoid spikes; guard ensures previous discard thresholds remain stable.
- Texture fallbacks already cover missing assets; update unit test to confirm increased intensity still clamps alpha to the 0–1 range.
- Add warning branch in `StarDisk.tsx` if computed aspect deviates wildly (>8) to assist debugging unusual camera setups.

### Testing Strategy

- **Unit:** Extend `star-disk-material.spec.ts` to assert boosted defaults and verify clamped fiery values with/out overrides.
- **Unit:** Add assertion that `updateStarDiskUniforms` persists boosted brightness for fallback textures.
- **Visual (future):** Refresh Playwright screenshot once art direction approved.
- **Manual:** Validate bloom intensity in renderer debug view to ensure no overexposure.

## 12. 2025-09-25 — Fiery Fidelity Refinement

### Goals

- Match the reference render by preserving fine filament detail and delivering a saturated orange corona.
- Prevent the core from washing out while keeping bloom-friendly highlights.
- Keep the shader deterministic and safe against runaway intensities.

### Adjustments

- `buildStarDiskMaterialConfig`
  - Bias palette warmer by increasing default `colorShift` and explicitly darkening secondary lightness.
  - Tighten brightness scaling: divide by a larger denominator and cap `coronaIntensity` default so rim energy stays controlled.
  - Lift `textureMix` to full strength and nudge `textureFlicker` higher to amplify texture-driven detail.
- `starDisk.fragment.glsl`
  - Rebalance `corona` weights and outer glow curve to retain orange hues while keeping the core bright.
  - Blend texture samples additively with stronger weighting near the rim; reduce uniform multipliers that previously bleached detail.
  - Apply a gamma-like adjustment when composing the final color to keep gradients smooth.
- `CELESTIAL_ENVIRONMENT`
  - Update shader overrides to align with the warmer palette and refined brightness caps.

### Error Handling

- Clamp `textureMix` to `[0, 1]` and `textureFlicker` to `[0, 2]` (existing), documenting that high values are intentional but bounded.
- Ensure any future overrides respect the tighter brightness denominator; add task follow-up if artists request per-scene exposure controls.

### Testing Strategy

- **Unit:** Expand `star-disk-material.spec.ts` with assertions for palette warmth (hex expectations) and refined brightness bounds.
- **Unit:** Cover fallback textures to ensure fiery parameters persist even without external PNGs.
- **Visual:** Refresh Playwright baseline capturing the warmer corona once QA approves.
- **Manual:** Capture before/after screenshots in debug UI to confirm the orange filament pattern matches the reference.
