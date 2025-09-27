# Design — Star Disk Haze Taper

## Summary

- Introduce a configurable gradient that pulls the star disk haze inward so the rim fades toward the horizon instead of blooming across the entire plane.
- Reuse the existing view-alignment uniform to scale the gradient by the camera-facing cosine, keeping the core stable while taming edge glare.
- Surface controls through `CelestialEnvironmentConfig.starDisk.haze` and clamp deterministic uniforms to avoid NaNs during extreme camera angles or config overrides.

## Architecture

- **Configuration layer** adds `haze` settings (`taperStrength`, `edgeFadeThreshold`, `edgeExponent`) to the star disk slice. Defaults mirror the current shader while providing room for art direction tweaks.
- **Uniform update helper** in `starDiskMaterial` derives a scalar `hazeFade` each frame using the camera-facing cosine and taper strength. The helper also emits a fallback value when inputs are invalid.
- **Shader pipeline** extends the fragment shader with a small function `hazeTaper(vec2 uv, float facingCos)` that reshapes the corona contribution: the inner 0.0–0.75 radius remains untouched; the outer band scales by `hazeFade` and a smoothstep using `edgeExponent`.
- **Component wiring** (`StarDisk.tsx`) gathers config changes and feeds them to the uniform update so tweaks propagate without re-instantiating the material.

## Data Flow

```text
CelestialEnvironmentConfig.starDisk.haze -> StarDisk.useFrame ->
  updateMainSequenceStarUniforms({ hazeFade, hazeParams }) ->
    Shader uniforms (iHazeParams) -> mainsequencestar.glsl ->
      hazeTaper(uv, facingCos) -> attenuated corona color
```

- Config updates trigger a shallow compare inside `useMemo` to avoid redundant allocations.
- `viewAlignment.z` already carries the facing cosine; the uniform helper multiplies this value with `taperStrength` to form `hazeFade`.
- Fragment shader combines `hazeFade` with the radial smoothstep so edge brightness collapses toward zero as the camera approaches grazing angles.

## Interfaces

- `CelestialEnvironmentConfig.starDisk` gains:
  - `haze: { taperStrength: number; edgeFadeThreshold: number; edgeExponent: number; }`
- `MainSequenceStarUniformUpdate` extends with:
  - `haze?: { fade: number; edgeThreshold: number; edgeExponent: number; }`
- GLSL uniform block adds:
  - `uniform vec3 iHazeParams; // x: fade, y: edgeThreshold, z: edgeExponent`

## Data Models

- `taperStrength` defaults to `0.85`, clamped to `[0, 1]`.
- `edgeFadeThreshold` (facing cosine) defaults to `0.3`, clamped to `[0.0, 0.9]` to avoid dividing by zero near the horizon.
- `edgeExponent` defaults to `2.0`, clamped to `[0.5, 6.0]` to control smoothstep steepness without ringing.
- Uniform helper always emits finite numbers; NaNs result in the fallback `(fade: 1, edgeThreshold: 1, edgeExponent: 2)` to preserve prior behaviour.

## Error Handling

| Scenario | Detection | Response |
| --- | --- | --- |
| Config provides NaN or out-of-range values | `Number.isFinite` / range checks | Clamp to safe defaults and log a debug warning (once per session). |
| Camera-facing cosine undefined (no camera) | `viewAlignment` missing | Skip haze update for the frame; retain previous uniforms. |
| Shader compilation fails after adding `iHazeParams` | GLSL compile error | Revert to previous shader chunk and warn, mirroring existing fallback. |
| Material uniforms rejected (Three.js throws) | try/catch around uniform set | Emit warning, keep last known good uniforms. |
| Taper drives negative corona intensity | Shader clamp detects value < 0 | `max(value, 0.0)` inside fragment shader ensures non-negative contribution. |

## Unit Testing Strategy

1. Extend `test/vitest/star-disk-material.spec.ts` with cases covering haze uniform clamps, config propagation, and fallback when `viewAlignment` is missing.
2. Add `test/vitest/star-disk-haze-taper.spec.ts` to isolate the GLSL helper (compiled via `glsl-tokenizer` harness) and verify taper output at core, mid, and edge radii.
3. Update `test/vitest/star-disk.component.spec.tsx` to mutate config during a frame advance and assert the shader material receives updated haze uniforms.
4. Maintain deterministic snapshots by seeding camera transforms; ensure tests cover both head-on (`facingCos = 1`) and edge-on (`facingCos = 0.1`) scenarios.

## Performance Considerations

- Uniform calculations remain O(1) per frame and reuse existing object references to avoid GC churn.
- GLSL additions use scalar math (no loops, no texture fetches) to keep fragment cost negligible relative to existing noise sampling.

## Open Questions

- Do we need an artist-facing curve editor beyond exponent and strength? Capture feedback after the first tuning pass.
- Should haze taper interact with selective bloom intensity? Evaluate after visual validation.
