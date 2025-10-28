# TASK251 - Remove legacy AI fallback path

**Status:** Completed
**Added:** 2025-10-26
**Updated:** 2025-10-26

## Original Request

Retire the `runLegacyShipBehavior` pathway called out in the tech-debt report so the simulation always uses AI v2. Publish a supporting design and execution plan in the Memory Bank and implement the removal end-to-end.

## Thought Process

- The fallback currently powers UI toggles, metrics harness tests, and panic mocks; removing it demands coordinated updates.
- Disabling AI v2 should become impossible, so the UI store, context, and configuration must all harden against `false` values.
- Tests need to pivot from legacy parity to verifying the guardrails and AI v2 telemetry behaviour.

## Implementation Plan

- [x] Record requirements and DESIGN005 detailing architecture changes, guard strategy, and validation scope.
- [x] Update configuration/UI glue so `aiV2Enabled` cannot become `false` (store guards, HUD toggle expectations, context mirror).
- [x] Remove `runLegacyShipBehavior` from `shipControl`, `systems`, and downstream consumers; add logging when AI state is missing.
- [x] Refresh Vitest suites (`ai-regression`, `ai-metrics`, `ui-settings-panels`, `update-game-panic`, helpers) to reflect the v2-only path.
- [x] Run linting, type-checking, and unit tests; update Memory Bank status before hand-off.

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID  | Description                                                               | Status    | Updated    | Notes                                                   |
| --- | ------------------------------------------------------------------------- | --------- | ---------- | ------------------------------------------------------- |
| 1.1 | Land DESIGN005 capturing requirements, data flow, and guard behaviour     | Completed | 2025-10-26 | Authored DESIGN005 with requirements + testing strategy |
| 1.2 | Enforce AI v2 enablement across config, UI store, and context             | Completed | 2025-10-26 | Guarded toggles, context mirror, and config defaults    |
| 1.3 | Delete legacy ship behaviour and harden `executeAICommand` error handling | Completed | 2025-10-26 | Removed fallback and added stationary safeguard         |
| 1.4 | Update Vitest coverage and mocks for the new API surface                  | Completed | 2025-10-26 | Updated specs and mocks for v2-only execution           |
| 1.5 | Execute validation commands and document completion                       | Completed | 2025-10-26 | Ran lint, type-check, and unit tests                    |

## Progress Log

- 2025-10-26: Logged TASK251 and drafted DESIGN005 describing how to remove the fallback and guard AI enablement.
- 2025-10-26: Hardened AI enablement across config, store, and context; removed `runLegacyShipBehavior` and added missing-AI safeguards.
- 2025-10-26: Updated Vitest suites, refreshed the tech-debt report entry, and ran repository validation commands.
