# [TASK001] - Implement grouped ProjectilesInstancedLayer & MuzzleFlashInstancedLayer (Full Implementation)

**Status:** In Progress  
**Added:** 2025-10-04  
**Updated:** 2025-10-04

## Original Request

Implement the full instanced rendering design from `memory/designs/DESIGN001-projectiles-muzzle-instancing.md`: grouped projectile instancing by `bulletType` and a pooled muzzle-flash instanced manager. This is a full implementation (not a staged PoC) delivering production-ready grouped instancing, material/geometry tooling, tests, perf harnesses, and CI gating.

## Scope

- Implement `ProjectilesInstancedLayer` that renders projectiles grouped by `bulletType` using one `InstancedMesh` per group with per-group fixed-capacity pools and optional per-instance attributes.
- Implement `MuzzleFlashInstancedLayer` to pool muzzle flashes, manage TTL-driven fades and scale, and integrate with bloom where applicable.
- Update `src/renderer/materialRegistry.tsx` and add geometry cache utilities to support instance-friendly materials and shared low-poly primitives.
- Add comprehensive unit, snapshot, and perf tests; provide a perf harness and gate merging on test/perf results.
- Remove legacy per-entity `Projectile.tsx` rendering after validation and cleanup.

## Requirements (EARS-style)

1. WHEN the simulation spawns N projectile entities, THE RENDERER SHALL display all projectiles visually equivalent to the previous per-entity approach for the rendered subset, with no regressions in transform, scale, tint, and bloom registration. (Acceptance: image-snapshot smoke tests for 10/100/1000 projectiles; toleranced diffs.)

2. WHEN multiple projectiles share the same material key, THE SYSTEM SHALL render them using a single `InstancedMesh` per-group to minimize draw calls. (Acceptance: perf harness shows draw calls scale with groups, not entity count.)

3. WHEN turrets fire muzzle flashes, THE RENDERER SHALL batch muzzle flashes using a pooled `InstancedMesh`, maintaining per-instance lifetime and fade/scale behavior identical to prior visual output. (Acceptance: unit tests verify TTL sequencing and bloom registration behavior.)

4. WHEN instance counts exceed configured capacity (per-group and total), THE RENDERER SHALL clamp rendered instances to capacity, emit a single rate-limited warning per frame, and not throw exceptions. (Acceptance: saturation stress tests and logs.)

5. THE IMPLEMENTATION SHALL include unit tests and performance comparisons demonstrating reduced draw calls and improved frame timings for high projectile counts. (Acceptance: tests and perf harness results added to task progress and CI gating enabled.)

## Implementation Plan & Subtasks

1. Projectiles instanced layer (core)
   - Create `src/components/layers/ProjectilesInstancedLayer.tsx` (grouping by `bulletType`, per-group pools, instance allocation map `entityId -> index`, per-frame matrix writes, instanceColor where available).
   - Ensure frustum-aware trimming using `mesh.count` and avoid per-frame allocations.
   - Add unit tests for allocation, reclamation, mapping stability, and saturation behavior.

2. Muzzle flash pooled manager (core)
   - Create `src/components/layers/MuzzleFlashInstancedLayer.tsx` with pooled indices, TTL-driven lifecycle, per-frame fade/scale, and bloom integration.
   - Add unit tests for TTL lifecycle, pool reuse, and saturation.

3. Material & geometry support
   - Update `src/renderer/materialRegistry.tsx` to expose instance-friendly materials or shader fallback paths.
   - Implement a geometry cache utility `src/utils/projectileGeometries.ts` keyed by `bulletType`.
   - Add tests to validate fallback behaviors and instanceColor attribute wiring.

4. Tests, performance harness & CI
   - Add Vitest unit tests and Playwright/visual-snapshot smoke tests for representative scenes.
   - Implement a perf harness (`scripts/bench/projectile-stress.mjs`) to spawn 1k/5k/10k projectiles and capture renderer draw-call counts and frame times.
   - Add CI gating (test + perf check) and document acceptance thresholds in the task file.

5. Cleanup & removal
   - After validation, remove `src/components/Projectile.tsx` from render tree and cleanup any unused assets.
   - Update docs and add a decision record summarizing trade-offs and fallbacks chosen.

## Tests & Acceptance Criteria

- Unit tests covering pooling, mapping stability, reclamation, TTL and saturation behavior pass.
- Image-snapshot smoke tests for 10/100/1000 projectiles pass within configured tolerance.
- Perf harness shows draw-call reduction and frame-time improvement for stress fixtures (1k+ projectiles). Recorded results are attached to task progress.
- No unhandled exceptions when capacity is exceeded and a single rate-limited warning is emitted per-frame.

## Progress Log

### 2025-10-04

- Converted the TASK001 PoC task file into the full implementation TASK001 and updated the memory bank to target immediate grouped instancing + muzzle flash pooling. (This change)
- TASK001 is now In Progress and implementation work has been started (see todo list). 

## Subtasks Table

| ID  | Description                                   | Status        | Updated |
| --- | --------------------------------------------- | ------------- | ------- |
| 1.1 | Implement `ProjectilesInstancedLayer`         | In Progress   | 2025-10-04 |
| 1.2 | Implement `MuzzleFlashInstancedLayer`         | Not Started   | 2025-10-04 |
| 1.3 | Update `materialRegistry` & geometry cache    | Not Started   | 2025-10-04 |
| 1.4 | Add unit tests & snapshot smoke tests         | Not Started   | 2025-10-04 |
| 1.5 | Add perf harness and collect baseline         | Not Started   | 2025-10-04 |
| 1.6 | Remove legacy `Projectile.tsx` after validation| Not Started   | 2025-10-04 |

## Next Steps

- Implement `ProjectilesInstancedLayer` (set as in-progress) and create the supporting modules and tests.
- Attach perf harness results to this task and update the progress log as tests and benchmarks complete.

---

*This task implements the full design from `DESIGN001` as requested. Subsequent TASK002+ files may still be used to split follow-up work (e.g., deeper material shader work) if needed.*