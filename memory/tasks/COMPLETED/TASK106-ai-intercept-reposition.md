# TASK106 — AI Intercept & Reposition Intents

## Summary

- Implement Phase 8 of `plan/plan-ai-system.md` to broaden AI V2 intent coverage.
- Add deterministic scoring/executor logic for `Intercept`, `Reposition`, and `Regroup` flows tuned by profiles.
- Maintain parity with escort/VIP priorities while introducing lead targeting for fast threats.

## Status

- Owner: automated agent (2025-09-24)
- State: Completed

## Subtasks

- [x] Extend `selectIntent` to surface `Intercept`, `Reposition`, and `Regroup` candidates with deterministic tie-breaking.
- [x] Implement scoring helpers + executor paths for the new intents using pooled vectors and seeded RNG for variance.
- [x] Author `test/vitest/ai-intercept.spec.ts` (or equivalent) covering intercept band entry, regroup spacing, and regression of escort priorities.
- [x] Refresh docs/memory (plan, core-systems) once the new intents land.

## Notes

- Intercept intent now uses pooled vectors + quadratic lead solve; reposition/regroup share profile bands and posture gates.
- Docs/memory refreshed: `plan/plan-ai-system.md`, `memory/core-systems.md`, `docs/ai-v2-overview.md`.
