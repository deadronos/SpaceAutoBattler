# TASK228 - Rapier Velocity Sampling Hardening

**Status:** In Progress  
**Added:** 2025-09-29  
**Updated:** 2025-09-29

## Original Request

After the motion system migration, the AI still reads rigid-body velocity via `getShipVelocity` calling `rigidBody.linvel()`. During intense fleet engagements (carrier launches, rapid despawns) Rapier raises `recursive use of an object detected` panics because decision code touches the physics API while other systems mutate the world. We need to source velocities from `ShipComponent.velocity` instead to eliminate Rapier access during AI scoring.

## Thought Process

- The motion system already maintains `ShipComponent.velocity` using deterministic integration. Accessing Rapier at decision time is redundant and reopens the borrowing issue we solved for carrier spawns and reset handling.
- AI scoring only requires approximate velocity for intercept/intent scoring; using the motion vector keeps behaviour consistent across worker and harness executions (where Rapier is sometimes stubbed out).
- Updating the helper and tests should be low-risk, but we must tighten tests to prevent future regressions that revive Rapier calls.

## Implementation Plan

1. Update `getShipVelocity` (and dependent helpers) to copy from `ship.ship.velocity`, normalising invalid or missing values to zero without touching Rapier.
2. Adjust AI intercept scoring tests to seed `ShipComponent.velocity` vectors and add assertions that the Rapier `linvel` spy is never invoked during scoring.
3. Add a regression covering ships without velocity vectors to confirm the helper returns zeros safely.
4. Run `npm run typecheck` and `npm test` to validate the change, then update memory bank progress once the fix lands.

## Progress Tracking

**Overall Status:** In Progress — 35%

### Subtasks

| ID | Description | Status | Updated | Notes |
| --- | --- | --- | --- | --- |
| 1.1 | Draft EARS requirements and design document for velocity sampling hardening | Complete | 2025-09-29 | Added requirements section and design file `memory/designs/TASK228-rapier-velocity-sampling.md` |
| 1.2 | Update velocity helper and intercept logic to rely on `ShipComponent.velocity` | Not Started | 2025-09-29 | Pending implementation |
| 1.3 | Expand intercept Vitest coverage and add regression for missing velocity | Not Started | 2025-09-29 | Pending |
| 1.4 | Run validation suites and document completion | Not Started | 2025-09-29 | Pending |

## Progress Log

### 2025-09-29

- Captured Rapier velocity sampling regression, authored EARS requirements and design doc outlining the switch to `ShipComponent.velocity` with zero fallback.
