# TASK103 — AI Trait Variance & Determinism

## Goal

Implement Phase 6 of `plan/plan-ai-system.md`: introduce deterministic per-ship trait modifiers (aggression, patience, dodge) seeded at spawn, apply them to AI utility scoring, and cover with Vitest fixtures to confirm deterministic outputs.

## Context

- AIState currently stores only a `traitSeed` and does not apply any variation to scoring.
- Utility scoring functions live in `src/game/systems.ts`.
- Ship spawn pipeline (`src/game/ships.ts`) seeds AIState.
- Deterministic RNG utilities exist at `src/utils/rng.ts`.

## Tasks

1. Extend AIState to include concrete `traits` multipliers (aggression/patience/dodge).
2. Generate trait multipliers from `traitSeed` during `createInitialAIState` (±10% variance, deterministic per seed).
3. Apply trait multipliers inside AI scoring (`scoreAttackIntent`, `scoreKiteIntent`, `scoreEscortIntent`, `scoreFleeIntent`).
4. Add Vitest coverage ensuring identical seeds yield identical trait multipliers and different seeds cover range.

## Definition of Done

- Trait multipliers persisted on AIState and used in scoring.
- Tests verifying determinism and expected modifier bounds.
- Relevant memory files updated (`core-ships`, `core-systems`, `activeContext`, `progress`).
