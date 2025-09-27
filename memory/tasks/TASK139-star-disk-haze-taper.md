# TASK139 - Star Disk Haze Taper

**Status:** Completed  
**Added:** 2025-09-28  
**Updated:** 2025-09-28

## Original Request

"Implement a gradient taper that keeps the fiery core bright while reducing haze at the outer edge. Taper needs to respond to camera angle, not just UV radius." (Paraphrased from user follow-up after completing the view-compensation task.)

## Thought Process

- The current shader keeps the star disk brightness nearly uniform out to the rim, which looks blown out when the camera goes edge-on.
- We already send view-alignment info (`iViewAlignment`) to the shader, so we can reuse the facing cosine for angle-aware tapering.
- Introducing a configurable gradient lets art direction dial in how quickly the haze collapses; defaults should preserve today’s look with minor edge attenuation.
- We must preserve deterministic behaviour: uniform updates rely on config + camera transforms only, no random values.
- Error handling needs to mirror existing shader fallbacks — clamp inputs, and if compilation fails, revert to the previous shader variant.

## Requirements

Captured in `memory/requirements.md` under **2025-09-28 — Star Disk Haze Taper** (four EARS statements covering taper curve, clamp behaviour, config propagation, and fallback handling).

## Design Reference

See `memory/design-star-disk-haze-taper.md` for architecture, data flow, interface changes, and testing strategy.

## Implementation Plan

1. **Config & Types** — Extend `CelestialEnvironmentConfig.starDisk` with the `haze` group (`taperStrength`, `edgeFadeThreshold`, `edgeExponent`), updating runtime schema, defaults, and TypeScript interfaces. *(Owner: Copilot — Completed 2025-09-28)*
2. **Material Uniforms** — Update `updateMainSequenceStarUniforms` to compute the new haze payload using view alignment and config values, including clamps and warnings. *(Owner: Copilot — Completed 2025-09-28)*
3. **Shader Updates** — Modify `mainsequencestar.glsl` (and any shared helpers) to consume `iHazeParams`, applying the taper to corona/haze contribution while keeping the core untouched. *(Owner: Copilot — Completed 2025-09-28)*
4. **Component Wiring** — Ensure `StarDisk.tsx` feeds config overrides into the uniform update each frame without extra allocations; add memoized selectors if needed. *(Owner: Copilot — Completed 2025-09-28)*
5. **Testing & Validation** — Add/update Vitest suites (`star-disk-material.spec.ts`, new `star-disk-haze-taper.spec.ts`, component test) and run `npm run typecheck`, `npm test`; capture before/after renders for manual validation. *(Owner: Copilot — Completed 2025-09-28; manual visual capture deferred to follow-up)*

## Error Handling Matrix

| Scenario | Expected Response |
| --- | --- |
| Config values missing or NaN | Clamp to defaults, emit one-time debug warning, continue with safe uniforms. |
| Facing cosine below zero | Clamp to `[0, 1]`, treat as edge-on (fade to zero). |
| Uniform update receives non-finite result | Replace with `(fade: 1, edgeThreshold: 1, edgeExponent: 2)` before touching the material. |
| Shader compilation fails after adding haze code | Revert to previous fragment shader string and log warning; component continues rendering. |
| Material uniform assignment throws | Catch, log warning, keep previous uniforms so render remains stable. |

## Unit Testing Strategy

- Extend `test/vitest/star-disk-material.spec.ts` to cover haze uniform generation, clamps, and fallback path.
- Add `test/vitest/star-disk-haze-taper.spec.ts` to validate GLSL helper logic across radii and facing cosines.
- Update `test/vitest/star-disk.component.spec.tsx` to assert config-driven uniform updates in a frame advance.
- Ensure deterministic seeding for camera transforms so snapshot comparisons remain stable.

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID | Description | Status | Updated | Notes |
| --- | --- | --- | --- | --- |
| 1.1 | Capture requirements and design artefacts | Completed | 2025-09-28 | Requirements + design documents written and linked |
| 1.2 | Implement config and material changes | Completed | 2025-09-28 | Added haze config defaults, uniforms, and helper clamps |
| 1.3 | Extend shader with haze taper | Completed | 2025-09-28 | Shader uses `iHazeParams` to attenuate corona at the rim |
| 1.4 | Wire component + tests | Completed | 2025-09-28 | StarDisk passes haze config; new Vitest coverage committed |
| 1.5 | Run validation commands & captures | Completed | 2025-09-28 | `npm run typecheck`, `npm test`; visual capture pending follow-up |

## Progress Log

### 2025-09-28

- Drafted EARS requirements, design doc, and implementation plan for the haze taper follow-up.
- Documented error handling expectations and testing strategy ahead of coding.
- Implemented haze taper pipeline (config, uniforms, shader) with deterministic clamps.
- Added Vitest coverage (`star-disk-material`, new `star-disk-haze-taper`) and re-ran `npm run typecheck`, `npm test` (all passing). Visual capture queued for separate task once art direction signs off.
