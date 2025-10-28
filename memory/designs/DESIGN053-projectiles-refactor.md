# DESIGN053 — Projectiles System Refactor

Status: Proposed
Date: 2025-10-28
Author: GitHub Copilot (agent)

Summary

Split `src/game/systems/projectiles.ts` into focused modules that separate projectile spawning, per-frame advancement, homing/steering, beam handling, and physics adapter responsibilities. The goal is to make projectile creation, runtime movement, and beam logic easier to maintain and test independently.

Problem

`projectiles.ts` contains several responsibilities:
- Resolving projectile info and determining visual/collider params
- Projectile entity creation (kinematic body + collider) and registration
- Beam tracing and hit point computation
- Homing steering logic and per-frame advancement
- Physics bridging/deferred setters

This mixing increases complexity and risk when adding new projectile behaviors (beam variants, area effects, guided missiles). It also makes unit testing specific behaviors harder.

Goals

- Decompose the module into spawn, runtime (advance), homing/steering, and beam utilities.
- Keep entity creation and physics enqueueing local to one module for easier mocking.
- Preserve `fireProjectile` and `advanceProjectiles` public API.
- Share minimal temporaries via a `sharedTemps.ts` inside the projectiles folder.

Design

Create folder `src/game/systems/projectiles/` with the following files:
- `index.ts` — expose `fireProjectile`, `advanceProjectiles`, constants used elsewhere (e.g., TEMP_POS), re-export internals for tests.
- `spawn.ts` — `fireProjectile` implementation internals: resolve projectile info, compute initial position/rotation, assemble projectile object, call physics factory and register collider. Use `enqueuePostPhysicsMutation` inside spawn.
- `advance.ts` — `advanceProjectiles`: per-frame movement for non-beam projectiles, calls into `homing.ts` when needed. Keep movement-only concerns here.
- `homing.ts` — steering logic: `steerProjectileTowardTarget` and other steering helpers.
- `beam.ts` — `createBeamHitInfo` and beam-specific runtime behavior (ttl, length, hitPoint); isolated raycast usage and collider lookup logic.
- `physicsAdapter.ts` — wrap `createKinematicBodyWithCollider`, `registerColliderHandle`, `deferSetNextKinematicTranslation`, `deferSetNextKinematicRotation` so changes to physics engine live in one place.
- `sharedTemps.ts` — shared Vector3 temporaries like `TEMP_POS`, `TEMP_TARGET` so tests can import deterministic helpers.

Interfaces

- `fireProjectile(state, origin, direction, opts?)` — public API retained.
- `advanceProjectiles(state, delta)` — public API retained.
- Internal modules keep function signatures private; index exports just the public API and a small set of internals for testing.

Testing

Add unit tests under `test/systems/projectiles/`:
- `homing.spec.ts` — verify steering behavior against moving targets using deterministic positions.
- `beam.spec.ts` — mock `state.physicsWorld.castRay` and colliderLookup to verify hit point resolution.
- `spawn.spec.ts` — verify that spawn enqueues a creation mutation and registers collider handle; use a fake `enqueuePostPhysicsMutation` shim.
- `advance.spec.ts` — per-frame movement of projectiles without hitting anything; validate position updates and deferred physics calls.

Migration plan (incremental)

1. Create `src/game/systems/projectiles/` and extract functions into the new modules, leaving `projectiles.ts` as a small shim that re-exports from `projectiles/index.ts`.
2. Add `sharedTemps.ts` and move `TEMP_POS`/`TEMP_TARGET` into it to avoid duplication.
3. Run `npx tsc --noEmit` and `npm test` and fix imports as needed.
4. Add tests for homing and beam behaviors to guard behavior.
5. Remove original `projectiles.ts` body if smoke runs pass.

Acceptance criteria

- `npx tsc --noEmit` and `npm test` pass.
- `fireProjectile` and `advanceProjectiles` still behave identically on integration smoke runs.
- New modules contain clear responsibilities and are covered by unit tests for homing and beam.

Risks and mitigations

- Risk: subtle differences in beam hit math due to vector clone/copy changes. Mitigate by keeping math identical and adding beam tests that compare outputs before/after the refactor.
- Risk: collider registration order changes break collision lookup. Mitigate by preserving `enqueuePostPhysicsMutation` usage and tests that validate handle registration.

Files touched (planned)

- Add: `src/game/systems/projectiles/index.ts`
- Add: `src/game/systems/projectiles/spawn.ts`
- Add: `src/game/systems/projectiles/advance.ts`
- Add: `src/game/systems/projectiles/homing.ts`
- Add: `src/game/systems/projectiles/beam.ts`
- Add: `src/game/systems/projectiles/physicsAdapter.ts`
- Add: `src/game/systems/projectiles/sharedTemps.ts`
- Keep: `src/game/systems/projectiles.ts` as an optional shim until migration completes.

