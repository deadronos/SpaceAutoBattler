# TASK103 - Implement Steering & Transform Utilities

**Status:** Not Started
**Added:** 2025-10-27

## Original Request
Create a `src/utils/steering.ts` (or `transformUtils.ts`) module that centralizes vector/quaternion math for steering, orientation and lead computation. Migrate `steerProjectileTowardTarget` and related orientation code to use the helpers.

## Thought Process
- Homing/steering code is repeated in projectiles and motion systems. Renderer code also computes quaternions from direction vectors. Consolidation will reduce bugs and clarify numeric guards.

## Implementation Plan

- Step 1: Implement `src/utils/steering.ts` with the helper functions described in the design.
- Step 2: Write unit tests for `safeNormalize`, `steerDirection`, `computeLeadDirection`, and `orientQuaternionFromDirection`.
- Step 3: Replace `steerProjectileTowardTarget` internals to use the helpers.
- Step 4: Migrate `src/game/systems/motion.ts` quaternion code and `src/renderer/starDiskOrientation.ts` to use `orientQuaternionFromDirection`.
- Step 5: Run tests and fix issues.

### Subtasks
| ID | Description | Status | Updated | Notes |
| --- | --- | --- | --- | --- |
| 103.1 | Implement `steering.ts` helpers | Not Started |  |  |
| 103.2 | Unit tests for helpers | Not Started |  |  |
| 103.3 | Migrate projectile homing | Not Started |  |  |
| 103.4 | Migrate motion & renderer code | Not Started |  |  |
| 103.5 | Run tests and integrate | Not Started |  |  |

## Progress Log

### 2025-10-27
- Task created.
