# TASK250 — Beam Shader Compile Fix & Shield Visibility Guard

**Status:** Draft  
**Author:** GitHub Copilot  
**Date:** 2025-10-14  
**Related Requirements:** See `memory/requirements.md` — *2025-10-14 — Beam Shader Instancing Compatibility (TASK250)*

---

## Summary

Recent beam shader work introduced a custom `ShaderMaterial` that still references Three.js include chunks (`instanceColor_pars_vertex`, `instanceColor_vertex`) unavailable in the locked `three@0.180.0` build, causing compilation failures when postprocessing triggers eager shader compilation. Separately, `ShieldBubble` logs false "should be visible" warnings because render-time visibility guards read a just-stale React state value before the latest fraction update propagates.

This design removes the dependency on missing shader chunks by manually declaring the instanced color attribute/varying guarded by `USE_INSTANCING_COLOR`, preserves the per-instance brightness attribute, and keeps a white fallback when instancing colors are absent. For shields, render-time decisions will rely on the already maintained `shieldFractionRef` so the newest fraction governs visibility and validation, eliminating spurious warnings while keeping the existing threshold semantics.

## Current Behaviour

- `src/renderer/materials/beamLaserShader.tsx` includes `#include <instanceColor_pars_vertex>` and `#include <instanceColor_vertex>`. Three r0.180 does not register those chunks, so compilation fails with `Can not resolve #include <instanceColor_pars_vertex>` during postprocessing initialisation.
- `ShieldBubble` stores the latest shield fraction in both state and a ref. `useFrame` updates the ref first and then calls `setShieldFraction`. During the render phase before React processes the state update, guards rely on the stale state value (`computedFraction=0.008`), passing it into `validateShieldVisibility` which compares against the current shield ratio (0.017) and logs a false warning.

## Proposed Changes

### Beam Shader

- Inline instancing color support:
  - Declare `attribute vec3 instanceColor;` inside the vertex shader guarded by `#ifdef USE_INSTANCING_COLOR`.
  - Remove the `#include <instanceColor_pars_vertex>` and `#include <instanceColor_vertex>` directives.
  - Preserve the existing fallback that assigns `vec3(1.0)` when instancing colors are unavailable.
- Leave uniforms, additive blending, and per-instance brightness logic unchanged to keep compatibility with current tests and configs.

### Shield Visibility

- Treat `shieldFractionRef.current` as the authoritative render-time fraction.
  - Compute opacity and visibility decisions from the ref (optionally combined with the state value via `Math.max` to cover edge cases).
  - `validateShieldVisibility` invocations should receive the freshest fraction (from the ref) so expected vs computed comparisons stay in sync.
- Maintain state updates solely to trigger re-renders; no new side effects or API changes.

## Architecture & Data Flow

- **Shader path:** `ProjectilesInstancedLayer` continues to set `mesh.instanceColor` (enabling `USE_INSTANCING_COLOR`) and the `instanceBeamBrightness` attribute. The material factory now ships inline attribute declarations, so WebGL program compilation succeeds under both postprocessing and baseline renderer.
- **Shield path:** Simulation writes `entity.ship.shield` and `maxShield`. `useFrame` computes a clamped fraction, updates refs, and enqueues a state update. The render function reads the ref immediately, avoiding the transient stale state.

## Interfaces & Data Models

- No new public APIs. `createBeamLaserShaderMaterial` still returns a `ShaderMaterial` with the same uniforms and user data.
- `ShieldBubble` keeps the same props contract (`entity`, optional `radius`, optional `hullMaterialsRef`).
- `validateShieldVisibility` retains its signature but will operate on the fresh fraction provided by the caller.

## Error Handling Matrix

| Scenario | Expected Behaviour | Response |
| --- | --- | --- |
| Instanced mesh provides colors, shader compiles | Program links successfully, beams tint correctly | Continue rendering; no errors |
| Instanced mesh lacks colors | Shader defaults to `vec3(1.0)` and beams remain visible | Render with white color; no warnings |
| Shader allocation fails for unrelated reasons (GPU/GL error) | Existing try/catch in material registry handles failure | Surface existing warning and fallback material |
| Shield fraction genuinely below threshold | Bubble hidden; validation logs nothing | No change |
| Shield fraction at/above threshold | Bubble visible; validation silent | We pass ref fraction to guard |
| Invalid shield or maxShield input | `computeShieldFraction` already warns and returns zero | No new handling |

## Testing Strategy

1. **Unit Tests (Vitest):**
   - Extend `test/vitest/renderer-beam-shader.spec.ts` to assert the vertex shader string includes the manual attribute declaration and no longer contains the removed `#include` directives. Also verify the fallback branch (`vec3(1.0)`) remains present.
   - Augment `test/components/ship/shieldUtils.spec.ts` (or add a new spec) covering the scenario where the latest fraction exceeds the threshold while a stale prior fraction does not, ensuring `validateShieldVisibility` returns `null`.
2. **Regression:** Existing beam instancing and shield tests continue to run; run `npm run typecheck` and the relevant Vitest suites.
3. **Manual:** Smoke run the battle scene with postprocessing enabled to confirm no shader compilation errors and shield bubbles appear without warnings.

## Implementation Plan Alignment

- Steps 1–7 in the task implementation plan map directly to requirements capture, design documentation (this file), shader & shield code changes, testing, validation, and documentation updates.

## Open Questions / Follow-ups

- None blocking; if shield visibility still shows intermittent flicker, consider debouncing the warning logging entirely in a follow-up.
