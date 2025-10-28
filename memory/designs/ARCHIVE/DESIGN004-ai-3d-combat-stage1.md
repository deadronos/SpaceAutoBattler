````markdown
# Design — AI 3D Combat Stage 1

**Date:** 2025-09-28  
**Owner:** Copilot agent  
**Related Issue:** #194  
**Requirements:** See `memory/requirements.md` (section 2025-09-28 — AI 3D Combat Stage 1).

## Goals

- Increase opening vertical dispersion so combat uses the full 3D volume.
- Preserve deterministic spawn geometry for seeded test harnesses.
- Introduce a controllable tick-rate experiment to evaluate faster AI cadence.
- Validate that the new cadence delivers the expected decision-tick throughput increase.

## Architecture Overview

```text
Seeder (SeededRng) → Spawn Planner (spawnInitialFleets) → Ship Entities
                                   ↓
                             SPAWN_CONFIG
                                   ↓
                AI Scheduler (state.ai.tickInterval) ← AI_CONFIG
                ↙                             ↘
        runAIScenario()                 Game Loop (createGameState)
```

- `SeededRng` stays the single source of randomness. Spawn planners must read from it in a deterministic order.
- `SPAWN_CONFIG` gains explicit knobs for vertical spread, anchor randomization, and initial separation.
- `AI_CONFIG` extends with baseline/experimental tick rates and a flag to toggle between them without hot-patching call sites.
- Both the runtime (`createGameState`) and harness (`runAIScenario`) consume the same effective tick interval to keep type coverage and determinism aligned.

## Data Flow

```mermaid
digraph G {
  seed[label="SeededRng(1337)"];
  spawn[label="spawnInitialFleets"];
  config[label="SPAWN_CONFIG\n(verticalSpreadFactor, anchorYRandomization, initialSeparationFactor)"];
  ships[label="Fleet Entities"];
  aiConfig[label="AI_CONFIG\n(tickRateHzBase, tickRateHzExperimental, tickRateHzExperiment)"];
  scheduler[label="AI Scheduler\n(state.ai.tickInterval)"];
  harness[label="runAIScenario"];
  metrics[label="First-Shot KPIs"];

  seed -> spawn;
  config -> spawn;
  spawn -> ships;
  ships -> scheduler;
  aiConfig -> scheduler;
  scheduler -> harness;
  harness -> metrics;
  aiConfig -> harness;
}
```

## Interfaces & Configuration

### SPAWN_CONFIG (existing object)

- `verticalSpreadFactor: number` — scalar multiplied by `WORLD_HALF` to derive absolute Y range.
- `anchorYRandomization: boolean` — enables per-team anchor offsets.
- `initialSeparationFactor: number` — multiplier applied to the global max weapon range to enforce separation.

Usage adjustments:

- `spawnInitialFleets` must apply `anchorYRandomization` and `verticalSpreadFactor` each time it draws positions.
- `spawnRandomShip` adopts `SPAWN_CONFIG.verticalSpreadFactor` to keep ad-hoc spawns aligned with fleet spawns.

### AI_CONFIG (existing object)

New properties:

- `tickRateHzBase: number` — baseline cadence (12 Hz) used when the experiment is disabled.
- `tickRateHzExperimental: number` — experimental cadence (15 Hz).
- `tickRateHzExperiment: boolean` — feature flag defaulting to `true`; respects env overrides `AI_TICKRATE_EXPERIMENT_ON/OFF`.
- `tickRateHz: number` — resolves to either base or experimental rate depending on `tickRateHzExperiment`.

Consumers (`createGameState`, `runAIScenario`) read `AI_CONFIG.tickRateHz` and `AI_CONFIG.tickRateHzExperiment` to initialize scheduler state and expose toggles to diagnostics.

## Algorithm Notes

1. **Initial Separation Enforcement**
   - Compute `maxRange` via `SHIP_STATS` and derive `separation = max(200, maxRange * SPAWN_CONFIG.initialSeparationFactor)`.
   - Anchor X values become `±separation / 2`. Team centroids must remain at least `separation` apart even after jitter.

2. **Vertical Spread Sampling**
   - Use deterministic RNG calls in the order: depth jitter → y offset → radial jitter. Maintain the existing call sequence so historical seeds remain valid while widening distribution.
   - Anchor offsets draw once per team: `(rng.next() - 0.5) * (verticalSpread * 0.5)`.
   - Median |y| across all spawned ships should land around 250–300 units with the default factor; add guardrails to clamp to world bounds.

3. **Tick Rate Resolution**
   - Read environment overrides early in the module to avoid repeated lookups (`AI_TICKRATE_EXPERIMENT_OFF` takes precedence over `_ON`).
   - Derive `effectiveTickRate` before exporting `AI_CONFIG` and reuse the value for both runtime and harness.
   - Surface both base and experimental rates for telemetry and tests without recomputing; throughput validation compares accumulated decision ticks against the theoretical ratio.

## Error Handling Matrix

| Scenario                                                      | Detection                                         | Response                                                  | Notes                                                  |
| ------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| Environment variable contains invalid boolean (e.g., `maybe`) | `readBooleanEnv` defaults to `false`              | Treat as unset; experiment remains enabled by default     | Avoid throwing so CI without env stays stable          |
| Spawn spread pushes ships outside world bounds                | Post-compute `Vector3` clamped via `clampToWorld` | Positions clamped to safe bounds; log not required        | Existing clamp handles this                            |
| Harness run without first-shot events                         | `metrics.firstShotTimes` empty                    | KPI p-values become `null`; tests assert guard branch     | Ensures baseline comparison test accounts for no shots |
| Experiment flag toggled mid-run                               | Scheduler reads flag only at initialization       | Documented limitation; per-frame toggling is out of scope | Future work: runtime toggle, not needed for Stage 1    |

## Unit Testing Strategy

1. `test/vitest/spawn-geometry.spec.ts`
   - Extend existing suite with:
     - Deterministic Y offsets snapshot (seed 1337).
     - Median |y| dispersion ≥ 200 assertion.
     - Updated separation guard verifying ≥ 1.5× `maxRange` exactly.

2. `test/vitest/ai-tick-rate.spec.ts`
   - New file validating:
     - Scheduler chooses 12 Hz when experiment disabled and 15 Hz when enabled.
     - Experimental run accumulates decision ticks within 5% of the ideal 15/12 ratio over a fixed-duration simulation.
   - Include cleanup restoring `AI_CONFIG` to avoid leaking state across tests.

3. Regression guard for `spawnRandomShip` to ensure it respects the shared spread factor (simple deterministic bound check).

## Performance Considerations

- 15 Hz scheduling increases AI decision work by 25%. Keep `AI_CONFIG.maxPerTick` unchanged for Stage 1; capture perf data as part of milestone validation.
- Spawn changes do not allocate new structures; they reuse existing `Vector3` instances to remain GC friendly.

## Open Questions / Follow-ups

- Should the experiment flag drive UI toggles or remain env-driven only? (Out of scope now; default to env only.)
- Future Stage 2 will tune role-specific vertical maneuvering; ensure current work does not preclude later adjustments.
- Capture new KPI baselines after implementing Stage 1 and link them in the PR for traceability.

````
