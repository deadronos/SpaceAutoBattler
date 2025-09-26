# Design — Star Disk Fiery Match

## 1. Summary

- Goal: tune the star disk to match the fiery reference (bright white-hot core, swirling orange corona, soft halo) while keeping deterministic behaviour and existing debug tooling.
- Scope: extend shader configuration with core shaping controls, retune default parameters, update GLSL blend curves, and enhance the Playwright capture to assert brightness/hue metrics.
- Confidence: 0.83 (High). The shader is already modular and exposes most knobs; adding core shaping uniforms plus config retuning is a bounded change backed by tests.

## 2. Requirements Traceability

- R1 → Playwright luminance ratio check (Requirement 1 in `requirements.md`).
- R2 → Playwright hue sampling check (Requirement 2).
- R3 → Playwright before/after capture asserts metrics after saving PNGs (Requirement 3).

## 3. Architecture Overview

```
CELESTIAL_ENVIRONMENT.starDisk.shader
        │ (merge + clamp)
        ▼
buildStarDiskMaterialConfig  ──►  StarDiskUniformValues (new: coreRadiusInner, coreRadiusOuter, haloFalloff)
        │                             │
        ▼                             ▼
createStarDiskMaterial           updateStarDiskUniforms
        │
        ▼
starDisk.fragment.glsl (core shaping, corona, halo re-balance)
        │
        ▼
Playwright capture reads canvas pixels and enforces luminance/hue targets
```

## 4. Data Flow & Interfaces

### Config Extensions

Add the following optional fields to `StarDiskShaderConfig`:

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `coreRadiusInner` | `number` | `0.18` | Radius threshold below which the core remains at full intensity. |
| `coreRadiusOuter` | `number` | `0.52` | Radius where the core falls to zero (passed to `smoothstep`). |
| `coreTightness` | `number` | `1.4` | Exponent applied to `coreBase` to achieve a white-hot hotspot. |
| `haloFalloff` | `number` | `1.35` | Controls outer halo drop-off, enabling softer gradients. |

Clamping ranges:
- `coreRadiusInner` ∈ [0, 0.6]
- `coreRadiusOuter` ∈ [coreRadiusInner + 0.05, 1]
- `coreTightness` ∈ [0.5, 4]
- `haloFalloff` ∈ [0.2, 4]

### Material Builder Updates

- Extend `StarDiskUniformValues` with the four new numeric properties.
- Clamp new fields in `buildStarDiskMaterialConfig` and propagate to uniforms.
- Update `DEFAULTS` to include warmer, brighter baseline values (`coreStrength`, `rimStrength`, `coronaStrength`, `outerGlowStrength`, palette offsets).

### GLSL Updates

- Replace hard-coded `smoothstep` arguments with uniforms: `coreBase = smoothstep(uCoreRadiusOuter, uCoreRadiusInner, 1.0 - dist)`. (Note: `smoothstep(edge0, edge1, x)`; ensure ordering correct.)
- Raise `core` contribution using `pow(coreBase, uCoreTightness)`.
- Scale halo term by `pow(max(1.0 - dist, 0.0), uHaloFalloff)`.
- Increase organic/noise blend weights and add subtle colour burn toward the rim to emulate swirling patterns.

### Playwright Enhancements

- After capturing PNGs, evaluate canvas pixels and compute:
  - Luminance ratio: `L=0.2126*r+0.7152*g+0.0722*b` for center (0,0) and 0.6 radius sample.
  - Hue: convert sample at radius 0.6 to HSV/HSL and assert angle range (25°–55°).
- Persist metrics in console for transparency.

## 5. Error Handling

| Scenario | Impact | Mitigation |
| --- | --- | --- |
| `coreRadiusOuter` ≤ `coreRadiusInner` | `smoothstep` degenerates, yielding flat core | Clamp outer radius to at least `inner + 0.05`. Log debug warning if overrides violate constraint. |
| Excessive `coreTightness` blows out highlights | Visual artefacts / clipping | Clamp to 4, keep default 1.4 and rely on brightness clamps already in place. |
| Halo falloff too low (very soft) | Screen-filling orange wash | Clamp `haloFalloff` to ≥0.2 and rely on alpha clamp to prevent >1 alpha. |
| Playwright sampling fails (canvas not ready) | Flaky tests | Wait for pause toggle and `requestAnimationFrame` stabilization before sampling (two frames). |

## 6. Testing Strategy

- **Vitest**: extend `star-disk-material.spec.ts` to assert clamping/defaults for new fields and ensure uniforms update via `updateStarDiskUniforms`.
- **Playwright**: update `star-disk-compare.spec.ts` to sample luminance/hue metrics and assert thresholds; continue verifying PNGs differ.
- **Manual**: optional review of generated `playwright-debug/star-disk-after.png` to confirm visual alignment.

## 7. Implementation Plan

1. Update `StarDiskShaderConfig`, `StarDiskUniformValues`, defaults, and accompanying clamps (`environment.ts`, `starDiskMaterial.ts`).
2. Modify GLSL shader to use new uniforms for core shaping and halo falloff; retune blend weights for brighter, detailed corona.
3. Retune default shader parameters in `CELESTIAL_ENVIRONMENT` to approximate reference (core/rim/corona strengths, palette, mix values).
4. Extend Vitest coverage for new uniforms and clamp ranges.
5. Enhance Playwright capture spec to sample canvas pixels, assert luminance ratio and hue, and log metrics.
6. Regenerate before/after screenshots and update documentation/memory entries.
7. Run `npm run typecheck`, `npm test`, and targeted Playwright spec.
8. Summarize outcomes, attach updated metrics, and note follow-ups.

## 8. Confidence & Risks

- Shader math adjustments are localized; risk of regression is moderate but mitigated by Vitest + Playwright coverage.
- Default retuning may require iterative tweaks; expect 1–2 passes to align with reference.
- Playwright pixel sampling must consider device pixel ratio; we will sample via `getImageData` to ensure deterministic values.

## 9. Open Questions

- Do we need additional selective bloom tuning after the visual change? (If the halo overblooms, adjust bloom pipeline in follow-up.)
- Should artists have access to runtime sliders for these new parameters? (Out of scope, but the debug hook could expose them.)
