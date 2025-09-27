# Design  Star Disk Boundary Feather

## Summary

- Deliver a configurable radial alpha feather that softens the transition between the star disk and the background without upsetting existing haze or bloom behavior.
- Keep the implementation deterministic: uniforms must be derived from the same simulation clock and camera transforms already driving the star disk.
- Expose artist-facing controls under `CelestialEnvironmentConfig.starDisk.boundary` so tuning can occur without code edits.
- Default environment preset uses `{ featherStart: 0.88, featherExponent: 2.4, alphaFloor: 0.02 }`, matching current art direction while retaining room to disable via legacy values.

## Background

The current `mainsequencestar.glsl` shader produces a bright core, corona, and outer glow. Although haze tapering reduces rim brightness, the alpha channel still approaches a hard cutoff around the billboard radius. Against dark backgrounds this introduces a visible ring. Option 1 focuses on augmenting the existing shader to fade the alpha channel (and optionally color gain) near the outer edge using a configurable curve.

## Requirements (EARS)

1. **WHEN** the boundary feather radius decreases via configuration, **THE SYSTEM SHALL** drive the star disk alpha to zero before the billboard radius so the edge blends smoothly into space. *(Acceptance: render harness measures alpha reaching <0.01 at the configured radius.)*
2. **WHEN** boundary feathering is disabled (radius set to 1 or alpha floor raised to 1), **THE SYSTEM SHALL** match the pre-existing alpha profile within a tolerance of 1%. *(Acceptance: regression test compares uniform payload and on-screen luminance against baseline.)*
3. **WHEN** runtime configuration hot-reloads (environment swap or inspector tweak), **THE SYSTEM SHALL** apply the new feather uniforms on the next `useFrame` iteration without re-instantiating the material. *(Acceptance: component test mutates config and inspects uniform vector.)*
4. **WHEN** the camera approaches a grazing angle that already engages haze tapering, **THE SYSTEM SHALL** clamp feather math to finite numbers and avoid dividing by zero or introducing NaNs. *(Acceptance: unit test feeds extreme `facingCos` values and asserts uniform outputs remain finite.)*
5. **WHEN** the feather exponent is increased, **THE SYSTEM SHALL** produce a sharper falloff while keeping the alpha derivative continuous to prevent banding. *(Acceptance: shader unit harness samples alpha curve and checks monotonic decrease with no discontinuities.)*

## Proposed Approach (Option 1  Radial Alpha Feather)

### Shader Additions

- Introduce a helper `float boundaryFeather(vec2 planeCoords, vec4 params)` that returns an attenuation factor `feather` in `[alphaFloor, 1]`.
  - Let `params.x` be the normalized radius where feathering begins (`featherStart`). Values clamped to `[0.6, 1.0]`.
  - Let `params.y` be an exponent controlling the curve (`featherExponent`). Range `[0.5, 6.0]`.
  - Let `params.z` represent an alpha floor to prevent total disappearance when desired (`alphaFloor`). Range `[0.0, 0.3]`.
  - Let `params.w` reserve room for future cross-fade (set to 0 for now).
- Compute `radius = length(planeCoords)` (already available as `dist`). Use `smoothstep(featherStart, 1.0, radius)` raised to `featherExponent` to derive `t`. Set `feather = mix(1.0, alphaFloor, clamp(t, 0.0, 1.0))`.
- Multiply current `alpha` and optional color contributions (outer glow and corona) by `feather`. Core intensity remains unchanged to avoid flattening the highlight.
- Maintain premultiplied behavior by applying `feather` prior to clamping `color` and before computing `gl_FragColor`.

### Material & Uniform Wiring

- Extend `MainSequenceStarUniformUpdate` with `boundary?: { featherStart?: number; featherExponent?: number; alphaFloor?: number; }`.
- Add new uniform entry `iBoundaryFeather` (`Vector4`) to the material initialisation with defaults `(0.92, 2.0, 0.0, 0.0)` representing the current hard edge.
- In `updateMainSequenceStarUniforms`, clamp incoming values, derive safe defaults, and write to `iBoundaryFeather.value.set(start, exponent, floor, 0)`.
- Ensure the helper respects the environment-provided haze fade (alpha multiplication should occur after haze attenuation so both effects combine gracefully).

## Configuration Surface

Extend `CelestialEnvironmentConfig`:

```ts
export interface StarDiskBoundaryConfig {
  /** Normalized radius (01) where alpha feathering begins; 1 keeps legacy edge. */
  featherStart?: number;
  /** Exponent controlling how quickly alpha collapses toward the edge. */
  featherExponent?: number;
  /** Minimum alpha multiplier retained at the rim (0 removes the disk entirely at radius). */
  alphaFloor?: number;
}

export interface StarDiskConfig {
  ...
  boundary?: StarDiskBoundaryConfig;
}
```

Default values proposed for `CELESTIAL_ENVIRONMENT`:

- `featherStart: 0.88`
- `featherExponent: 2.4`
- `alphaFloor: 0.02`

`StarDisk.tsx` will merge `props.boundary ?? env.starDisk?.boundary` and pass it into the uniform update each frame.

## Data Flow

```text
CelestialEnvironmentConfig.starDisk.boundary
    -> StarDisk component (memoized boundary config)
        -> updateMainSequenceStarUniforms(... boundary)
            -> Shader uniform iBoundaryFeather (vec4)
                -> boundaryFeather() inside fragment shader
                    -> alpha and bloom contributions scaled before output
```

Deterministic values: the boundary uniform relies solely on configuration and does not incorporate time-dependent randomness, preserving replay stability.

## Implementation Plan

1. **Types & Config:** Add `StarDiskBoundaryConfig` with validation clamps and defaults inside `environment.ts`. Update `MainSequenceStarUniformUpdate` signature and tests.
2. **Material:** Extend shader material creation to seed `iBoundaryFeather` default. Update uniform update helper with range checking.
3. **Shader:** Implement `boundaryFeather` helper in `mainsequencestar.glsl`, integrate into alpha and outer glow calculations, and ensure ordering respects haze.
4. **Component Wiring:** Thread boundary config through `StarDisk` memo/resolver and include in `useFrame` uniform update payload.
5. **Tests:**
   - Vitest: assert uniform clamps, ensure defaults when config missing, verify deterministic vectors.
   - Shader harness: sample alpha across radii for different settings, verifying monotonic fade.
   - Playwright visual regression: capture baseline and feathered renders.
6. **Docs:** Update `memory/design-star-disk-haze-taper.md` cross-reference and add tuning guidance in `docs/` if needed.

## Implementation Notes (2025-09-27)

- Added `StarDiskBoundaryConfig` to `CelestialEnvironment` with the default preset (`0.88/2.4/0.02`) and wired optional overrides through `StarDisk` props.
- Introduced `deriveBoundaryUniform` with clamps plus legacy bypass, seeded `iBoundaryFeather` uniform, and updated GLSL (`boundaryFeather`) to attenuate both color and alpha premultiplied.
- Authored regression coverage: new `star-disk-boundary.spec.ts`, expanded `star-disk-material.spec.ts`, and component hot-reload test verifying uniform updates; validated with `npm run typecheck` and `npm test`.

## Error Handling

| Scenario | Detection | Response |
| --- | --- | --- |
| Config supplies NaN or out-of-range values | `Number.isFinite` and clamp checks in uniform updater | Clamp to safe defaults; log `console.warn` once per session when clamping occurs. |
| `featherStart` >= 1 and `alphaFloor` == 0 | Derived smoothstep becomes flat | Force `featherStart` to `min(value, 0.999)` ensuring curve activation; if floor is 0, we still guarantee alpha near zero without division. |
| Shader compilation fails after adding helper | GLSL compile error on material creation | Catch error in `createMainSequenceStarMaterial`, warn, and fall back to existing basic material as we do today. |
| Boundary config removed during runtime (undefined) | `boundary` becomes `undefined` | Re-apply defaults (`0.92, 2.0, 0.0`) to match previous visuals. |
| Extreme camera angle drives haze fade to 0 | Combined alpha multiplication may underflow | Clamp final alpha to `[0, 1]` (already in shader) and maintain `alphaFloor` to keep minimal signal if desired. |

## Validation Strategy

- **TypeScript:** `npm run typecheck` to ensure new interfaces propagate correctly.
- **Unit Tests:** Extend `test/vitest/star-disk-material.spec.ts` with boundary uniform cases and add curve sampling assertions.
- **Visual Tests:** Update Playwright comparison suite to capture the outer boundary before/after; add pixel-delta thresholds verifying the halo fades smoothly.
- **Performance:** Benchmark shader invocation counts in a GPU timing harness to confirm negligible cost increase (one `smoothstep`, one `pow`).

## Risks & Mitigations

- **Risk:** Feathering could reduce overall brightness, affecting bloom balance. *Mitigation:* keep alpha-floor configurable and provide documentation on compensating via `uCoronaStrength` or bloom thresholds.
- **Risk:** Additional uniforms might desync with legacy configs. *Mitigation:* provide defaults identical to current behavior and write regression tests verifying the legacy curve when boundary config is omitted.
- **Risk:** Artists might request more granular control (e.g., independent color fade). *Mitigation:* reserve `iBoundaryFeather.w` for future blend mixes without changing uniform layout.

## Open Questions

- Should we allow the feather to influence color saturation in addition to alpha to prevent halo tint shifts? (Out of scope for option 1, but can be added using `params.w`.)
- Do we need runtime GUI controls (e.g., debug panel) to help artists tune the boundary? If so, expose through existing debug config.
- How should boundary feather interact with selective bloom thresholds? We may want to adjust bloom layer intensity once visuals are validated.
