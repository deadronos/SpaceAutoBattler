
# TASK253 - Beam Projectile Follow

**Status:** In Progress  
**Added:** 2025-10-15  
**Updated:** 2025-10-15

## Original Request

Fix beam projectiles to follow their firing ships so beam hit registration and visuals remain aligned when ships move during a beam's short TTL. See PR [#269](https://github.com/deadronos/SpaceAutoBattler/pull/269) (branch: `codex/review-and-restructure-beam-implementation`).

## Thought Process

- Observed misalignment between beam visuals and applied hits in some scenarios. Visual fixes (TASK251) reduced visible drift, but the projectile/spawn logic still records origins that can diverge when sources move immediately after firing.
- For deterministic behaviour and stable hit registration, we should attach minimal follow metadata to beam projectiles (local muzzle origin/direction + source entity id) and use reconstructed raycasts each tick rather than moving rigid bodies per-frame.
- This approach avoids frequent Rapier body teleportation while keeping collision and visuals aligned; it also minimises allocation and preserves deterministic traces for tests.

## Implementation Plan

1. Capture EARS-style requirements in `memory/requirements.md`.  
2. Update `fireProjectile` to attach follow metadata to beam projectiles: `followSourceId`, `localMuzzleOrigin`, `localMuzzleDirection`, and `followStrategy` (raycast|physics).  
3. Modify `advanceProjectiles`/`resolveProjectiles` so beam projectiles with `followSourceId` reconstruct world-space origin/direction each tick and perform the hit raycast from that reconstructed origin; avoid per-frame Rapier body moves for beams.  
4. Ensure visuals use the same reconstructed transforms (leveraging TASK251 helpers) and prune orphaned beams when the source is gone.  
5. Add Vitest unit/system tests verifying spawn metadata, transform reconstruction (< 0.5 unit error under movement), hit registration while sources move, and orphan teardown.  
6. Run `npm run typecheck`, targeted Vitest suites, and CI on PR #269; refine based on review feedback.  
7. Consider a `beam.followMode` config to select between raycast (preferred) and physics-follow (optional) for gameplay/perf tradeoffs.

## Progress Tracking

**Overall Status:** In Progress — 30%

### Subtasks

| ID | Description | Status | Updated | Notes |
| --- | ----------- | ------ | ------- | ----- |
| 1.1 | Add EARS to `memory/requirements.md` | Complete | 2025-10-15 | See requirements section below. |
| 1.2 | Add design doc in `memory/designs` | Complete | 2025-10-15 | Draft design added. |
| 1.3 | Spawn metadata: `fireProjectile` update | In Progress | 2025-10-15 | WIP in `codex/review-and-restructure-beam-implementation` (PR #269). |
| 1.4 | Update `advanceProjectiles`/`resolveProjectiles` to use reconstructed raycasts | In Progress | 2025-10-15 | Partial implementation; tests pending. |
| 1.5 | Add Vitest system/integration tests | Not Started | - | Plan created; writing tests next. |
| 1.6 | CI validation and PR review | Not Started | - | PR opened: #269. |

## Progress Log

### 2025-10-15

- Created TASK253 to track fixes ensuring beam projectile collision and visuals follow their firing ships.  
- Drafted EARS requirements and design doc and started implementing spawn metadata in branch `codex/review-and-restructure-beam-implementation` (PR #269).  
- WIP: injected `followSourceId` and local muzzle metadata into spawned beam projectiles; next step is to modify the projectile advance/resolution logic to use reconstructed raycasts rather than moving rigid bodies per-frame.


