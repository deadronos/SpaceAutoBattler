# TASK111 — Projectile instancing performance

**Status:** In Progress  
**Added:** 2025-11-17  
**Updated:** 2025-11-17

## Original Request
Create a `/memory/tasks` plan for DESIGN059 (projectile instancing performance) so the design can be executed and validated.

## Thought Process
- DESIGN059 targets the render hot path in `ProjectilesInstancedLayer` where per-frame key/category resolution, per-frame allocator lookup, and full transform recomputation hurt performance.
- Capturing this as a task keeps the spec-driven workflow traceable and gives us a concrete implementation plus validation plan tied to the design.
- Work likely spans projectile spawn metadata, instanced layer allocation strategy, and render-update cadence aligned to simulation ticks.

## Implementation Plan
- Precompute projectile render metadata at spawn: set `renderKey` and `renderInfo` once and have `ProjectilesInstancedLayer` consume those fields without per-frame `resolveProjectileInfo` calls.
- Reduce allocation overhead: configure `InstancedLayerManager` (or equivalent) to avoid per-frame map lookups—either via sequential/ring allocator or cached archetype-index → instance-index mapping that only changes on spawn/despawn.
- Throttle transform updates: align instance matrix writes to simulation tick changes; allow per-frame updates only for visuals that depend on camera/time (e.g., beams) while skipping unchanged projectiles.
- Validation: add targeted tests/benchmarks confirming metadata reuse (no per-frame resolve), allocator efficiency under high projectile counts, and skipped transform writes without visual regressions; capture a perf snapshot before/after.

## Progress Tracking
**Overall Status:** In Progress - 40%

### Subtasks
| ID  | Description | Status | Updated | Notes |
| --- | ----------- | ------ | ------- | ----- |
| 1.1 | Review DESIGN059 and current `ProjectilesInstancedLayer` hot path. | Complete | 2025-11-17 | |
| 1.2 | Precompute projectile render metadata at spawn and consume in render layer. | Complete | 2025-11-17 | `renderKey`/`renderInfo` set at spawn and read in layer |
| 1.3 | Implement low-overhead instance allocation strategy for projectiles. | Not Started | 2025-11-17 | |
| 1.4 | Gate transform writes by simulation tick and carve out per-frame exceptions. | Complete | 2025-11-17 | Skip frame when sim tick unchanged unless beams present |
| 1.5 | Add tests/benchmarks for metadata reuse, allocator cost, and transform throttling. | Not Started | 2025-11-17 | |

## Progress Log
### 2025-11-17
- Created task file from DESIGN059 to track projectile instancing performance plan and validation steps.
- Implemented render metadata caching at spawn (`renderKey`, `renderInfo`) and switched instanced layer to consume them.
- Added tick-gated transform updates: render loop skips when simulation tick unchanged unless beams are active.
