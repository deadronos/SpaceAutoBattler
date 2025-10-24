# TASK234 - Restore Star Disk Animation Under Debug Flag

**Status:** Completed  
**Added:** 2025-10-03  
**Updated:** 2025-10-03

## Original Request

User observed that the star shader stopped animating and asked whether the time parameter was updating when `?copilot_debug=1` is present.

## Thought Process

- Debug builds currently replace the shader with a `MeshBasicMaterial` any time the debug flag is active, so animation disappears even when no override is requested.
- The render loop should still advance `iTime` every frame; we need a regression test that confirms the uniform increases monotonically.
- Keeping the shader attached during debug prevents divergence between production and debug visuals while still honoring explicit force-basic overrides.

## Implementation Plan

- Remove the unconditional fallback to `MeshBasicMaterial` during render when `debugEnabled` is true.
- Ensure debug helper geometry remains gated by the debug flag without affecting the attached material.
- Add a Vitest spec that mounts `StarDisk` with the debug flag and asserts the mesh retains `ShaderMaterial` after advancing a frame.
- Extend the spec harness to spy on `updateMainSequenceStarUniforms` and verify the `time` argument grows monotonically across frames.
- Re-run existing debug lockdown tests and TypeScript checks to guard regressions.

## Progress Tracking

**Overall Status:** Completed - 100%

| ID  | Description                                                 | Status    | Updated    | Notes                                                                                   |
| --- | ----------------------------------------------------------- | --------- | ---------- | --------------------------------------------------------------------------------------- |
| 1.1 | Detach forced basic material rendering from debug flag      | Completed | 2025-10-03 | Shader always attached; helpers remain gated by debug flag.                             |
| 1.2 | Add Vitest coverage for shader retention & time advancement | Completed | 2025-10-03 | Extended `star-disk-debug-lockdown` spec with new cases.                                |
| 1.3 | Run targeted tests and refresh memory documentation         | Completed | 2025-10-03 | Ran `npx vitest test/vitest/star-disk-debug-lockdown.spec.tsx` and `npm run typecheck`. |

## Progress Log

### 2025-10-03

- Created TASK234 plan, requirements, and design doc capturing the star disk animation regression scenario.
- Updated `StarDisk.tsx` to keep the shader material attached under `?copilot_debug=1`, added monotonic time assertions in Vitest, and revalidated via targeted spec plus `npm run typecheck`.
