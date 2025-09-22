# TASK104 — AI Metrics Instrumentation & Tooling

## Goal
Deliver Phase 7 essentials from `plan/plan-ai-system.md` by adding AI decision metrics on `GameState`, exposing counters for debugging, and documenting their usage.

## Context
- Current AI manager lacks metrics to observe decision load or budget skips.
- `updateDecisionSystem` in `src/game/systems.ts` manages scheduling logic.
- `GameState.ai` is initialized in `src/game/state.ts` with manager defaults from `config.ts`.
- Debug/docs folder lacks AI v2 instrumentation notes.

## Tasks
1. Extend AI manager state with metrics counters (total decisions, skipped due to cadence, budget hits, last tick stats).
2. Update decision loop to populate metrics and reset per-tick fields.
3. Document metrics in `docs/` (short markdown) for QA/engineering reference.
4. Refresh memory files (`core-gameState`, `core-systems`, `activeContext`, `progress`).

## Definition of Done
- Metrics available at runtime via `state.ai.metrics`.
- Decision loop updates counters deterministically each tick.
- Documentation explaining metrics usage committed.
- Memory bank and task index updated; tests continue to pass.
