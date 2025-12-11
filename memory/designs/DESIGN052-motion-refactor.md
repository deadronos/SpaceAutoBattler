# DESIGN052 — Motion System Refactor

Status: Proposed
Date: 2025-10-28
Author: GitHub Copilot (agent)

Summary

This design proposes splitting the large `src/game/systems/motion.ts` file into a focused folder of small modules that separate angular control, linear control, and physics-sync logic. The goal is improved testability, easier reasoning about motion code, and clearer boundaries between math/algorithmic code and physics engine integration.

Problem

`src/game/systems/motion.ts` currently contains multiple responsibilities:

- PD-like angular control and rotation smoothing
- Linear thrust/strafe acceleration and speed clamping
- Shared temporary vectors/quaternions and constants
- Physics application via deferred kinematic setters

This makes the file long and harder to test in isolation. Changes to physics sync or motion math require editing the same file and increase the risk of introducing regressions.

Goals

- Separate angular control concerns from linear control and physics synchronization.
- Make the core control algorithms (angular PD, steering, linear acceleration/damping) pure and easily unit-testable.
- Contain Rapier/engine-specific code (deferSetNextKinematicTranslation/Rotation) in a dedicated module so it can be mocked or changed without touching algorithmic logic.
- Ensure the public API remains `updateMotionSystem(state, dt)` for minimal ripple to callers.

Non-goals

- Change behavior or tuning values in this refactor.
- Introduce heavy runtime overhead (avoid additional per-frame allocations).

Design

Create new folder: `src/game/systems/motion/`

Files:

- `index.ts` — exports `updateMotionSystem` and re-exports any public helpers.
- `angular.ts` — `updateAngularMotion(ship, targetHeading, dt)` and related constants; pure algorithm as much as possible.
- `linear.ts` — `updateLinearMotion(ship, command, dt)` handling thrust, strafing, damping and speed clamping.
- `physicsSync.ts` — `applyVelocityToPhysics(state, ship, dt)` and any Rapier/safeKinematics bridging code.
- `sharedTemps.ts` — shared pre-allocated THREE Vector3/Quaternion temporaries used internally by `angular.ts` and `linear.ts`.

Module responsibilities

- angular.ts: expose only `updateAngularMotion(ship, targetHeading, dt)` and small helpers used by it. Keep default tuning constants local but export if necessary for tuning tests.
- linear.ts: perform velocity updates on `ship.ship.velocity`, enforce clamping using `getEffectiveStats` from progression module.
- physicsSync.ts: contain calls to `deferSetNextKinematicTranslation` and `deferSetNextKinematicRotation`, and any necessary conversions (to/from plain objects).
- index.ts: import and wire together the above modules in `updateMotionSystem` exactly like current implementation to avoid behavioral changes.

Interfaces

Keep existing function signatures used by other modules unchanged. The only exported function is `updateMotionSystem(state, dt)`; internal decomposition is private.

Testing

- Add unit tests under `test/systems/motion/`:
  - `angular.spec.ts` — test PD control behavior with fake ship objects, assert rotation changes and settle behavior.
  - `linear.spec.ts` — test thrust, strafe, damping, and speed clamping using a fake `getEffectiveStats` where needed.
  - `physicsSync.spec.ts` — test that given a ship and velocity the `deferSetNextKinematicTranslation` is called with expected values; use a small shim/mocked `state`.

Migration plan (incremental)

1. Create `src/game/systems/motion/` folder and add new modules with the extracted code but do not delete `motion.ts` yet.
2. Create `index.ts` that re-implements `updateMotionSystem` by importing the new modules.
3. Replace internal implementation calls in `motion.ts` to delegate to `motion/index.ts` (or rename original to a shim that reexports). Option: keep `motion.ts` as small shim exporting from `motion/index.ts` to avoid changing imports.
4. Run `npx tsc --noEmit` and `npm test` to validate.
5. Remove or archive the original `motion.ts` file content once tests and smoke runs pass.

Acceptance criteria

- `npm run typecheck` and `npm test` pass with no changes to behavior of existing tests.
- No public caller changes required — `updateMotionSystem` still callable from `BattlefieldSystems`.
- New unit tests cover angular and linear pieces with deterministic inputs.

Risks and mitigations

- Risk: accidental change in sign/behavior while copying code. Mitigation: keep initial refactor as a shim and run full test suite.
- Risk: breaking Rapier borrow semantics when moving `deferSetNextKinematic...` calls. Mitigation: keep physicsSync module minimal and run integration smoke.

Files touched (planned)

- Add: `src/game/systems/motion/index.ts`
- Add: `src/game/systems/motion/angular.ts`
- Add: `src/game/systems/motion/linear.ts`
- Add: `src/game/systems/motion/physicsSync.ts`
- Add: `src/game/systems/motion/sharedTemps.ts`
- Update (shim): `src/game/systems/motion.ts` — optional: small shim re-exporting from new index
