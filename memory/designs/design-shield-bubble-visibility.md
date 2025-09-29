# Design — Shield Bubble Visibility Regression (TASK227)

## Overview

Restore visible shield bubbles for all hulls after reports that they disappeared in the live battlefield. The current component renders the bubble mesh with `renderOrder=-1` while the shader disables depth writes but leaves depth testing enabled. Opaque hull meshes therefore draw afterward and overwrite the shield pixels, hiding the effect. We will enforce a late render order and disable depth testing on the shield material so the bubble overlays the hull without altering depth buffers.

## Current Architecture

- `ShipObject` clones the GLTF scene, then mounts `<ShieldBubble>` with the entity and computed radius.
- `ShieldBubble` registers with bloom, measures shield fraction each frame, and outputs a `<mesh>` that uses the `shield:hex` material from `materialRegistry`.
- The shader-based material is instantiated inside `ShieldHexMaterial` (`ShaderMaterial` with transparent blending, depthWrite disabled).
- Hull meshes sit in the same group and retain default render order `0`, depth testing, and depth writes.

## Proposed Architecture

- Update `ShieldBubble` to render with a positive `renderOrder` (e.g., `20`) so it always evaluates after hull meshes.
- Ensure the shield material opts out of depth testing (`depthTest=false`) while keeping `depthWrite=false` so overlays remain deterministic and do not interfere with other transparent layers.
- Guard bloom registration to remain unchanged so the bubble still participates in the `shields` group.
- Add regression tests that exercise render order and material flags using lightweight component mounts.
- Brighten the default shield tuning so alpha floors and per-hull caps guarantee obvious visibility (raise `minAlphaFloor`, `fillAlphaMul`, and `maxAlpha` where necessary) and increase per-hull radius margins to peel the sphere away from the hull.

### Diagram

```text
ShipObject group
  ├─ primitive(cloned GLTF hull)  [renderOrder = 0, depthTest = true, depthWrite = true]
  └─ ShieldBubble mesh            [renderOrder = 20, depthTest = false, depthWrite = false]
                                    ↳ ShieldHexMaterial (ShaderMaterial)
```

## Data Flow

1. Simulation updates `ShipEntity.ship.shield` and `maxShield`.
2. `ShieldBubble` samples the values each render frame and computes a fraction.
3. When the fraction is above the threshold, the component renders the mesh.
4. The `ShieldHexMaterial` shader consumes the fraction (`opacity`) plus ripple data to produce final color.
5. Bloom provider keeps the mesh registered under the `shields` group for postprocessing.

## Interfaces

- `ShieldBubble(props: { entity: ShipEntity; radius?: number; hullMaterialsRef?: MutableRefObject<...>; })`
  - Renders the shield mesh when `shield/maxShield ≥ threshold`.
  - Will expose the mesh with `renderOrder` set to `SHIELD_RENDER_ORDER` constant for clarity.
- `ShieldHexMaterial(props: ShieldMaterialProps)`
  - Returns a `ShaderMaterial`; will now set `depthTest=false` during construction.
- `useBloomRegistration(ref, options)`
  - No changes; ensure registrations remain intact after render order tweak.

## Data Models

- `ShipEntity` (`src/types/index.ts`)
  - Fields used: `ship.shield`, `ship.maxShield`, `ship.team`, `ship.hull`, `shieldRipples`.
- `ShieldRipple` array stored on `ShipEntity`
  - No schema changes required; still feeds ripple uniforms.
- `ShieldVisualSettings`
  - Provides scale/margin; no changes but referenced for context.

## Error Handling Matrix

| Scenario | Detection | Response |
| --- | --- | --- |
| `maxShield ≤ 0` or non-finite | `computeShieldFraction` guards | Return `0` so mesh remains hidden; log once via existing warnings. |
| Material lookup fails | `getMaterial` fallback to `shield:hex` | Continue rendering with default shader, log only if registry missing entry (already enforced). |
| Bloom registration throws | Hook already guards `bloomCtx` null | No change; shield renders without bloom if registration unavailable. |
| Shader instantiation error | Drei fallback path remains `meshStandardMaterial` | Maintain existing fallback path; render order/depth settings apply equally. |

## Testing Strategy

- Add Vitest component regression verifying shield mesh `renderOrder` and `material.depthTest` values.
- Extend integration-style test to confirm bloom registration still attaches to `shields` group.
- Add static config assertion for shield alpha floors and maximum opacity caps to lock the brighter tuning.
- Re-run existing shield bubble visibility specs and renderer smoke suite.

## Rollout & Validation

- After implementation, run `npm run typecheck` and `npm test`.
- Capture before/after screenshot locally to confirm visual restoration (manual QA noted in task log).
- Monitor Playwright baseline updates if shield appearance changes noticeably (document in follow-up if required).
