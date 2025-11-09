# TASK130 - Star Disk Radial Spread

**Status:** In Progress  
**Added:** 2025-09-25  
**Updated:** 2025-09-25

## Original Request

> make this more organically starlike across the disc

## Thought Process

- Screenshot and prior tuning show the shader concentrates energy in the stellar core, leaving the mid/outer disc comparatively flat.
- The fragment shader hard-codes several radial exponents (`pow(radial, 0.8)`, `max(1.1 - fade, 0.0)`), giving little flexibility to redirect energy outward.
- Introducing configurable radial shaping uniforms allows both default presets and future profiles to rebalance the disc without further shader edits.
- Adding a controlled base fill blended between the core and corona palettes should keep the disc cohesive while respecting bloom limits.

## Implementation Plan

1. Extend `StarDiskShaderConfig` and `StarDiskUniformValues` with radial shaping parameters (`textureRadialPower`, `coronaEdgeSoftness`, `baseFillStrength`) and clamp them in `buildStarDiskMaterialConfig`.
2. Update GLSL shader (`starDisk.fragment.glsl`) to consume the new uniforms, adjust corona falloff, radial UV sampling, and introduce a tinted base fill contributing to both colour and alpha.
3. Refresh `CELESTIAL_ENVIRONMENT` defaults and Vitest coverage (`star-disk-material.spec.ts`) to exercise defaults, clamping, and uniform propagation through `updateStarDiskUniforms`.
4. Re-run `npm run typecheck`, `npm test`, and capture before/after observations to confirm the fuller-disc animation.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID  | Description                                                                | Status    | Updated    | Notes                                                                                   |
| --- | -------------------------------------------------------------------------- | --------- | ---------- | --------------------------------------------------------------------------------------- |
| 1.1 | Extend config/uniform types with new radial parameters                     | Completed | 2025-09-25 | Added `textureRadialPower`, `coronaEdgeSoftness`, `baseFillStrength` with clamps.       |
| 1.2 | Revise fragment shader to apply new uniforms and base fill                 | Completed | 2025-09-25 | Shader now biases radial sampling, adds swirl, and injects base fill/alpha boost.       |
| 1.3 | Update defaults, tests, and ensure uniform propagation without recreation  | Completed | 2025-09-25 | Defaults tuned; Vitest extended for clamps, defaults, and runtime updates.              |
| 1.4 | Run validation suite and capture qualitative improvement for handoff notes | Completed | 2025-09-25 | Ran `npm run typecheck` + `npm test`; qualitative capture pending screenshot follow-up. |

## Progress Log

### 2025-09-25

- Logged requirements/design updates and captured the planned parameter additions before implementation.
- Implemented radial shaping uniforms, updated fragment shader with swirl/base fill, refreshed config defaults, and expanded Vitest coverage.
- Executed typecheck/tests to verify changes and noted need for future visual documentation.
