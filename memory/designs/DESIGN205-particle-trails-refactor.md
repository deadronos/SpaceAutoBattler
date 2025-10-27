# DESIGN205 — Refactor: Extract GPU particle resources and anchor logic from `src/components/ParticleTrails.tsx`

Status: Draft
Date: 2025-10-27
Related Tasks: TASK414

## Summary

`src/components/ParticleTrails.tsx` mixes three main concerns: resource construction (GPU buffers/materials), hull GLTF anchor extraction, and the per-frame spawn/update loop. Extracting resource construction and anchor computation into separate modules will make the component easier to test, reduce per-component allocation, and allow resource reuse (shared GPU buffers) across test harnesses and potential alternative emitters.

## Goals

- Isolate GPU resource creation (geometry, instanced attributes, material) into a factory `createParticleTrailResources` under `src/renderer/particles/`.
- Provide a top-level hook `useThrusterAnchors(hull)` (or `useThrusterAnchorsForShip`) encapsulating `useGLTF` usage and local->world anchor computations.
- Keep `ParticleTrails` focused on the lifecycle and frame-driven spawn semantics; allow injection of resources for tests.

## Proposed Modules

- `src/renderer/particles/trailResources.ts`
  - Exports:
    - `createParticleTrailResources(maxParticles, config): ParticleTrailResources`
    - `disposeParticleTrailResources(resources)`
  - Responsibilities:
    - Allocate `InstancedBufferGeometry` with attributes: spawnPosition, velocity, spawnTime, lifetime, scale.
    - Create the trail `ShaderMaterial` (factory function) receiving config.
    - Provide arrays for direct CPU writes and ensure attributes are configured with DynamicDrawUsage.

- `src/renderer/particles/useThrusterAnchors.ts`
  - Exports:
    - `useThrusterAnchors(hull: ShipHull): Vector3[]` (or a map of anchors by hull)
  - Responsibilities:
    - Use `useGLTF` to load hull models at hook top-level.
    - Compute local anchor positions using bounding boxes or artist markers.
    - Provide a memoized converter to world-space given a ship transform (caller responsibility) or return locals for the component to transform.

- `src/components/ParticleTrails.tsx` (adapted)
  - Responsibilities after refactor:
    - Accept optional `resources` parameter (for test injection).
    - Use `useThrusterAnchors` to get local anchors and transform them per-ship in the frame loop.
    - Run the spawn logic and mark buffer attributes `needsUpdate` when modified.
    - Ensure cleanup disposes resources the component owns.

## Migration Plan

1. Implement `trailResources.ts` factory with the same attribute layout and material. Add unit tests to confirm array lengths and attribute item sizes.
2. Implement `useThrusterAnchors.ts` hook that wraps `useGLTF` and the existing anchor heuristics. Add unit tests with mocked GLTF scenes to validate anchor counts and positions.
3. Update `ParticleTrails.tsx` to import factories/hooks and accept injected resources. Keep behavioral parity.
4. Run `npx tsc --noEmit` and `npm test`. Fix issues.
5. Optionally implement a singleton/shared resource registry if integration shows multiple allocations are expensive.

## Testing & Validation

- Unit tests:
  - `test/renderer/particles/trailResources.spec.ts` — assert created attributes arrays length equals `maxParticles * componentSize`, attributes usage is `DynamicDrawUsage`, material uniforms include `uTime`, and additiveBlending flag toggles.
  - `test/components/useThrusterAnchors.spec.ts` — provide lightweight mocked GLTF scenes and assert anchor counts and positions.
- Integration test:
  - Update existing `ParticleTrails` tests to inject `createParticleTrailResources(...)` and verify spawn attributes are updated after a frame.

## Risks & Mitigations

- React hook rules: `useGLTF` must remain called at the top-level of the hook to avoid invalid hook calls — ensure `useThrusterAnchors` is a proper hook.
- Resource lifecycle: do not leak GPU resources; ensure `dispose()` is called for resources the component owns. Consider explicit `dispose` helper exported from the factory.
- RNG determinism: maintain `SeededRng` initialisation location (component-level or injected) to avoid changing deterministic test behavior.

## Deliverables

- `src/renderer/particles/trailResources.ts`
- `src/renderer/particles/useThrusterAnchors.ts`
- Updated `src/components/ParticleTrails.tsx` that uses the factories/hooks and accepts injected resources for tests.

---
