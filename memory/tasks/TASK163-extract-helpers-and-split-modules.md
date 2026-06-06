# TASK163 - Extract helpers and split monolithic modules

**Status:** Completed
**Added:** 2026-06-06
**Updated:** 2026-06-06

## Original Request

Split 3 monolithic files (`ships.ts`, `systems.ts`, `damage.ts`) into focused modules and extract cross-cutting helpers (`tempVectors.ts`, `physicsBodyManager.ts`). Wire up consumers so the new modules are actually used.

## Implementation Plan

- [x] Extract `tempVectors.ts` — centralised scratch `Vector3`/`Quaternion` pool
- [x] Extract `physicsBodyManager.ts` — `createTrackedBody`/`destroyBody` body lifecycle helpers
- [x] Split `damage.ts` → `damageMath.ts` (pure calc) + `damageApplication.ts` (mutation/callbacks) + barrel
- [x] Extract `turretFactory.ts` — turret ECS creation from `ships.ts`
- [x] Extract `pipeline.ts` — declarative subsystem ordering from `systems.ts`
- [x] Wire up consumers: `steering.ts`, `aiming.ts`, `turrets.ts` → `tempVectors.ts`; `entityLifecycle.ts` → `physicsBodyManager.ts`
- [x] Add tests: `pipeline.spec.ts` (8 tests), `turret-factory.spec.ts` (5 tests)
- [x] Update memory bank: `core-systems.md`, `progress.md`

## Files Created

| File                                   | Purpose                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `src/utils/tempVectors.ts`             | Shared pool of 15 `Vector3` + 2 `Quaternion` scratch slots with semantic aliases |
| `src/game/utils/physicsBodyManager.ts` | `createTrackedBody`/`destroyBody` for Rapier body lifecycle                      |
| `src/game/combat/damageMath.ts`        | `calculateEffectiveDamage` — pure shield/armor/hull math                         |
| `src/game/combat/damageApplication.ts` | `applyDamageResultToShip` — state mutation + callbacks                           |
| `src/game/turretFactory.ts`            | `createTurretEntities` — turret ECS creation                                     |
| `src/game/systems/pipeline.ts`         | `createMeasurementRunner`, `executePipeline`, `stepPhysics`                      |
| `test/vitest/systems/pipeline.spec.ts` | 8 tests for pipeline ordering, profiling, guards, panic rethrow                  |
| `test/vitest/turret-factory.spec.ts`   | 5 tests for turret registration, cooldown, priority, colliders                   |

## Files Modified

| File                                   | Change                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `src/game/combat/damage.ts`            | Barrel re-export → delegates to `damageMath.ts` + `damageApplication.ts`      |
| `src/game/ships.ts`                    | Turret loop replaced by `createTurretEntities()` call                         |
| `src/game/systems.ts`                  | Inline chain replaced by `SIMULATION_PIPELINE`/`POST_PHYSICS_PIPELINE` arrays |
| `src/utils/steering.ts`                | Locals replaced with imports from `tempVectors.ts`; `FORWARD` re-exported     |
| `src/game/systems/turrets.ts`          | `TEMP_QUAT`/`TEMP_TURRET_DIR`/`TEMP_LOCAL_DIR` → `tempVectors.ts`             |
| `src/game/combat/aiming.ts`            | 4 `TEMP_*` locals → `tempVectors.ts`                                          |
| `src/game/entityLifecycle.ts`          | Inline body removal → `destroyBody()` from `physicsBodyManager.ts`            |
| `src/game/combat/damageApplication.ts` | Restored `onKill` alive→dead transition comment                               |
| `memory/core-systems.md`               | Updated to document `SIMULATION_PIPELINE`/`POST_PHYSICS_PIPELINE` arrays      |
| `memory/progress.md`                   | Added refactor entry; scoped audit entry to docs-only                         |

## Validation

- `npm run typecheck` — clean
- `npm test` — 170 files / 923 tests passing
