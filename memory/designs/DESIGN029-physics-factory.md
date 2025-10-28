# DESIGN001 - Physics Factory: centralized body & collider creation

**Status:** Proposed
**Created:** 2025-10-27
**Author:** GitHub Copilot (assistant)

## Summary

Centralize the repeated Rapier rigid body and collider creation logic into a small, well-tested helper module (`src/game/utils/physicsFactory.ts`), and provide helper functions for safe registration/unregistration of collider handles in `state.colliderLookup`.

## Motivation / Problem

Multiple places in the codebase (notably `src/game/ships.ts`, `src/game/systems/projectiles.ts`) repeat the same pattern:

- build a `RigidBodyDesc` (often kinematic), set translation and rotation
- create the rigid body in `state.physicsWorld`
- build a `ColliderDesc` (ball/capsule) and set ActiveEvents/ActiveCollisionTypes/sensor
- create collider in `state.physicsWorld` attached to the body
- add the entity to `state.world`
- add mapping `state.colliderLookup.set(collider.handle, entity)`

This repetition is boilerplate, error-prone, and scattered across several files. We should centralize these responsibilities.

## Goals

- Provide a small, focused API to create common combinations of body + collider.
- Be defensive: handle missing collider.handle values, and provide robust registration/unregistration helpers.
- Make it easy to add additional options later (ccd, sensor, active events, collision types).
- Keep calling code minimal and readable.

## Non-Goals

- Replace every possible Rapier usage; only provide helpers for the frequent patterns (spawn ships, projectiles, turrets, simple entities).
- Change physics semantics or collision behavior.

## Proposed API (module: `src/game/utils/physicsFactory.ts`)

Exports (TypeScript):

- createKinematicBodyWithCollider(state: GameState, opts: CreateBodyColliderOpts): { body: Rapier.RigidBody, collider: Rapier.Collider | null }
  - opts: { position?: Vector3, rotation?: Quaternion | {x:number,y:number,z:number,w:number}, collider: { type: 'ball'|'capsule', params: any }, sensor?: boolean, activeEvents?: boolean, activeCollisionTypes?: number, ccd?: boolean }

- registerColliderHandle(state: GameState, collider: Rapier.Collider | null, entity: unknown): void
  - Safely register the collider handle into `state.colliderLookup` if present.

- unregisterColliderHandle(state: GameState, collider: Rapier.Collider | null): void
  - Remove mapping if present.

- createAndRegisterEntityBody(state: GameState, entityInit: object, bodyOpts...): { entity: unknown, collider: Rapier.Collider | null }
  - Convenience for enqueue-post-physics flows.

## Data models / types

Follow existing project types: `GameState` and Rapier types from `state.rapier`.

## Migration plan (high level)

1. Implement the module and unit tests to reproduce current behaviors (collider handle registration, sensor flags).
2. Replace the ship spawn collider creation in `src/game/ships.ts` to call the helper; run typecheck & tests.
3. Replace projectile spawn code in `src/game/systems/projectiles.ts`.
4. Replace turret collider creation.
5. Run integration tests and fix issues.

## Acceptance criteria

- Tests for the helper verify that `state.colliderLookup` contains the handle after creation.
- `spawnShip` and `fireProjectile` refactored to call the helper; no behavior change in unit tests.
- No regressions in physics-related tests.

## Risks

- Subtle differences in how options are passed (e.g., the original code may set `setSensor(true as unknown as boolean)` hack) — helper must accept flexible inputs and preserve exact flags.

## Notes

We'll write the helper using existing Rapier constructors available on `state.rapier` and follow the defensive patterns already present in the codebase.
