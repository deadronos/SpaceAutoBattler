# TASK144 - AI Metrics Resilience

**Status:** Completed  
**Added:** 2025-09-28  
**Updated:** 2025-09-28

## Original Request

Fix `npm test` failures caused by AI metrics regressions introduced after KPI instrumentation, ensuring percentile calculations, projectile telemetry stubs, and scenario harness fixtures align with expected behavior.

## Thought Process

The failing Vitest suites highlight three regressions: (1) percentile outputs now use interpolated values instead of the legacy lower-bound sampling, (2) lightweight test states no longer provide the Rapier/physics scaffolding required by `fireProjectile`, causing runtime errors, and (3) scenario fixtures omit the new metrics payload appended by `runAIScenario`. Restoring the historic percentile semantics, enriching the stubs, and refreshing fixtures should resolve the failures without altering production systems.

## Implementation Plan

- Align the percentile helper with historical behavior by selecting the floor of `(n - 1) * p`.
- Extend the AI metrics test stub to expose Rapier builders, physics world hooks, and `world.createEntity` that tracks projectiles.
- Snapshot the harness metrics payload and update fixtures with deterministic values (commands, positions, metrics).
- Re-run `npm test` and capture command output.

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks

| ID | Description | Status | Updated | Notes |
| --- | --- | --- | --- | --- |
| 1.1 | Capture requirements and design for AI metrics resilience | Complete | 2025-09-28 | Added entries to `memory/requirements.md` and `memory/designs_completed/design-ai-metrics-resilience.md`. |
| 1.2 | Patch percentile helper and test stubs | Complete | 2025-09-28 | Restored lower-bound percentile and added physics shims to Vitest harness. |
| 1.3 | Refresh scenario fixtures and validate tests | Complete | 2025-09-28 | Regenerated metrics snapshots for escort, bomber, and artillery scenarios. |
| 1.4 | Update task status and summary | Complete | 2025-09-28 | Finalised task log and marked completion. |

## Progress Log

### 2025-09-28

- Documented AI metrics resilience requirements and design plan.
- Created TASK144 tracking entry with initial implementation steps.
- Reinstated percentile helper semantics, expanded metrics test stubs, and regenerated scenario metrics fixtures.
- Confirmed Vitest harness suite and full `npm test` pass without regressions.
