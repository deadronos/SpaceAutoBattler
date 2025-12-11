# INSTANCED LAYER DESIGN

Status: Draft

## Overview

This design specifies a shared abstraction for "instanced rendering layers" used throughout the project. Multiple components (projectiles, muzzle flashes, thrusters, LOD managers, explosions manager) implement the same lifecycle and attribute management for Three.js InstancedMesh objects, causing duplication and opportunities for bugs.

## Goals

- Centralize instanced-mesh boilerplate (DynamicDrawUsage, instanceColor attribute allocation, initial color fill, disposal).
- Provide a deterministic InstanceAllocator-backed lifecycle: beginFrame -> allocate/release -> endFrame.
- Encapsulate hide/release behavior using a shared HIDDEN_MATRIX constant.
- Expose a small, ergonomic API for per-frame updates that minimizes direct mesh manipulation.
- Integrate saturation detection and existing saturation warning utilities.

## Non-goals

- Replace higher-level grouping logic (group-by-projectile-type) — those remain in the calling components.
- Implement rendering-specific optimizations beyond attribute lifecycle and usage flags.

## API (proposal)

Exported artifacts:

- `HIDDEN_MATRIX: Matrix4` — constant for hiding unused instances.

- `InstancedLayerManager<K>` — class with:
  - constructor(meshRef, { capacity, supportsInstanceColor, baseColor })
  - initMesh(): void
  - beginFrame(): void
  - allocate(key: K): number | null
  - release(key: K): number | null
  - setMatrixAt(index, matrix): void
  - setColorAt(index, color): void
  - endFrame(): { released: number[]; saturated: boolean; count: number }
  - dispose(): void

- `createInstancedLayerManager(meshRef, options)` — convenience factory that calls `initMesh()` if mesh is present.

## Usage patterns

- Component creates a per-group `meshRef` and `materialInfo` via existing material registry.
- Call `createInstancedLayerManager(meshRef, { capacity, supportsInstanceColor, baseColor })` and store manager in group state.
- In component `useFrame`:
  - call `manager.beginFrame()`
  - for each entity: `const idx = manager.allocate(entity.id)`; if idx != null -> `manager.setMatrixAt(idx, matrix)` and optionally `manager.setColorAt(idx, color)`
  - after loop call `const result = manager.endFrame()` and use `result.saturated` to call the saturation warning helper.

## Rationale

Centralizing this logic reduces bugs (missing `needsUpdate` calls, inconsistent `instanceColor` creation/disposal), and makes future global perf optimizations straightforward.

## Testing

- Unit test for `InstanceAllocator` already exists; add tests for `InstancedLayerManager` that verify:
  - initial mesh attribute setup (simulated/partial mesh stub)
  - allocation/release/endFrame produces expected `released` and `maxIndex` semantics
  - released indices are hidden (manager calls `setMatrixAt` with `HIDDEN_MATRIX`)

## Migration plan

1. Add `src/components/layers/instancedLayer.ts` with `InstancedLayerManager`.
2. Migrate `ProjectilesInstancedLayer` to use manager (proof-of-concept).
3. Migrate `MuzzleFlashInstancedLayer` and `ThrusterInstancedManager` iteratively.
4. Migrate `ShipLODManager` and `ExplosionRendererCore`.
5. Remove duplicated constants and cleanup.

## Compatibility

Backward-compatible at runtime: manager requires a meshRef; components still render same `instancedMesh` element; we keep the same `args` ordering and material usage.

## Security & Safety

No input from untrusted sources; stable deterministic behavior preserved.

\*\*\* End of design
