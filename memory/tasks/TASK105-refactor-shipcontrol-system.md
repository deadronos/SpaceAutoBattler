# [TASK105] Refactor Ship Control / AI Execution

**Status:** In Progress
**Added:** 2025-10-28
**Updated:** 2025-10-28

## Original Request
Split `src/game/systems/shipControl.ts` into smaller modules separating AI decision logic, movement application, weapons, and lifecycle management.

## Thought Process
- `shipControl.ts` mixes decisions (heading normalization, thrust) with immediate side-effects (deferSetNextKinematicTranslation, firing projectiles) and lifecycle updates (cooldowns, regen).
- By returning a `Decision` object from the AI executor and having a separate movement applier and weapons handler, we make the decision logic pure and unit-testable.
- Preserve `prepareShips` public API; orchestrate smaller modules inside the refactor.

## Implementation Plan
- Create `src/game/systems/shipControl/` with `index.ts`, `aiExecutor.ts`, `movementApply.ts`, `weapons.ts`, `lifecycle.ts`, `aiSafety.ts`.
- Implement `aiExecutor` to return Decision objects for movement and firing intent.
- Implement `movementApply` to be the only module to call `deferSetNextKinematicTranslation`/rotation.
- Implement `weapons` to create muzzle flash, call `fireProjectile`, and record shot metrics.
- Add unit tests for `aiExecutor` and `movementApply`.
- Run `npx tsc --noEmit` and `npm test`.

### Subtasks

| ID    | Description                                         | Status      | Updated | Notes |
| ----- | --------------------------------------------------- | ----------- | ------- | ----- |
| 105.1 | Create shipControl folder and `index.ts`            | completed   | 2025-10-28 | Public API preserved. |
| 105.2 | Implement `aiExecutor.ts` returning Decision objects | completed | 2025-10-28 | Pure decision logic. |
| 105.3 | Implement `movementApply.ts` (kinematic updates)    | completed   | 2025-10-28 | Centralizes deferred setters. |
| 105.4 | Implement `weapons.ts` for firing side-effects      | completed   | 2025-10-28 | Isolates metrics & muzzle flash. |
| 105.5 | Implement `aiSafety.ts` for missing-AI handling     | completed   | 2025-10-28 | `missingAiShips` kept. |
| 105.6 | Add unit tests                                      | not-started | -       | `test/systems/shipControl/`.
| 105.7 | Run full test suite                                 | not-started | -       | `npx tsc --noEmit` + `npm test`.

## Progress Log

### 2025-10-28
- Design (DESIGN054) authored and task created. Plan and subtasks added.

