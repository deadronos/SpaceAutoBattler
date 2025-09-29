# [TASK152] - Ship Progression Test Hardening

**Status:** Completed  
**Added:** 2025-09-29  
**Updated:** 2025-09-29

## Original Request

Regression surfaced after merging the ship progression system: numerous Vitest suites now fail with `Cannot read properties of undefined (reading 'engine')` because legacy test stubs still build `ShipComponent` objects without the new progression fields (`subsystems`, `damageType`, `armor`, XP values). User requested that we "fix failing tests - we extended ship types so the tests need updating probably".

## Thought Process

Initial hypothesis: the production code now assumes fully populated progression metadata on every ship. Unit tests that craft ad-hoc ship entities bypass the factory helpers and therefore omit the new fields, causing runtime failures when systems query subsystem statuses or armor. Rather than duplicating the full shape in each spec, introduce a shared helper that applies progression defaults (`createProgressionDefaults`, `createSubsystems`) and update affected tests to consume it. This keeps future schema changes localized.

## Implementation Plan

1. **Document Requirements & Design**
   - Capture EARS requirements in `memory/requirements.md` and a focused design + error handling matrix under a new design memo.
   - Record unit test strategy and implementation steps in this task file.
2. **Introduce Progression Test Helper**
   - Add a Vitest helper that mutates/returns ship stubs with progression defaults (XP, damage type, subsystems, armor) derived from hull + max HP.
   - Ensure helper remains deterministic and uses existing `createSubsystems` to stay in sync with production logic.
3. **Update Affected Test Suites**
   - Refactor ship factory functions in `motion.system`, `projectile-bullettype`, `projectile-resolve`, `shield-regen`, `turrets`, `ai-metrics`, `ai-regression`, and `ai-scenario-harness` to apply the new helper.
   - Verify any direct subsystem assertions still pass (adjust fixtures if necessary).
4. **Validation & Follow-up**
   - Run `npm run typecheck` and `npm test` to confirm suites pass.
   - Update this task log and memory bank with outcomes or follow-up work.

## Progress Tracking

**Overall Status:** Completed - 100%

| ID  | Description                                    | Status         | Updated    | Notes |
| --- | ---------------------------------------------- | -------------- | ---------- | ----- |
| 1.1 | Requirements/design documentation              | Completed      | 2025-09-29 | Added EARS + design memo (`memory/design-progression-test-hardening.md`). |
| 1.2 | Progression helper implementation              | Completed      | 2025-09-29 | Introduced `applyProgressionDefaults` helper for Vitest ship stubs. |
| 1.3 | Test suite updates                             | Completed      | 2025-09-29 | Updated affected specs and harness ships to populate progression fields. |
| 1.4 | Validation (typecheck + tests)                 | Completed      | 2025-09-29 | `npm test -- --run --reporter=verbose`. |

## Progress Log

### 2025-09-29

- Created task scaffold outlining plan to harden Vitest ship stubs against progression schema changes.
- Documented requirements in `memory/requirements.md` and design in `memory/design-progression-test-hardening.md`.
- Wired `applyProgressionDefaults` into remaining specs and hydrated AI scenario harness ships with progression defaults.
- Aligned projectile resolution expectation with kinetic shield multipliers and confirmed full suite via `npm test -- --run --reporter=verbose`.
