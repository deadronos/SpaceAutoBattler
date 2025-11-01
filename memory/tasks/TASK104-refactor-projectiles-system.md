# TASK104 - Refactor Projectiles System (split projectiles.ts)

**Status:** In Progress
**Added:** 2025-10-28
**Updated:** 2025-10-28

## Original Request
Split `src/game/systems/projectiles.ts` into focused modules for spawn, advance, homing, beam, and physics-adapter logic.

## Thought Process
- Projectiles code handles spawn, beam hit detection, homing, per-frame advancement, and physics/registration.
- Splitting by responsibility reduces cognitive load and allows independent unit testing (homing algebra, beam hit resolution, spawn/registration order).
- Preserve `fireProjectile` and `advanceProjectiles` public API; move internals to `src/game/systems/projectiles/*`.

## Implementation Plan
- Create `src/game/systems/projectiles/` and add `index.ts`, `spawn.ts`, `advance.ts`, `homing.ts`, `beam.ts`, `physicsAdapter.ts`, `sharedTemps.ts`.
- Keep `src/game/systems/projectiles.ts` as shim re-exporting from new `index.ts` until validation completes.
- Add unit tests for homing, beam hit resolution, and spawn registration.
- Validate behavior with smoke integration tests.

### Subtasks

| ID    | Description                                          | Status      | Updated | Notes |
| ----- | ---------------------------------------------------- | ----------- | ------- | ----- |
| 104.1 | Create projectiles folder and `index.ts`             | completed   | 2025-10-28 | Public exports preserved. |
| 104.2 | Extract spawn logic into `spawn.ts`                  | completed   | 2025-10-28 | Keeps enqueuePostPhysicsMutation local. |
| 104.3 | Extract runtime `advanceProjectiles` into `advance.ts` | completed | 2025-10-28 | Movement-only code isolated. |
| 104.4 | Add `homing.ts` for steering logic                   | completed   | 2025-10-28 | Homing logic separated for tests. |
| 104.5 | Add `beam.ts` for beam raycast and hit resolution     | completed   | 2025-10-28 | Beam math isolated. |
| 104.6 | Add `physicsAdapter.ts` for collider/body creation    | completed   | 2025-10-28 | Centralized physics factory use. |
| 104.7 | Add tests for homing/beam/spawn                      | not-started | -       | Add under `test/systems/projectiles/`. |
| 104.8 | Run full test suite                                  | not-started | -       | `npx tsc --noEmit` + `npm test`.

## Progress Log

### 2025-10-28
- Design (DESIGN053) written and task created. Split plan documented.

