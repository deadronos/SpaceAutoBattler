# Design — Star Disk Fixed Plane + View Compensation

## Summary

- Lock the star disk mesh orientation to the configured star-light direction instead of billboarding to the camera.
- Provide camera-relative view-alignment data to the shader so highlights and radial falloff remain visually consistent as the viewer moves.
- Maintain deterministic uniform updates driven by simulation time to preserve existing replay stability.

## Architecture

- **StarDisk component** computes a base quaternion that aligns the mesh local +Z with the star-light direction. The mesh keeps this quaternion for the lifetime of the component (unless the direction changes).
- **Frame update hook** derives a deterministic view-alignment triple `(planeX, planeY, facingCos)` from the camera and mesh world transforms. The update depends only on simulation time, camera transform, and config state.
- **Shader material** gains a new uniform `iViewAlignment` (vec3). The fragment shader uses this vector to stretch plane coordinates along the camera-projected axis and to scale brightness based on facing cosine.
- **Renderer pipeline** continues to update `iTime`, `iResolution`, textures, camera roll, and star-north uniforms as before.

## Data Flow

```text
Three.js Camera -> StarDisk.useFrame -> viewDirection (world) -> project onto mesh plane ->
|-> iViewAlignment (vec3) -> Shader (fragment) -> compensated UV / brightness curves
```

- The component calculates the mesh world normal, tangent, and bitangent vectors from its quaternion each frame.
- Camera position minus mesh position yields the view direction; projection onto the plane gives the 2D direction for anisotropic compensation. Dot product with the normal provides the facing cosine.
- The shader consumes `iViewAlignment` to rescale local UV space, counteracting foreshortening so the star disk retains a circular core and balanced corona.

## Interfaces

- `MainSequenceStarUniformUpdate` gains optional property `viewAlignment?: { x: number; y: number; z: number };` where `x` and `y` encode the projected direction in local XY, and `z` encodes the clamped facing cosine.
- Shader uniform block extends with `uniform vec3 iViewAlignment;` defaulting to `(0.0, 0.0, 1.0)`.
- `StarDisk` module exposes no new public props; orientation remains derived from `StarLightConfig`.

## Data Models

- `viewAlignment` values are clamped to finite numbers before hitting GLSL. `z` stays within the inclusive range 0–1; `(x, y)` either form a zero vector (front-on) or a normalized direction.
- We derive `invCos = 1 / max(z, 0.2)` in GLSL to bound stretching when the disc is nearly edge-on.

## Error Handling

| Scenario                                     | Detection                           | Response                                                          |
| -------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| Mesh or parent matrices not ready            | `meshRef.current` null or no parent | Skip orientation/update for the frame; retain last valid uniforms |
| Camera missing (e.g., suspense)              | `state.camera` falsy                | Abort update (no uniform change) to avoid NaNs                    |
| Facing cosine <= 0 due to camera behind disc | Clamp to 0 via `Math.max`           | Treat as edge-on; shader receives minimal brightness              |
| Uniform update receives NaN/Inf              | `Number.isFinite` guard             | Default to `(0, 0, 1)` to keep shader stable                      |

## Unit Testing Strategy

1. Extend `star-disk-material.spec.ts` to assert `updateMainSequenceStarUniforms` applies the new view-alignment inputs and clamps invalid data.
2. Add a `star-disk.component.spec.tsx` case that renders the component with a mocked camera, advances a frame, and ensures the mesh quaternion and uniform payload align with the star-light direction.
3. Re-run existing shader material tests to ensure regressions are caught, and add targeted snapshot (screenshot) coverage in Playwright follow-up.

## Open Questions / Follow-Ups

- Automate the brightness-tolerance check in the Playwright orbit scenario.
- Consider exposing `starNorth` as config once disk orientation is fixed.
