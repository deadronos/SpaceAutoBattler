# Star Disk Fiery Alignment — Implementation Plan (Spec-Driven)

Date: 2025-09-26  
Branch target: selectivebloomdebug

## Context & Constraints

- Renderer stack: React Three Fiber + custom GLSL shader (`src/renderer/shaders/starDisk.fragment.glsl`) with deterministic time sourced from `GameState`.
- Canonical state: uniforms are derived via `buildStarDiskMaterialConfig`; all overrides must filter through this helper to keep runtime deterministic and testable.
- Bloom: selective bloom groups handled by `useBloomRegistration`; tweaks must preserve deterministic bloom grouping and avoid leaking into other layers.
- Assets: organic/noise textures live under `src/assets/textures/star/`; updates require SRGB encoding and deterministic sampling (`useTexture` + Drei cache).
- Performance: Shader changes should avoid branching explosions and keep texture lookups minimal (current 2 samples + procedural noise). Maintain allocation-free frame loop in `StarDisk.tsx`.
- QA: visual baselines captured via Playwright (`test/playwright/celestial-visual-baseline.spec.ts`). Any new metrics need deterministic sampling and tolerance docs.

## Requirements (EARS)

1. **WHEN** the star disk renders in the default scene, **THE SYSTEM SHALL** produce a luminance drop of at least 70% between radii 0.2 and 0.6 to emphasise the white-hot core and darker mid band. _(Acceptance: Playwright pixel probe comparing centre vs mid radius.)_
2. **WHEN** the shader animates, **THE SYSTEM SHALL** maintain mid-band filament variance with a standard deviation ≥ 0.08 across 32 samples at radius 0.45. _(Acceptance: Playwright variance assertion.)_
3. **WHEN** bloom is active, **THE SYSTEM SHALL** extend halo brightness beyond 1.15× geometry radius while keeping edge brightness ≤ 35% of core intensity. _(Acceptance: Playwright radial profile check.)_
4. **WHEN** shader initialization or texture loading fails, **THE SYSTEM SHALL** fall back to the current stable material without WebGL errors. _(Acceptance: Vitest forcing material factory failure + fallback assert.)_
5. **WHEN** debug overrides adjust shader parameters, **THE SYSTEM SHALL** clamp values within documented ranges to prevent NaN artefacts. _(Acceptance: Vitest covering new uniform clamp ranges.)_

## High-Level Design

- **Parameter retune layer**: Adjust defaults in `CELESTIAL_ENVIRONMENT.starDisk.shader` to emphasise orange hues, stronger halo, and richer filament detail while keeping clamps inside `buildStarDiskMaterialConfig`.
- **Shader enhancements**: Add rotational advection, low-frequency modulation, and refined halo colouring inside `starDisk.fragment.glsl`, exposing any new controls via `StarDiskShaderConfig`.
- **Texture strategy**: Refresh organic/noise textures (higher contrast, radial bias) and optionally introduce a second organic variant blended by radius.
- **Post-processing alignment**: Review selective bloom thresholds to ensure halo pickup without clipping the core; document any `BloomProvider` adjustments.
- **Validation tooling**: Extend Playwright spec with luminance/hue/variance metrics; enhance Vitest coverage for new uniforms and clamping.

## Data & Interface Updates

- Extend `StarDiskShaderConfig` with any new uniforms (e.g., `swirlRate`, `sectorDarkeningStrength`, `haloTint`).
- Update `StarDiskUniformValues` and corresponding setters in `updateStarDiskUniforms`.
- Maintain deterministic texture access by reusing `STAR_DISK_TEXTURE_PATHS` and fallback data textures.
- Document new parameters in `docs/renderer-shield-materials.md` (or new doc) and `memory/design-star-disk-shader.md`.

## Proposed Phases & Tasks

### Phase 1 — Parameter Exploration (1 day)

- Use `applyStarDiskDebugOverrides` to iterate on `coreHotspotMix`, `coreDetailStrength`, `coreDetailNoise`, `coronaFilamentStrength`, `haloFalloff`, `outerGlowStrength`, `textureMix`, and palette offsets.
- Capture before/after screenshots; log promising parameter sets in `Copilot-Processing.md`.
- Decide whether halo reach requires shader changes or bloom tuning.

### Phase 2 — Shader Enhancements (1–1.5 days)

- Introduce angular swirl term: add `uSwirlRate` uniform; rotate UVs by `time * swirlRate` for organic/noise samples.
- Add low-frequency noise modulation for sector darkening (e.g., third snoise octave with large scale) controlled by `uSectorDarkeningStrength`.
- Rebalance halo colour mixing to favour burnt orange at high radii; adjust gamma curve for mid-tones.
- Ensure clamps guard new uniforms; update GLSL to keep branchless where possible.

### Phase 3 — Asset Refresh (0.5 day)

- Regenerate `star-organic.png` with higher contrast radial streaks; add optional `star-organic-large.png` for blended filaments.
- Confirm SRGB encoding + mipmap settings; update loaders if introducing secondary texture.
- Validate fallback textures still produce reasonable visuals.

### Phase 4 — Post-Processing & Bloom (0.5 day)

- Inspect `BloomProvider` configuration for `star` group; adjust threshold/knee/intensity to balance core vs halo.
- Add optional bloom debug toggle to visualize contribution (if useful).

### Phase 5 — Testing & Automation (1 day)

- Vitest: extend `star-disk-material.spec.ts` for new uniforms, clamps, and failure fallback.
- Playwright: enhance `celestial-visual-baseline.spec.ts` to sample luminance, hue, variance, halo reach; regenerate baselines post-approval.
- Manual: produce QA screenshot set and document metrics in `docs/postprocessing-pipeline.md`.

### Phase 6 — Documentation & Wrap-up (0.5 day)

- Update `memory/design-star-disk-shader.md`, `memory/design-star-disk-fiery-match.md`, and `docs/background-starfield-tuning.md` (if impacted).
- Note outstanding follow-ups (e.g., runtime sliders) in memory bank / issue tracker.

## Testing Strategy

- **Unit (Vitest)**
  - Clamp coverage for new uniforms.
  - Fallback material path when shader factory throws.
  - Uniform update propagation for swirl/sector parameters.
- **Playwright**
  - Pixel sampling for luminance drop, filament variance, halo reach, hue range (25°–55°) at mid radius.
  - Optional diff vs reference PNG kept in `playwright-debug/`.
- **Manual**
  - Review bloom intensity with debug toggles.
  - Capture HDR screenshot for documentation.

## Metrics & Validation Gates

- Luminance ratio centre vs radius 0.6 ≥ 3.3×.
- Filament variance σ ≥ 0.08 at radius 0.45; release fails if below.
- Halo brightness at radius 1.15 ≤ 0.35 of core but ≥ 0.1 to remain visible.
- Shader compile and texture load warnings absent in console (Playwright + manual).

## Risks & Mitigations

- **Over-blooming core**: keep `alphaStrength` adjustable; monitor Playwright metrics to prevent clipping.
- **Performance regressions**: limit added noise octaves; reuse existing snoise helper; document per-frame cost.
- **Texture mismatch**: keep fallback textures in sync; include asset regression note.
- **Test flakiness**: ensure Playwright waits for stable frame before sampling; store deterministic seed/time.

## Rollback Plan

- Maintain current defaults in version control; gating via feature flag not required but keep ability to revert parameter changes quickly.
- If shader changes regress visuals, revert GLSL while leaving metrics/tests to guide future attempts.

## Deliverables

- Updated shader + config + textures aligned with reference.
- Enhanced automated metrics verifying visual goals.
- Documentation updates and GitHub issue tracking progress on `selectivebloomdebug`.
