# DESIGN: Split `src/game/physics/safeKinematics.ts`

**Created:** 2025-10-27
**Author:** Copilot (assistant)

## Purpose

This design documents a targeted refactor to split `src/game/physics/safeKinematics.ts` into smaller, cohesive modules. The goal is to reduce duplication, make wrappers easier to test, and centralize shared validation/error-recording logic used when queuing Rapier-related mutations.

## Proposed file layout

- `src/game/physics/types.ts` — shared type exports (KinematicBody, Collider) and any exported helper types used by other physics modules.
- `src/game/physics/mutationHelpers.ts` — small helpers to validate `GameState.simulation`, wrap an enqueue function and record Rapier guard trips. Exposes a factory like `makeDeferredEnqueue(state)` or a helper `safeEnqueue(state, enqueueFn)`.
- `src/game/physics/deferWrappers.ts` — functions that use `enqueueDeferredMutation` for kinematic setters (deferSetNextKinematicTranslation, deferSetLinvel, deferSetMass, etc.).
- `src/game/physics/postWrappers.ts` — functions that use `enqueuePostPhysicsMutation` for post-step setters (postSetNextKinematicTranslation, postSetLinvel, postSetMass, etc.).

A small index file (`src/game/physics/index.ts`) may re-export the most commonly used functions to preserve import ergonomics.

## Design rationale

- The current file repeats the same validation and try/catch pattern across many similarly shaped functions. Extracting the common pattern reduces copy/paste and centralizes behavior such as throwing when `state.simulation` is missing, or recording Rapier guard trips.
- Grouping by enqueue type (defer vs post) makes the intent clear for callers and helps surface differences between the two semantics.
- Keeping type declarations in a dedicated `types.ts` aids other physics modules that need to reference the surface types without pulling in heavy implementations.

## API stability and migration

- Preserve exported function names and signatures exactly to minimize import-site changes. Implementation migration will replace the single file with smaller modules but re-export original names from `src/game/physics/index.ts` where needed.
- If some callers import directly from `src/game/physics/safeKinematics.ts`, we will add a thin compatibility file that re-exports from the new modules for one commit cycle before updating callers to import the new paths.

## Implementation details

- `mutationHelpers.ts` will export a utility `withSimulationArrays(state, fn)` that asserts presence of simulation arrays and runs `fn()` inside the enqueue closure with `try/catch` that records Rapier guard trips.
- `deferWrappers.ts` and `postWrappers.ts` will import `withSimulationArrays` and call `enqueueDeferredMutation` or `enqueuePostPhysicsMutation` accordingly. Each function remains small and focused.
- Add unit tests for `mutationHelpers` to ensure the helper throws when simulation arrays are missing and that it correctly calls `recordRapierGuardTrip` when the inner function throws.

## Risks & mitigations

- Import cycles: ensure `mutationHelpers` doesn't import from modules that import it. Keep it minimal and only depend on `../simulationQueue` and `../simulationQueue` utilities.
- Behavioral changes: ensure order/timing of `enqueueDeferredMutation` vs `enqueuePostPhysicsMutation` remains unchanged. Test via existing physics unit tests / small integration test.
- Name stability: re-export the same function names from an index until all import sites are updated.

## Acceptance criteria

1. `npx tsc --noEmit` passes.
2. `npm test` passes (or at minimum no regressions in physics-related tests).
3. All function signatures remain unchanged and import sites don't need immediate updates (compat layer present).
4. New unit tests for `mutationHelpers` cover missing simulation arrays and Rapier guard trip recording.

---

Design file end.
