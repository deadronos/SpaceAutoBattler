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

- `config.ai.v2Enabled` defaults to `false`. Toggle at runtime (or via config) to switch between legacy AI and the new decision system.
- When disabled, AI blackboard still resets but no commands are written; legacy behavior remains untouched.

## Follow-ups

- Add deterministic Vitest suites covering scoring, escort assignment, and legacy fallback.
- Wire a UI toggle for QA and update docs once V2 becomes the default.
- Extend performance harness to assert AI tick budget at 300 ships.

## Debug Metrics

- `state.ai.metrics.lastDecisions` — number of ships evaluated during the most recent AI tick.
- `state.ai.metrics.lastSkipped` — ships skipped because they were outside their cadence window or lacked AI data.
- `state.ai.metrics.lastSliceSize` / `lastTotalShips` — slice size processed vs. total ships available.
- `state.ai.metrics.totalDecisions` / `totalSkipped` — lifetime counters useful for soak testing or replay analysis.
- `state.ai.metrics.budgetHits` — increments whenever the tick slice is smaller than the total ship count, flagging potential budget pressure.

Metrics reset counters only on state recreation; consumers should snapshot deltas if they need per-interval aggregates.
