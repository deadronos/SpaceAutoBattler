# TASK250 - Beam Shader Compile Fix & Shield Visibility Guard

**Status:** In Progress  
**Added:** 2025-10-14  
**Updated:** 2025-10-14

## Original Request

The runtime reports two regressions:

- `Postprocessing render failed: Error: Can not resolve #include <instanceColor_pars_vertex>` when compiling the beam laser shader after enabling postprocessing.
- `[ShieldBubble] Shield bubble should be visible but isn't for ship 3 (fighter): shield=0.4, maxShield=24, expectedFraction=0.017, computedFraction=0.008, threshold=0.01` indicating the shield visibility guard is firing even though the shield ratio exceeds the threshold.

## Thought Process

- The beam shader recently switched to a custom `ShaderMaterial` that still references Three.js include chunks for instancing; the project's locked `three@0.180.0` build does not ship the `instanceColor_*` chunks, so compilation fails under postprocessing where shader compilation happens eagerly.
- We need to hand-roll the attribute/varying declarations and transfer logic for instance colors, ensuring the existing instanced mesh pathway still enables `USE_INSTANCING_COLOR` when color buffers are present.
- The shield warning stems from rendering with a slightly stale React state value before the frame's `useFrame` update completes. A ref already tracks the latest fraction; render-time guards and validation should rely on the ref (or a monotonic max) to prevent false warnings while still hiding shields below threshold.
- Tests must assert the shader no longer references the missing include and that shield validation tolerates the asynchronous update path.

## Implementation Plan

1. Update `memory/requirements.md` with EARS requirements covering the shader compilation fix and shield visibility guard.
2. Draft a design doc (`memory/designs/TASK250-beam-shader-compile-fix.md`) describing the manual instance color handling, shield fraction ref usage, error matrix, and testing strategy.
3. Modify `src/renderer/materials/beamLaserShader.tsx` to replace the missing `#include` sections with explicit attribute declarations and inlined logic guarded by `USE_INSTANCING_COLOR`.
4. Adjust `src/components/ship/ShipShield.tsx` (and, if needed, `shieldUtils.ts`) so render-time visibility uses the latest fraction refs, eliminating spurious warnings while preserving threshold behavior.
5. Extend Vitest coverage: update `test/vitest/renderer-beam-shader.spec.ts` to assert the vertex shader omits the missing include and exposes the manual attribute logic; add or update shield utils tests to confirm the warning guard respects latest fractions.
6. Run `npm run typecheck` and targeted Vitest suites to validate the fixes.
7. Record outcomes and follow-ups in the task file, design, and progress log entries.

## Progress Tracking

**Overall Status:** In Progress — 0%

### Subtasks

| ID | Description | Status | Updated | Notes |
| --- | --- | --- | --- | --- |
| 1.1 | Capture requirements in memory/requirements.md | Completed | 2025-10-14 | Requirements recorded in new TASK250 section. |
| 1.2 | Publish design doc with manual instancing approach and error matrix | Completed | 2025-10-14 | Authored `memory/designs/TASK250-beam-shader-compile-fix.md`. |
| 1.3 | Patch beam shader to drop missing chunks and inline instance color handling | Completed | 2025-10-14 | Removed Three.js `#include` usage and inlined instance color attribute in `beamLaserShader`. |
| 1.4 | Harden shield visibility rendering to avoid stale-state warnings | Completed | 2025-10-14 | Render now uses ref-backed fraction and latest ratio when validating visibility. |
| 1.5 | Update/add Vitest coverage for shader and shield visibility | Completed | 2025-10-14 | Extended beam shader and shield utils specs for instancing and latest fraction guard. |
| 1.6 | Run typecheck and relevant Vitest suites | Completed | 2025-10-14 | `npm run typecheck` and targeted Vitest suites passed. |
| 1.7 | Update memory records and close out task | Completed | 2025-10-14 | Requirements, design, active context, and task log updated. |

## Progress Log

### 2025-10-14

- Task created to track beam shader compilation failure and shield visibility warning regressions observed during runtime.
- Logged EARS requirements and drafted design covering manual instancing color handling, shield fraction ref usage, error matrix, and test plan.
- Inlined beam shader instancing color declarations, updated shield render guard to use the latest fraction, and expanded Vitest coverage for both pathways.
- Verified changes with `npm run typecheck` and targeted Vitest suites (`renderer-beam-shader`, `shieldUtils`).
- Synced memory artifacts (requirements, design, active context, task log) to capture the fixes and validation trail.
- Addressed follow-up shader compile error by dropping unused tonemapping/encodings chunks from the fragment shader to match available Three.js includes.
- Manually declared the instancing matrix attribute and applied the transform inline to keep vertex compilation working without the missing Three.js instancing chunks.
- Fixed GLSL preprocessor indentation so `#include` directives start at column 0, resolving remaining vertex shader compilation errors.
