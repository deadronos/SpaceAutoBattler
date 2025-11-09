# TASK138 - Star Disk View Compensation

**Status:** Completed  
**Added:** 2025-09-27  
**Updated:** 2025-09-27

## Original Request

Fix the star disk so it no longer billboards with the camera. Keep the mesh locked to the desired viewing angle and feed camera direction into the shader so highlights stay consistent.

## Thought Process

- The existing component uses `lookAt(camera.position)` each frame, forcing the star disk to spin as the camera orbits. That breaks the desired fixed view.
- We can instead align the mesh normal with the star-light direction once, letting the geometry stay fixed regardless of camera.
- To avoid the corona looking flat when seen from an angle, we need to send view-alignment data to the shader and compensate the radial falloff.
- Uniform updates must remain deterministic (simulation time + camera transform) to keep replays stable.

## Implementation Plan

1. Remove the per-frame billboard call and set a base quaternion that aligns the disk with the star-light direction. Ensure orientation updates if the direction changes. _(Owner: Copilot — Pending)_
2. During `useFrame`, compute the camera-to-mesh vector, derive plane-space projection components, and push a `viewAlignment` structure into the shader uniforms. _(Owner: Copilot — Pending)_
3. Extend `starDiskMaterial` and GLSL shader to accept the new uniform and rescale plane UVs/brightness based on the camera alignment. _(Owner: Copilot — Pending)_
4. Update Vitest coverage (material + component) to exercise the new behavior and clamp logic. _(Owner: Copilot — Pending)_
5. Run `npm run typecheck` and `npm test`; spot-check the render to confirm the disk stays stable. _(Owner: Copilot — Pending)_

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID  | Description                                                   | Status    | Updated    | Notes                                                     |
| --- | ------------------------------------------------------------- | --------- | ---------- | --------------------------------------------------------- |
| 1.1 | Establish fixed orientation quaternion for the star disk mesh | Completed | 2025-09-27 | Mesh copies precomputed quaternion when direction changes |
| 1.2 | Compute view-alignment uniform payload in `useFrame`          | Completed | 2025-09-27 | Added deterministic helper and runtime guards             |
| 1.3 | Modify shader/material to consume `iViewAlignment`            | Completed | 2025-09-27 | GLSL compensates plane stretch; uniforms extended         |
| 1.4 | Refresh unit tests for new uniform + orientation              | Completed | 2025-09-27 | Added orientation helper spec and uniform assertions      |
| 1.5 | Execute validation commands and document results              | Completed | 2025-09-27 | `npm run typecheck` + `npm test` passing                  |

## Progress Log

### 2025-09-27

- Captured requirements and design for fixed-plane star disk approach, including shader compensation plan and error handling matrix.
- Implemented fixed orientation, view-alignment uniform plumbing, shader compensation, and extended coverage. Typecheck/tests green.
