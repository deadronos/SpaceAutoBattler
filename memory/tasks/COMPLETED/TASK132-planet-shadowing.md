# TASK132 - Planet Shadowing Enhancement

**Status:** Completed  
**Added:** 2025-09-26  
**Updated:** 2025-09-27

## Original Request

"Shouldn't the backside of the planets be shaded darker? Can we simulate shadows or do actual shadows?"

## Thought Process

- Planets without rim glow already use `MeshStandardMaterial`, so they support lighting, but the strong ambient light and emissive boosts soften the terminator.
- Planets with rim glow previously used a bespoke `ShaderMaterial` that ignored scene lighting, resulting in uniformly lit bodies.
- Using Three.js built-in shadow mapping will give us occlusion, provided meshes are configured to cast/receive shadows and the directional light has a tuned shadow camera.
- The rim effect is best preserved by keeping a standard surface material (for lighting) and layering a dedicated rim shell that does not interfere with the base shading.

## Implementation Plan

1. Keep planet surface shading on `MeshStandardMaterial` while adding an additive `PlanetRimShell` overlay for fresnel glow.
2. Enable `castShadow` and `receiveShadow` on planet meshes (and orbital rings where appropriate) so they participate in the star light shadow map.
3. Tune `StarLight` directional light shadow settings (map size, camera bounds, bias) to produce clean shadows across large celestial bodies.
4. Ensure unit coverage exercises rim shell parameters or component shadow flags, adapting tests as the implementation evolves.
5. Validate with `npm run typecheck`, `npm test`, and targeted visual capture.

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID  | Description                                      | Status        | Updated    | Notes |
| --- | ------------------------------------------------ | ------------- | ---------- | ----- |
| 1.1 | Replace rim wrapper with additive shell overlay  | Complete      | 2025-09-27 | Rim shell renders above surface, base material remains standard. |
| 1.2 | Enable planet cast/receive shadows               | Complete      | 2025-09-26 | Planet meshes flagged for shadow mapping participation. |
| 1.3 | Tune directional light shadow camera             | Complete      | 2025-09-26 | Configured map size, bias, and camera span from light distance. |
| 1.4 | Extend Vitest coverage for rim/shadow settings   | Complete      | 2025-09-27 | Coverage focuses on rim shell parameters and shadow flags. |
| 1.5 | Run validation commands                          | Complete      | 2025-09-26 | `npm run typecheck`, `npm test`. |

## Progress Log

### 2025-09-27

- Revisited rim implementation after lighting regression; standardised on `MeshStandardMaterial` for surfaces and introduced additive rim shell overlay.
- Verified planet meshes retain cast/receive shadow flags and directional light settings continue to produce clean occlusion.
- Updated Vitest coverage to reflect rim shell props and reran validation commands (`npm run typecheck`, `npm test`).
