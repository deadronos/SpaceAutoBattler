# AI V2 Overview

_Updated: 2025-09-22_

## Goals

- Provide deterministic, profile-driven ship behaviors with varied intents (attack, kite, escort, flee) behind a feature flag.
- Share expensive queries via an AI blackboard so 300 ships can be processed within a fixed budget.
- Preserve existing gameplay by keeping legacy AI active when the flag is disabled.

## Architecture

- **AI Manager (`GameState.ai`)** — stores feature flag, tick interval (default 10 Hz), max ships per tick, accumulator, tick index, slice cursor, and escort assignments.
- **Blackboard (`GameState.blackboard`)** — caches ally centroids, team posture, nearest enemy per ship, and VIP threat mapping. Rebuilt each AI tick.
- **Profiles (`src/game/aiProfiles.ts`)** — describe desired engagement bands, aggression/patience knobs, class biases, and gates. Ships pick defaults on spawn via hull → profile mapping.
- **Decision System (`updateDecisionSystem`)** — round-robin scheduler evaluating intent utility scores; writes `AICommand` (heading, thrust, fire gating, targetId) into each ship’s `ai` component. Tie-breaking uses hashed `traitSeed` + tick index for determinism.
- **Execution (`prepareShips`)** — interprets `AICommand` each frame (orient, move, fire) or runs legacy nearest-target steering when AI V2 is disabled. Embedded turrets reuse the same target data.

## Feature Flag

- `config.ai.v2Enabled` defaults to `false`. Toggle at runtime (or via config) to switch between legacy AI and the new decision system.
- When disabled, AI blackboard still resets but no commands are written; legacy behavior remains untouched.

## Follow-ups

- Add deterministic Vitest suites covering scoring, escort assignment, and legacy fallback.
- Wire a UI toggle for QA and update docs once V2 becomes the default.
- Extend performance harness to assert AI tick budget at 300 ships.
