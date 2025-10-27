# TASK101 - Implement Physics Factory helpers and migrate ship/projectile spawn

**Status:** Not Started
**Added:** 2025-10-27
**Updated:** 2025-10-27

## Original Request
Create a helper module that centralizes Rapier `RigidBody` and `Collider` creation and safe registration of collider handles into `state.colliderLookup`. Migrate `spawnShip` and `fireProjectile` to use the helper as a proof-of-concept.

## Thought Process
- The code currently repeats body/collider creation logic in `spawnShip`, `fireProjectile`, and turret creation.
- Implement a small, focused helper module in `src/game/utils/physicsFactory.ts` with the following responsibilities:
  - build & create RigidBodyDesc with provided translation/rotation
  - create a ColliderDesc of requested type with options (sensor, ActiveEvents, ActiveCollisionTypes)
  - create rigid body & collider on `state.physicsWorld` and return them
  - provide `registerColliderHandle` and `unregisterColliderHandle` that operate safely on `state.colliderLookup`
- Keep the helper hierarchical and granular so callers still control entity creation and `enqueuePostPhysicsMutation` wrappers.

## Implementation Plan

- Step 1: Create `src/game/utils/physicsFactory.ts` with typed functions and defensive behavior.
- Step 2: Add unit tests under `test/` for helper behaviors (collider registration, options handling).
- Step 3: Replace ship spawn body + collider creation in `src/game/ships.ts` to call the helper.
- Step 4: Replace projectile spawn body + collider creation in `src/game/systems/projectiles.ts`.
- Step 5: Run `npx tsc --noEmit` and `npm test` and fix regressions.
- Step 6: Iterate on additional call sites (turrets) if everything passes.

### Subtasks
| ID | Description | Status | Updated | Notes |
| --- | --- | --- | --- | --- |
| 101.1 | Create `physicsFactory.ts` with helper functions | Not Started |  |  |
| 101.2 | Add unit tests for factory behaviors | Not Started |  |  |
| 101.3 | Migrate `spawnShip` to use factory | Not Started |  |  |
| 101.4 | Migrate `fireProjectile` to use factory | Not Started |  |  |
| 101.5 | Run tests and fix issues | Not Started |  |  |

## Progress Log

### 2025-10-27
- Task created.
