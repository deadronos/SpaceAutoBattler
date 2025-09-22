# AI V2 Overview

_Updated: 2025-09-22_

## Goals

- Provide deterministic, profile-driven ship behaviors with varied intents (attack, kite, escort, flee) behind a feature flag.
- Share expensive queries via an AI blackboard so 300 ships can be processed within a fixed budget.
- Preserve existing gameplay by keeping legacy AI active when the flag is disabled.

## Architecture

- **AI Manager (`GameState.ai`)** — stores feature flag, tick interval (default 10 Hz), max ships per tick, accumulator, tick index, slice cursor, escort assignments, and live metrics (per-tick/total decisions, skipped ships, budget hits).
- **Blackboard (`GameState.blackboard`)** — caches ally centroids, team posture, nearest enemy per ship, and VIP threat mapping. Rebuilt each AI tick.
- **Profiles (`src/game/aiProfiles.ts`)** — describe desired engagement bands, aggression/patience knobs, class biases, and gates. Ships pick defaults on spawn via hull → profile mapping.
- **Traits (`src/game/aiTraits.ts`)** — deterministic per-ship modifiers (±10%) seeded at spawn to vary aggression, patience, and dodge behavior without breaking determinism.
- **Decision System (`updateDecisionSystem`)** — round-robin scheduler evaluating intent utility scores; writes `AICommand` (heading, thrust, fire gating, targetId) into each ship’s `ai` component. Tie-breaking uses hashed `traitSeed` + tick index for determinism.
- **Execution (`prepareShips`)** — interprets `AICommand` each frame (orient, move, fire) or runs legacy nearest-target steering when AI V2 is disabled. Embedded turrets reuse the same target data.

## Feature Flag

- `config.ai.v2Enabled` defaults to `false`. Toggle at runtime (or via config/UI) to switch between legacy AI and the new decision system.
- The HUD controls expose "AI V2" and "AI Debug" toggles so QA can exercise the system without rebuilding.
- When disabled, AI blackboard still resets but no commands are written; legacy behavior remains untouched.

## Debug Overlay

- `AiDebugOverlay` in `Hud.tsx` surfaces per-tick metrics (decisions, skipped ships, slice size, budget hits) and the top intent rows (intent, score, band error, LOD, target).
- Overlay refreshes at ~4 Hz and stays opt-in via UI store flag to avoid production perf impact.
- Team postures are displayed alongside budget warnings to speed up tuning.

## Validation

- **Determinism:** `test/vitest/ai-determinism.spec.ts` builds two seeded states and compares command histories over 40 ticks.
- **Utility scoring:** `test/vitest/ai-scorer.spec.ts` snapshots attack/kite/escort/flee scores across posture, HP, and VIP threat cases.
- **Executors:** `test/vitest/ai-executor.spec.ts` verifies band keeping, escort radius adherence, and fire gating.
- **Legacy regression:** `test/vitest/ai-regression.spec.ts` ensures the flag-off path matches legacy steering.
- **Perf guard:** `npm run perf:ai-budget` launches `scripts/perf/assert-ai-budget.mjs`, spawning 300 fighters and failing if the average AI tick exceeds the configurable budget.

## Follow-ups

- Evaluate higher tick rates once perf headroom is confirmed by the budget script.
- Expand documentation with scenario tuning guides (escort posture tuning, artillery offsets).
- Monitor overlay feedback and consider exposing aggregated metrics (per-minute averages) if requested by designers.

## Debug Metrics

- `state.ai.metrics.lastDecisions` — number of ships evaluated during the most recent AI tick.
- `state.ai.metrics.lastSkipped` — ships skipped because they were outside their cadence window or lacked AI data.
- `state.ai.metrics.lastSliceSize` / `lastTotalShips` — slice size processed vs. total ships available.
- `state.ai.metrics.totalDecisions` / `totalSkipped` — lifetime counters useful for soak testing or replay analysis.
- `state.ai.metrics.budgetHits` — increments whenever the tick slice is smaller than the total ship count, flagging potential budget pressure.

Metrics reset counters only on state recreation; consumers should snapshot deltas if they need per-interval aggregates.
