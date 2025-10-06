# [TASK246] - Thruster trail GPU buffer migration

**Status:** In Progress
**Added:** 2025-10-06
**Updated:** 2025-10-06

## Original Request

Move thruster trails to GPU-managed buffers. The current particle trail system preloads all GLTFs, clones vectors for every spawn, and iterates a large particle pool on the CPU each frame, which will bottleneck large fleet scenarios. Replacing the pool with instanced buffer attributes (e.g., InstancedBufferGeometry with shader-driven fading) or a compute/transform feedback approach would shift the workload to the GPU and cut allocations, improving scalability.

## Thought Process

- CPU-based pool writes every particle transform each frame and clones vectors, so scaling to thousands of trails is wasteful.
- GPU instancing only needs spawn metadata; shader time uniform can animate positions and fading, removing CPU hot loop.
- Deterministic jitter remains important for reproducibility; leverage `SeededRng` and spawn remainder accumulators for smooth emission.
- Tests must confirm geometry/material composition and ensure shader time uniform updates without CPU iteration.

## Implementation Plan

- Author EARS requirements (done) and DESIGN003 detailing GPU resource factory, ring buffer, shader, and testing strategy.
- Refactor `ParticleTrails` to consume GPU resources, expose optional resource injection for tests, and implement deterministic spawn logic.
- Add Vitest coverage validating resource shape, spawn writes, and uniform updates; mock `useFrame`/`useGLTF` similarly to StarDisk tests.
- Run `npx tsc --noEmit` and `npm test`, document results, and update memory bank progress plus reflections.

## Progress Tracking

**Overall Status:** In Progress - 80%

### Subtasks

| ID  | Description                                                      | Status     | Updated     | Notes |
| --- | ---------------------------------------------------------------- | ---------- | ----------- | ----- |
| 1.1 | Publish requirements and DESIGN003, register TASK246             | Completed  | 2025-10-06  | Requirements + design added to memory bank |
| 1.2 | Implement GPU resource factory and refactor `ParticleTrails`     | Completed  | 2025-10-06  | GPU instancing, shader, and deterministic spawning implemented |
| 1.3 | Add Vitest coverage for GPU trails and deterministic spawning    | Completed  | 2025-10-06  | Added `particle-trails-gpu.spec.tsx` with spawn/uniform assertions |
| 1.4 | Run validation, document reflections, and prep PR summary        | In Progress| 2025-10-06  | Type-check + tests running; documentation/summary pending |

## Progress Log

### 2025-10-06

- Logged TASK246, captured requirements, and produced DESIGN003 outlining GPU instancing approach, shader logic, and testing plan.
- Replaced CPU particle pool with GPU instanced buffers, deterministic spawner, and shader-driven fading in `ParticleTrails.tsx`; exported resource factory for tests.
- Added `particle-trails-gpu.spec.tsx` and updated `thruster-glow.spec.ts` to assert GPU pipeline integration; ran `npx tsc --noEmit` and full `npm test` suite.
