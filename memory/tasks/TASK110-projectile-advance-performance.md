# TASK110 — Projectile advance performance

**Status:** Pending  
**Added:** 2025-11-17  
**Updated:** 2025-11-17

## Original Request

Create a `/memory/tasks` plan for DESIGN058 (projectile advance performance hot path) so the design can be executed and validated.

## Thought Process

- DESIGN058 targets the `advanceProjectiles` hot loop: avoid recomputing category metadata, make homing target lookups constant-time, and reduce unnecessary per-tick kinematic updates.
- Capturing this as a task keeps the spec-driven workflow traceable (requirements → plan → validation) and ensures we add tests/benchmarks alongside code changes.
- Workstreams likely touch projectile spawn (`spawn.ts` / `physicsAdapter.ts`), projectile systems (`advance.ts`), ship lookup helpers, and potentially kinematics wrappers/config.

## Implementation Plan

- Cache projectile metadata at spawn: resolve category once (and optional resolved info) during spawn/physics adapter and store on the projectile component; `advanceProjectiles` should consume the cached data without calling `resolveProjectileCategory` per tick.
- Introduce an efficient target lookup: maintain a `shipById` map (or equivalent) updated on ship spawn/despawn and switch homing projectiles from `findShipById` scans to constant-time map access, with validation for stale targets.
- Tailor kinematic updates: identify projectile categories that do not need translation/rotation updates every tick (e.g., visual tracers or beams handled elsewhere) and skip or downsample those kinematic queue operations while keeping physical projectiles fully synced.
- Validation: add unit/integration tests to assert category is set at spawn, `advanceProjectiles` no longer recomputes it, homing lookups are map-based and handle missing targets, and kinematic-skipped categories preserve gameplay expectations; capture a lightweight perf/alloc benchmark before/after.

## Progress Tracking

**Overall Status:** In Progress - 80%

### Subtasks

| ID  | Description                                                                        | Status      | Updated    | Notes                                                                                |
| --- | ---------------------------------------------------------------------------------- | ----------- | ---------- | ------------------------------------------------------------------------------------ |
| 1.1 | Review DESIGN058 and current `advanceProjectiles` hot path.                        | Complete    | 2025-11-17 | Confirmed scope: cache metadata, map lookups, trim kinematic ops.                    |
| 1.2 | Cache projectile category/metadata at spawn and remove per-tick resolution.        | Complete    | 2025-11-17 | Category now set at spawn; advance no longer resolves per tick.                      |
| 1.3 | Add constant-time homing target lookup (ship map) and integrate into advance loop. | Complete    | 2025-11-17 | `shipById` map added to GameState and used by homing.                                |
| 1.4 | Adjust kinematic update cadence per projectile category and document rules.        | Complete    | 2025-11-17 | Rotation updates skipped for non-homing projectiles to cut half the kinematic calls. |
| 1.5 | Add tests/benchmark notes validating caching, lookup, and kinematic changes.       | In Progress | 2025-11-17 | Added homing map-resolution test; perf capture still pending.                        |

## Progress Log

### 2025-11-17

- Created task file from DESIGN058 to track projectile advance hot-path optimizations (category caching, ship map lookup, tailored kinematics) and align validation with the design.
- Implemented category caching at spawn, removed per-tick resolution, added `shipById` map (spawn/destroy lifecycle), switched homing lookup to map with fallback, and skipped rotation kinematic updates for non-homing projectiles.
- Updated test fixtures for ship map population and added a homing test that exercises map-based lookup; perf/alloc benchmark still TODO.
