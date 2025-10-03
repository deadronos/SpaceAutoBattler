# [TASK243] - Restore thruster glow regression coverage

**Status:** Completed  
**Added:** 2025-10-04  
**Updated:** 2025-10-04

## Original Request

Vitest suite reports missing `emissiveLuminance` and `nameMatch` hooks in `src/hooks/useShipThrusters.ts`, breaking the "Thruster glow enhancement" regression tests shared by the user.

## Requirements (EARS)

- WHEN the thruster hook evaluates a material's emissive channel, THE SYSTEM SHALL compute an `emissiveLuminance` metric that drives the dark-emissive fallback logic. [Acceptance: Vitest string check for `emissiveLuminance` passes and manual review confirms fallback still uses luminance threshold].
- WHEN filtering ship scene nodes, THE SYSTEM SHALL prioritize name-based detection via a `nameMatch` helper so meshes labelled `engine`, `thruster`, or `exhaust` are still captured. [Acceptance: Vitest regression expecting `nameMatch` substring succeeds and hook behaviour remains unchanged].
- WHEN restoring the API surface, THE SYSTEM SHALL keep existing thruster intensity updates and fallback mesh lifecycle intact to avoid regressions. [Acceptance: No new lint/type errors; existing thruster intensity logic unchanged; hook cleanup still disposes fallback meshes].

## Design

- Rename the inline helper responsible for mesh name filtering back to `nameMatch`, keeping the lower-cased string checks intact; continue using the helper within the scene traversal guard.
- Introduce an `emissiveLuminance` constant that wraps the previous luminance computation; reuse it to derive the fallback emissive color so numerical behaviour matches the refactor.
- Leave the broader refactor intact (bloom registration, fallback mesh management), but ensure exported behaviour and strings align with the regression tests.

## Implementation Plan

- [x] Update `src/hooks/useShipThrusters.ts` to expose `nameMatch` helper and `emissiveLuminance` variable without altering the current logic flow.
- [x] Re-run focused Vitest `thruster-glow.spec.ts` to confirm the regression suite passes.
- [x] Document progress in this task file and update the Memory Bank index entry.

## Progress Log

### 2025-10-04

- Task created and requirements/design captured based on thruster glow regression failures shared by the user.
- Reintroduced the `nameMatch` helper and `emissiveLuminance` metric in `src/hooks/useShipThrusters.ts` to restore the regression surface.
- Ran `npx vitest test/vitest/thruster-glow.spec.ts` to confirm the targeted suite now passes.
- Final verification: re-ran the focused regression test and confirmed assertions for `nameMatch` and `emissiveLuminance` are present. Marking task as Completed and moving the memory file to `memory/tasks/COMPLETED/`.

## Acceptance Criteria

- Hook source contains `emissiveLuminance` and `nameMatch` strings while preserving behaviour.
- `test/vitest/thruster-glow.spec.ts` passes locally.
- Memory Bank updated (task file moved to `COMPLETED/` and `_index.md` updated).