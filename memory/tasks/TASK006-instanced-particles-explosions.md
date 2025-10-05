# [TASK006] - Instanced Particles & Explosions

**Status:** Not Started  
**Added:** 2025-10-05

## Original Request

Reduce draw calls and CPU overhead caused by large numbers of particle and explosion effects by implementing an instanced particle/explosion system that consolidates similar effects into shared InstancedMesh groups or GPU-driven particle buffers.

## Scope

- Implement an `ExplosionsInstancedManager` that consolidates explosion sprite/mesh instances by material/type.
- Support pooling and per-instance attributes (color, intensity, life, size) via `InstancedBufferAttribute`.
- Provide smoke-test scenes and a perf harness entry to compare before/after draw calls and frame time.

## Requirements (EARS-style)

1. WHEN many explosions/particle effects are active, THE RENDERER SHALL render them via instanced groups to minimize draw calls and avoid per-frame allocation overhead. (Acceptance: perf harness shows draw-call reduction and stable frame times.)

2. WHEN particles/explosions have per-instance color/intensity/lifetime, THE SYSTEM SHALL provide per-instance attributes to animate these properties on the GPU or via efficient CPU uploads. (Acceptance: unit tests confirm attribute updates and visual smoke checks.)

3. WHEN the particle pool is exhausted, THE SYSTEM SHALL clamp spawned visual effects and log a rate-limited warning without throwing exceptions. (Acceptance: saturation test no crash + single warning per frame.)

## Implementation Plan

- Create `src/components/explosions/ExplosionsInstancedManager.tsx` to own instanced groups keyed by effect type.
- Add a geometry/material mapping and a small geometry cache for repeated primitives.
- Allocate per-group fixed-size pools, maintain free lists and active lists with TTLs.
- Provide an API to spawn effects from simulation/events with minimal allocations.
- Add unit tests for pool allocation/reclamation, attribute updates, and saturation behavior.
- Add a perf harness entry (`scripts/bench/explosions-stress.mjs`) and visual snapshot scenarios.

## Tests & Acceptance

- Unit tests for allocation, reclamation, and attribute update correctness.
- Visual snapshots for heavy explosion scenes (10/100/1000 concurrent effects) within tolerance.
- Perf harness demonstrates draw-call reduction and improved frame timings.

---
