# TASK134 - Main Sequence Star Shader Swap

**Status:** Completed  
**Added:** 2025-09-26  
**Updated:** 2025-09-27

## Original Request

- Replace the existing star disk shader configuration with the provided `mainsequencestar.glsl` Shadertoy fragment.
- Use the organic texture for `iChannel0` and the noise texture for `iChannel1`.
- Remove configuration-driven overrides for the star shader.

## Thought Process

- The current `StarDisk` implementation depends on a sprawling `StarDiskShaderConfig`, associated debug overrides, and dozens of uniforms. Porting the Shadertoy shader means flattening this pipeline to a static fragment plus a handful of core uniforms (`iTime`, `iResolution`, sampler bindings).
- The new shader must stay as close to the source as possible; only wrapper code should adapt it to Three.js (uniform declarations, `main` forwarding, texture fallbacks).
- We still need deterministic animation: leverage simulation time when available and fall back to accumulated real time otherwise.
- Existing Vitest coverage targets the configurable pipeline; it needs to be replaced with tests that validate shader creation, uniform updates, fallbacks, and warning paths.
- Debug override plumbing becomes obsolete once configs disappear; removing it simplifies the render path and avoids stale globals.

## Implementation Plan

1. **Prune config surface** — Delete `StarDiskShaderConfig` and related interfaces from `environment.ts`; strip the `shader` block from `CELESTIAL_ENVIRONMENT`; remove `applyStarDiskDebugOverrides` usages and module.
2. **Author new material factory** — Replace `starDiskMaterial.ts` with a slimmer `createMainSequenceStarMaterial`/`updateMainSequenceStarUniforms` API that imports `mainsequencestar.glsl`, binds textures, and exposes fallback handling.
3. **Adapt React integration** — Update `StarDisk.tsx` to use the new factory, manage `iTime`/`iResolution` uniforms per-frame, maintain bloom registration, and deploy `MeshBasicMaterial` fallback on failure.
4. **Adjust shader asset** — Wrap `mainsequencestar.glsl` with the necessary uniforms and `main()` adapter without altering core logic; ensure textures map to `iChannel0/1` and we expose any required precision qualifiers.
5. **Refresh tests & docs** — Delete old Vitest specs, add new ones for the simplified pipeline, update requirements/design memory docs, and rerun `npm run typecheck` plus `npm test`.

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID | Description | Status | Updated | Notes |
| --- | --- | --- | --- | --- |
| 1.1 | Draft requirements and design for shader swap | Complete | 2025-09-26 | Captured in memory bank (`requirements.md`, `design-main-sequence-star.md`). |
| 1.2 | Implement shader/material/React integration changes | Complete | 2025-09-27 | Replaced config-driven pipeline with new factory and component wiring. |
| 1.3 | Update Vitest coverage and validation scripts | Complete | 2025-09-27 | Added material/component specs and ran typecheck + full Vitest suite. |

## Progress Log

### 2025-09-26

- Reviewed existing star disk material, config, and tests to map removal scope.
- Authored new EARS requirements and high-level design documenting texture bindings, uniform flow, and error handling.
- Defined implementation plan covering config pruning, shader adaptation, React wiring, and test refresh.

### 2025-09-27

- Removed legacy shader config/debug overrides and introduced `createMainSequenceStarMaterial` with deterministic uniform helpers.
- Updated `StarDisk.tsx` to instantiate the new material, propagate uniforms each frame, handle bloom registration, and fall back cleanly on factory failure.
- Replaced Vitest coverage with focused material/component specs validating uniforms, fallback textures, and warning paths.
- Ran `npm run typecheck` and `npm test` (184 passing) to confirm build stability.
- Refreshed memory docs and task index to reflect completion and note legacy shader requirements as archival.
