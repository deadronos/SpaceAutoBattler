# TASK016 - Instanced Layer Refactor

**Status:** In Progress
**Added:** 2025-10-26

## Original Request

Unify repeated instanced-layer logic into a shared abstraction and migrate layers (projectiles, muzzle flash, thrusters, LOD, explosions) to use it.

## Thought Process

Many instanced layers reimplement the same three concerns:
- InstancedMesh attribute lifecycle (DynamicDrawUsage, instanceColor allocation)
- Allocation lifecycle (InstanceAllocator begin/allocate/release/endFrame)
- Hiding released indices with a HIDDEN_MATRIX and saturation warnings

Centralizing this will reduce duplication and bugs and make future perf work simpler.

## Implementation Plan

1. Create `src/components/layers/instancedLayer.ts` implementing `InstancedLayerManager` and export `HIDDEN_MATRIX`.
2. Migrate `ProjectilesInstancedLayer.tsx` to use the new manager as a proof-of-concept.
3. Add unit tests for the manager (allocator semantics + hide semantics).
4. Migrate `MuzzleFlashInstancedLayer.tsx` and `ThrusterInstancedManager.tsx`.
5. Migrate `ShipLODManager.tsx` and `ExplosionRendererCore.tsx`.
6. Remove duplicated `HIDDEN_MATRIX` constants and cleanup imports.

## Progress Tracking

- [x] Step 1: Implemented `instancedLayer.ts` (InstancedLayerManager)
- [x] Step 2: Migrated `ProjectilesInstancedLayer.tsx` to use manager
- [ ] Step 3: Add unit tests for manager
- [ ] Step 4: Migrate muzzle flash + thrusters
- [ ] Step 5: Migrate LOD and explosions
- [ ] Step 6: Cleanup

## Notes

- The initial migration keeps `ProjectileGroupMesh` rendering the same `instancedMesh` element and defers attribute initialization to `manager.initMesh()`.
- Follow-up: consolidate the `HIDDEN_MATRIX` constant to the new module and remove duplicates.

*** End Task
