# DESIGN001 — Projectiles & Muzzle Flash Instancing

Date: 2025-10-04
Author: GitHub Copilot (automated design)

Confidence: 78% — high confidence in approach for projectiles & muzzle flashes; shields/ships are deferred.

## Goal

Replace per-entity projectile and muzzle-flash meshes with instanced renderers to reduce React node count and draw-calls, improving runtime performance at high projectile / turret-fire rates.

## Scope

- Implement `ProjectilesInstancedLayer` to render all projectile entities via one (or a few) `InstancedMesh` objects grouped by bulletType/material.

- Implement `MuzzleFlashInstancedManager` to batch-render turret muzzle flashes using an `InstancedMesh` with a pooled instance lifecycle.

- Keep visual parity with the current rendering (position, orientation, scale, tint, bloom registration).

- Do not attempt to instance shields or full ship GLTF models in this design; these are deferred (see Risks).

## Related files (to change/add)

- change: `src/components/layers/ProjectilesLayer.tsx` (mount instanced layer)

- remove/retire: `src/components/Projectile.tsx` (per-entity mesh usage replaced)

- add: `src/components/layers/ProjectilesInstancedLayer.tsx` (new implementation)

- add: `src/components/layers/MuzzleFlashInstancedLayer.tsx` (new impl or manager)

- update: `src/renderer/materialRegistry.tsx` (ensure materials used for bullets/muzzle flashes support instancing or provide fallback per-instance attributes)

- tests: `test/` — add projectile instancing unit & perf tests

## Requirements (EARS-style)

1. WHEN the simulation spawns N projectiles (N can be large), THE RENDERER SHALL display all projectiles visually equivalent to the previous per-entity approach, with no visual regressions in transform, scale, or tint. (Acceptance: visual smoke test for 10/100/1000 projectiles; image diffs and automated snapshot tolerance.)

2. WHEN multiple projectiles share the same material key (e.g., `bullet:laser`), THE SYSTEM SHALL render them using a single `InstancedMesh` (per-group) to minimize draw calls. (Acceptance: render test shows draw calls for bullets reduce to number of groups, not projectile count.)

3. WHEN turrets fire muzzle flashes, THE RENDERER SHALL batch and render all muzzle flashes using an instanced pool and maintain per-instance lifetime and scale/fade over time. (Acceptance: functional test verifying muzzle flash lifetimes and counts in the manager match turret events.)

4. WHEN projectiles or muzzle flashes exceed the configured capacity, THE RENDERER SHALL safely clamp render count to capacity and not crash; it shall log a single warning per frame about capacity saturation (rate-limited). (Acceptance: stress test saturating capacity logs expected warning and continues without exceptions.)

5. THE CHANGES SHALL include unit tests and a performance comparison demonstrating reduced draw calls and improved frame timing for high projectile counts. (Acceptance: test suite passes; perf benchmark shows measurable improvement in the stress fixture.)

## Architecture overview

- Data source: ECS archetype `projectiles` (read-only for renderer). Turret components will continue to enqueue muzzle flash events in entity state (or a renderer-only queue).

- Renderer: a new `ProjectilesInstancedLayer` component subscribes to `projectiles` archetype (via `useArchetypeEntities`) and the `MuzzleFlashInstancedLayer` subscribes to a renderer-visible queue or directly reads turret entities to collect muzzle flash events.

- For each bullet group (bulletType/material key) the layer creates:
  - one `InstancedMesh` with shared geometry and shared material instance.

  - an optional `InstancedBufferAttribute` for per-instance color/tint or custom attributes (float intensity, etc.).

- Update loop: a single `useFrame` iterates live projectile entities, computes instance transforms, writes instance matrices and attributes, sets `instancedMesh.count`, and marks `instanceMatrix.needsUpdate` and any attribute `needsUpdate = true`.

### Sequence diagram (simplified)

Game simulation -> (creates projectile entities) -> GameState

Renderer frame:

ProjectilesInstancedLayer.useFrame -> reads projectile archetype -> for each projectile, compute matrix, write into InstancedMesh at index i -> set mesh.count = activeCount -> mark needsUpdate

Muzzle flash sequence:

Turret system enqueues muzzle flash event OR turret entity has `muzzleFlashes[]` updated in simulation

MuzzleFlashInstancedLayer.useFrame -> collects events -> assigns indices from pool -> writes matrices and attributes -> updates instance lifetimes each frame -> deallocates indices when lifetime ends

## Data structures & interfaces

Example TypeScript interfaces (render-side)

- ProjectilesInstancedLayer props
  - `archetype: Archetype<GameEntity, ['projectile']>`

  - `capacityByType?: Record<string, number>` // override defaults

  - `maxTotal?: number`

- Internal structures
  - `groupMap: Map<string /* bulletType */, { meshRef: InstancedMesh, capacity: number, nextFreeIndex: number[], usedIndices: Map<number, number> }>`

- MuzzleFlash pool
  - `poolIndices: number[]` // free indices

  - `activeList: Array<{ index: number, ttl: number, entityId?: number }>`

Example public component signature

```ts
function ProjectilesInstancedLayer({
  archetype,
  capacityByType,
}: {
  archetype: Archetype<any, ['projectile']>;
  capacityByType?: Record<string, number>;
}): ReactElement;
```

## Implementation details

1. Geometry & materials
   - Use `getProjectileBaseRadius(key)` and existing `getMaterial(key)` to obtain geometry size and material.

   - For performance, create low-poly shared geometry per bulletType (sphere with low segments or custom low-poly cylinder depending on bullet style). Cache geometries in a module-level map.

2. Grouping strategy
   - Primary grouping by `projectile.projectile.bulletType` (string key). This maps to material registry keys (e.g. `bullet:laser`, `bullet:plasma`)

   - For groups without a registered material, use fallback simple `meshStandardMaterial` used in current `Projectile.tsx`.

3. Instance allocation
   - Use a fixed-size pool per group.

   - Map projectile.entity.id -> instance index (in usedIndices) so we can update an existing projectile's instance efficiently if it persists across frames.

   - On spawn: assign next free index from pool (pop from free list). If pool exhausted, record saturation event and skip visual creation for that extra projectile.

   - On removal: reclaim index back to free list.

4. Updating per-frame
   - In `useFrame` perform a single pass: gather `projectiles` archetype entities, for each entity find group, get/index assign instance index, compute model matrix (position, rotation, scale) using temporary Object3D/dummy, `setMatrixAt(index, dummy.matrix)`.

   - If per-instance color is needed use `mesh.setColorAt(index, color)` and then `mesh.instanceColor!.needsUpdate = true` (ensure `mesh.instanceColor` exists by calling `mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity*3), 3)` or via `setColorAt` helper depending on three version).

   - Set `mesh.count = activeCount` and `mesh.instanceMatrix.needsUpdate = true`.

5. Muzzle flash pooling
   - Muzzle flash events contain: worldPosition (Vector3), worldQuaternion (Quaternion), localScale/size, color/tint, ttl.

   - The MuzzleFlashInstancedLayer maintains a pool and active list. On new event, assign index and set the matrix and attribute (intensity), and track ttl per instance. Each frame decrement ttl and fade scale/opacity.

   - Use additive/blended material and register with BloomProvider similar to `useBloomRegistration`.

6. Determinism & ordering
   - Rendering is read-only w.r.t. GameState. The order of instances does not matter for game logic; keep mapping stable per projectile entity id so that instance indices are reused consistently while entity persists.

7. Tests
   - Unit test: verify `ProjectilesInstancedLayer` creates instances that match entity transforms for random sample entities.

   - Saturation test: spawn more projectiles than capacity and assert the renderer logs the expected saturation warning and does not throw.

   - Performance benchmark: script to create 1k/5k/10k projectiles and measure draw calls and frame time before and after.

## Validation plan

- Visual tests
  - Automated snapshot tests with multiple projectile counts (10, 100, 1000) and image diff thresholds.

- Functional tests
  - Unit tests for instance assignment/reclamation logic (stable mapping from entity.id to index).

- Performance tests
  - Benchmarks: measure draw calls and ms/frame in a headless or local profiling harness; expect draw calls scale with groups not entities and frame time to reduce vs baseline in heavy load.

## Migration strategy

### Full implementation plan (single phased delivery)

This design now targets a full implementation delivery rather than a staged PoC-first rollout. The renderer and simulation teams will implement grouped instanced projectiles and pooled muzzle flashes as a single, test-backed change. The objective is to deliver the complete instancing feature (projectiles + muzzle flashes) in one coordinated implementation so the codebase moves directly to the production-quality instanced renderer.

Key deliverables:

- Implement `ProjectilesInstancedLayer` with grouping by `bulletType` and per-group fixed-capacity pools. Each group creates a shared `InstancedMesh` with shared geometry and material and supports optional per-instance attributes (color, intensity) via `InstancedBufferAttribute`.

- Implement `MuzzleFlashInstancedLayer` (pooled manager) to collect turret muzzle flash events, allocate pooled instance indices, and update lifetime/alpha/scale per-frame. Register muzzle-flash instances with the bloom pipeline where required.

- Update `src/renderer/materialRegistry.tsx` to expose or create instance-friendly material variants and to provide fallbacks when per-instance attributes are not supported by a material.

- Provide geometry caching utilities for projectile base geometries keyed by `bulletType` to reuse low-poly primitives across groups.

- Implement a robust fixed-size pooling strategy and deterministic mapping from entityId -> instanceIndex for projectiles and eventId -> instanceIndex for muzzle flashes. Pools should reclaim indices on entity removal or event expiry.

- Implement capacity saturation behavior: clamp rendered instance counts to capacity, emit a single rate-limited warning per-frame (configurable rate), and ensure no exceptions or crashes occur when capacity is exceeded.

- Integrate tests and performance benchmarks into the implementation commit (unit tests + perf harness + visual snapshot tests). Do not merge without required test coverage and perf evidence.

Delivery sequence (developer tasks within this single implementation):

1. Projectiles grouping & instanced layer (core)
   - Group by `bulletType` and create an `InstancedMesh` per group.
   - Implement pool allocation, stable mapping, per-frame matrix writes, instanceColor support when available, and frustum-aware `mesh.count` trimming.
   - Add unit tests for allocation, reclamation, and mapping stability.

2. Muzzle flash pooled manager (core)
   - Implement pooled instancing for muzzle flashes with TTL-driven deallocation and per-frame fading/scaling.
   - Ensure bloom registration and additive blending behave identically to prior per-entity muzzle flashes.
   - Add unit tests verifying lifetime, pool reuse, and saturation safety.

3. Materials & geometry tooling
   - Extend `materialRegistry` to provide instance-compatible materials or shader fallbacks, and provide utilities to create `instanceColor` attributes where supported.
   - Create a geometry cache utility for reusable low-poly primitives used by projectile groups.
   - Add unit tests / snapshot tests for material fallback correctness.

4. Tests, performance harness & CI gating
   - Add unit tests covering mapping, pooling, and saturation edge cases.
   - Add image-snapshot smoke tests for representative scenes (10/100/1000 projectiles and concurrent muzzle flashes).
   - Add a perf harness script for 1k/5k/10k projectiles to capture draw calls and frame timings and compare with a recorded baseline.
   - Gate merging on unit test pass and perf evidence showing draw-call reduction and frame-time improvement for high projectile counts.

5. Replacement & cleanup
   - Remove per-entity `Projectile.tsx` from the render tree after the instanced renderer is validated.
   - Leave the simulation-side projectile entities untouched (render-only change). Update any renderer wiring points and document the change.
   - Add decision record describing the trade-offs and confirm no visual regressions remain.

Operational constraints:

- Keep the change backward-compatible at simulation boundaries (no simulation API changes). The renderer remains read-only w.r.t. GameState.

- Maintain deterministic rendering mapping (entityId -> instance index) to minimize visual popping during entity lifetime.

- Limit per-frame allocations: allocate buffers at startup and reuse them; avoid per-frame garbage.

- Ensure materials that do not support `instanceColor` are handled via grouped materials or per-instance uniforms baked into attribute textures when unavoidable (documented fallback path).

Rollback strategy:

- If the instanced implementation introduces a critical regression in visuals or performance, revert the renderer mounting to the previous `ProjectilesLayer` and restore `Projectile.tsx` rendering as a hotfix while fixing regressions on a branch.

## Next actions & tasks

Create the following tasks to track the single-phase implementation. Assign task owners and expected deliverables; each task file should contain clear EARS requirements and unit/perf acceptance criteria.

- TASK001 — Implement `ProjectilesInstancedLayer` (grouped instancing, per-group pools, instanceColor where available). (High priority)
- TASK002 — Implement `MuzzleFlashInstancedLayer` (pooled manager, bloom integration, TTL fade/scale). (High priority)
- TASK003 — Update `materialRegistry` and geometry cache utilities to support instanced rendering and material fallbacks. (Medium priority)
- TASK004 — Add unit tests, image-snapshot smoke tests, and perf harness; capture baseline comparisons and gate CI. (High priority)
- TASK005 — Remove legacy `Projectile.tsx` from render tree, finalize cleanup, and update documentation & decison records. (Low priority after validation)

---

Decision records & references

- Explosions & ParticleTrails existing code is the canonical pattern to follow (`src/components/explosions/instancedManager.ts`, `src/components/ParticleTrails.tsx`).

- Drei `Instances`/`Instance` declarative API is consciously NOT chosen for projectiles due to React node churn for high-frequency dynamic instances; choose manual `InstancedMesh` updates for performance.

If you want, I can now create the PoC task (`TASK001`) and implement the single InstancedMesh PoC in `src/components/layers/ProjectilesInstancedLayer.tsx` and its tests. Which should I do next: create the PoC task file in `memory/tasks/` or start coding the PoC right away?
