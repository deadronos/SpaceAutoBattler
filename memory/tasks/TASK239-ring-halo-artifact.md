
# TASK239 - Ring/Halo Wedge Artifact (Postprocessing OFF)

**Status:** In Progress  
**Added:** 2025-10-02  
**Updated:** 2025-10-02

## Original Request

User reported wedge-shaped dark artifacts visible in the battlefield screenshot when Postprocessing was OFF. The goal is to fix the visual artifacts without relying on postprocessing; conservative shader and render-order fixes are preferred.

## Thought Process

- The artifact appears with Postprocessing OFF, so bloom compositing likely isn't the root cause. Shader alpha masks, `discard`, depth writes, or render ordering are prime suspects.
- Conservative, reversible changes should be applied first: widen smoothstep ranges, avoid `discard`, add a small alpha floor, and ensure translucent elements do not write to the depth buffer.
- Use existing debug helpers (`?copilot_debug=1`) to tune values interactively during validation.

## Implementation Plan

1. Reproduce & capture baseline

   - Start dev server with the battlefield scene and open URL with `?copilot_debug=1`.
   - Capture screenshot and record `mesh.userData` for star, halo, rings, and the affected planet(s). Log `renderOrder`, `layers.mask`, `material.transparent`, `material.colorWrite`, `material.depthWrite`, `material.depthTest`.

2. Isolate cause

   - Replace ring shader temporarily with a simple soft radial gradient material to test whether the shader pattern is the cause.
   - Toggle `depthWrite`/`depthTest` on ring/halo materials.
   - Disable ring texture/pattern to check for UV seam contributions.

3. Conservative shader fixes

   - Edit `src/components/environment/PlanetRings.tsx` and ring fragment shader:

     - Remove `discard` usage.
     - Add `alpha = max(alpha, 0.02);` (expose via debug helper if needed).
     - Widen `smoothstep` transition ranges slightly.
     - Premultiply RGB by alpha before writing the fragment color.

4. Render-order & depth adjustments

   - Ensure star core renders opaque (`depthWrite=true`) and early in the draw order.
   - Ensure halo/rings use `depthWrite=false` and correct `renderOrder` values per `src/renderer/sceneLayerOrder.ts`.

5. Verify and test

   - Run `npx tsc --noEmit` and `npm test` (focus on `star-disk` tests).
   - Capture before/after screenshots and document debug helper values.

6. Cross-GPU validation

   - Manually verify on Intel, NVIDIA, and AMD GPUs across Chrome/Edge/Firefox and document any anomalies.

7. Fallback (if unresolved)

   - Implement PoC for bloom-only compositing (separate bloom render target + composite pass) to isolate bloom from main color writes.

## Subtasks

- [ ] Reproduce and log baseline (screenshots + mesh/material state)
- [ ] Isolate cause via shader/material toggles
- [ ] Implement conservative shader changes and expose small debug toggles
- [ ] Tune renderOrder/depth flags and verify
- [ ] Add visual QA doc and update tests
- [ ] Cross-GPU validation

## Progress Log

### 2025-10-02

- Task created and added to `memory/tasks` index. Initial plan documented.

---

## Files referenced

- `src/components/environment/PlanetRings.tsx`
- `src/renderer/shaders/*`
- `src/components/environment/StarDiskMesh.tsx`
- `src/renderer/sceneLayerOrder.ts`
- `src/renderer/BloomProvider.tsx` (for verification)


Created by automation
