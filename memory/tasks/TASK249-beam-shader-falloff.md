# TASK249 - Beam Shader Falloff

**Status:** Completed  
**Added:** 2025-10-14  
**Updated:** 2025-10-14

## Original Request

Add the shader factory and register it, ensuring instance color support with optional per-instance brightness scalar. Implement inverse-squared falloff (near brightness 1.0, far brightness 0.5, falloff exponent 1.2) and expose these parameters through the config folder.

## Thought Process

- Prior beam work already introduced per-instance scaling and team tint, but material remains Phong-like and lacks gradient falloff.  
- A dedicated ShaderMaterial keeps compatibility with instancing, bloom, and additive blending while enabling per-fragment control driven by uniforms.  
- Configurability must live under `src/config` to stay data-driven and allow future balancing without shader edits.  
- Adding a single instanced float keeps attribute footprint low (4 bytes × projectile capacity) while enabling gameplay modifiers later.

## Implementation Plan

1. Capture EARS requirements in `memory/requirements.md`. ✅  
2. Draft design document covering shader architecture, config surface, error handling, and tests. ✅  
3. Extend `PROJECTILE_CONFIG` (or allied config file) with beam shader falloff defaults and clamps. ✅  
4. Implement shader factory with cached `THREE.ShaderMaterial`, uniforms seeded from config, additive blending, and instance color support. ✅  
5. Update material registry entry for `beam:laser` to point at the shader factory. ✅  
6. Add `instanceBeamBrightness` buffer in `ProjectilesInstancedLayer` and write per-shot scalars (default 1.0). ✅  
7. Wire uniforms/attribute into shader code to apply inverse-squared falloff and brightness bounds. ✅  
8. Add/refresh unit tests exercising config export, factory uniforms, and instanced attribute. ✅  
9. Run `npx tsc --noEmit` and relevant Vitest suites. ✅

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID  | Description | Status | Updated | Notes |
| --- | ----------- | ------ | ------- | ----- |
| 1.1 | Record requirements in `memory/requirements.md`. | Complete | 2025-10-14 | Added TASK249 section with three EARS statements. |
| 1.2 | Publish design doc under `memory/designs`. | Complete | 2025-10-14 | Authored `TASK249-beam-shader-falloff.md`. |
| 1.3 | Add config entries for falloff parameters. | Complete | 2025-10-14 | Added `PROJECTILE_BEAM_SHADER_CONFIG` with clamps. |
| 1.4 | Implement shader factory + register. | Complete | 2025-10-14 | Created shader factory, Bloom flag, registry wiring. |
| 1.5 | Extend instanced layer buffers and shader logic. | Complete | 2025-10-14 | Added beam brightness attribute and per-instance updates. |
| 1.6 | Update/author unit tests and run validation. | Complete | 2025-10-14 | Added renderer spec, ran `tsc` + Vitest. |

## Progress Log

### 2025-10-14

- Logged TASK249 requirements in memory bank.
- Started design draft capturing architecture and testing strategy.
- Added beam shader config, factory, instanced attribute, and renderer tests. Ran `npx tsc --noEmit` and targeted Vitest suites (renderer-beam-shader, projectile-behaviours).
