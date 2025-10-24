# TASK150 - Update AI Scenario Fixtures

**Status:** Completed  
**Added:** 2025-09-28  
**Updated:** 2025-09-28

## Original Request

Fix `npm test` failures affecting the AI scenario harness fixtures.

## Thought Process

- `npm test` currently fails because `runAIScenario` now emits richer metrics (first-shot timing, histogram counts) and slightly different headings/positions after recent AI scoring updates.
- The Vitest fixtures under `test/vitest/fixtures/` still reflect the pre-instrumentation snapshots, so equality assertions no longer hold.
- A dedicated refresh script (`tmp/refresh-ai-fixtures.ts`) can regenerate normalized fixtures that embody the new deterministic outputs.

## Implementation Plan

1. Execute `npx tsx tmp/refresh-ai-fixtures.ts` to regenerate deterministic fixtures for the escort, bomber intercept, and artillery retreat scenarios.
2. Review the generated diffs to confirm they capture the expected KPI data and command score adjustments, then stage the updated JSON files.
3. Re-run `npm test` and `npm run typecheck` to ensure the refreshed fixtures align with the harness outputs and no other regressions surface.

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID  | Description                                                   | Status   | Updated    | Notes                                                         |
| --- | ------------------------------------------------------------- | -------- | ---------- | ------------------------------------------------------------- |
| 1.1 | Regenerate scenario fixtures via `tmp/refresh-ai-fixtures.ts` | Complete | 2025-09-28 | Generated normalized logs and wrote fixture files via script  |
| 1.2 | Verify diffs and update `test/vitest/fixtures/*.json`         | Complete | 2025-09-28 | Reviewed metrics deltas (first-shot timing, histogram counts) |
| 1.3 | Run regression gates (`npm test`, `npm run typecheck`)        | Complete | 2025-09-28 | All suites green post-refresh                                 |

## Progress Log

### 2025-09-28

- Reproduced Vitest failures confined to `ai-scenario-harness.spec.ts`, confirming fixture drift as the root cause.
- Authored updated requirements (`memory/requirements.md`) and design document (`memory/designs_completed/design-ai-scenario-determinism-refresh.md`) to formalize the refresh approach.
- Regenerated fixtures via `npx tsx tmp/refresh-ai-fixtures.ts`, validated diffs, and re-ran `npm test` plus `npm run typecheck` with passing results.
