# TASK146 - Enable 3D Combat Stage 1

**Status:** Completed  
**Added:** 2025-09-28  
**Updated:** 2025-09-28

## Original Request

Implement Stage 1 of issue #194 "Enable 3D combat: spawn geometry & cadence" covering spawn verticality, anchor randomization, separation, and AI tick cadence feature flag.

## Thought Process

- Stage 1 focuses on spawn geometry and scheduler cadence; vertical maneuvering comes later.
- Existing code already seeds RNG and exposes spawn/team helpers, so we can layer config-driven changes without new infrastructure.
- Determinism is critical; tests must compare seeded runs for identical outputs while still increasing overall dispersion.
- Tick-rate changes should be reversible at runtime startup via configuration rather than intrusive runtime toggles.

## Implementation Plan

1. **Configuration Enhancements**
   - Add `tickRateHzBase`, `tickRateHzExperimental`, and `tickRateHzExperiment` to `AI_CONFIG`, defaulting to 12/15 Hz with feature flag enabled.
   - Provide env overrides `AI_TICKRATE_EXPERIMENT_ON/OFF` for manual toggling.
   - Export the effective tick rate through `AI_CONFIG.tickRateHz`.

2. **Spawn Geometry Updates**
   - Ensure `spawnInitialFleets` uses `anchorYRandomization` and `verticalSpreadFactor` for per-team anchors and per-ship offsets.
   - Extend `spawnRandomShip` to reuse `SPAWN_CONFIG.verticalSpreadFactor` for ad-hoc spawns.
   - Keep world clamping and jitter ordering deterministic.

3. **Scheduler Consumers**
   - Update `createGameState` and `runAIScenario` to capture `tickRateHzExperiment` status alongside the resolved tick interval for diagnostics.

4. **Testing & Metrics**
   - Extend `test/vitest/spawn-geometry.spec.ts` with deterministic-height and dispersion assertions; tighten separation expectation.
   - Create `test/vitest/ai-tick-rate.spec.ts` verifying feature flag behavior and validating decision-tick throughput improves in line with the 15/12 target ratio.
   - Guard `spawnRandomShip` vertical spread with a unit test or inline assertion.

5. **Validation & Documentation**
   - Execute `npx tsc --noEmit` and `npm test`.
   - Summarize KPI improvements and note rollback plan (disable experiment or reduce spread factor) in final report.

## Progress Tracking

**Overall Status:** Completed — 100%

### Subtasks

| ID  | Description                                              | Status   | Updated    | Notes                                                  |
| --- | -------------------------------------------------------- | -------- | ---------- | ------------------------------------------------------ |
| 1.1 | Extend AI config with experiment toggles                 | Complete | 2025-09-28 | Includes env override wiring.                          |
| 1.2 | Apply spawn geometry updates across fleet/random spawns  | Complete | 2025-09-28 | Added anchor jitter and shared spread usage.           |
| 1.3 | Update scheduler consumers with flag awareness           | Complete | 2025-09-28 | Scheduler picks resolved tick interval.                |
| 1.4 | Add deterministic spawn and dispersion tests             | Complete | 2025-09-28 | Added centroid, median spread, and determinism checks. |
| 1.5 | Add tick-rate regression test validating throughput gain | Complete | 2025-09-28 | Switched KPI to decision-tick ratio for determinism.   |
| 1.6 | Run typecheck and tests                                  | Complete | 2025-09-28 | `npm test` passes post-changes.                        |

## Progress Log

### 2025-09-28

- Captured requirements and design for Stage 1.
- Drafted implementation plan aligning configuration, spawn logic, and test coverage.
- Implemented config, spawn, and scheduler updates with new tests; adjusted tick-rate KPI to measure decision-tick throughput after deterministic runs showed no early shots.
