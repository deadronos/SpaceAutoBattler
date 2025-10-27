# TASK414 — Extract particle trail resources & anchors from `src/components/ParticleTrails.tsx`

**Status:** Completed
**Added:** 2025-10-27
**Updated:** 2025-10-27

## Objective

Refactor `src/components/ParticleTrails.tsx` to extract GPU resource allocation and hull anchor computation into reusable modules under `src/renderer/particles/`. Keep component behavior identical while making it easier to test and reuse the resource factory in other emitters or tests.

## Implementation Plan

1. Implement `src/renderer/particles/trailResources.ts`:
   - Export `createParticleTrailResources(maxParticles, config)` returning `ParticleTrailResources` (geometry, material, arrays, attributes) with same layout as the current component.
   - Export `disposeParticleTrailResources(resources)` to centralize cleanup.
   - Add unit tests asserting array lengths, attribute itemSize, and usage flags (`DynamicDrawUsage`).

2. Implement `src/renderer/particles/useThrusterAnchors.ts`:
   - Proper React hook that calls `useGLTF` for hull models and returns local anchor sets for each hull type.
   - Provide a utility `computeAnchorsWorldForShip(locals, shipTransform)` or allow the consumer to perform transformation.
   - Add unit tests with mocked GLTF to validate anchor heuristics.

3. Update `src/components/ParticleTrails.tsx`:
   - Import `createParticleTrailResources` and `useThrusterAnchors`.
   - Keep the existing `resources` injection parameter for tests; when not provided, create and dispose owned resources.
   - Ensure `useFrame` continues to update `uTime` and spawn attributes identically and marks `needsUpdate` on attributes.

4. Validation & Cleanup:
   - Run `npx tsc --noEmit`, `npm test`, and address failures.
   - Consider adding a shared registry if multiple ParticleTrails instances appear in the scene.

## Subtasks

- [x] Create `src/renderer/particles/trailResources.ts` with factory + dispose helpers
- [x] Create `src/renderer/particles/useThrusterAnchors.ts` hook that returns locals
- [x] Update `src/components/ParticleTrails.tsx` to use factories/hooks and accept injected resources
- [x] Add unit and integration tests and run full test suite
- [x] Open PR and link to `memory/designs/DESIGN205-particle-trails-refactor.md`

## Notes

- Keep RNG seed deterministic: the component currently initialises `SeededRng` with `TRAI` seed constant; keep that behaviour or accept an injected RNG for tests.
- `useGLTF` must remain top-level inside a hook to satisfy React rules.
- Ensure GPU resources are disposed when `ParticleTrails` owns them to avoid memory leaks.

---
