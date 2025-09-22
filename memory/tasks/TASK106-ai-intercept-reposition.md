# TASK106 — AI Intercept & Reposition Intents

## Summary
- Implement Phase 8 of `plan/plan-ai-system.md` to broaden AI V2 intent coverage.
- Add deterministic scoring/executor logic for `Intercept`, `Reposition`, and `Regroup` flows tuned by profiles.
- Maintain parity with escort/VIP priorities while introducing lead targeting for fast threats.

## Status
- Owner: automated agent (2025-09-23)
- State: Planned

## Subtasks
- [ ] Extend `selectIntent` to surface `Intercept`, `Reposition`, and `Regroup` candidates with deterministic tie-breaking.
- [ ] Implement scoring helpers + executor paths for the new intents using pooled vectors and seeded RNG for variance.
- [ ] Author `test/vitest/ai-intercept.spec.ts` (or equivalent) covering intercept band entry, regroup spacing, and regression of escort priorities.
- [ ] Refresh docs/memory (plan, core-systems) once the new intents land.

## Notes
- Preserve legacy fallback determinism when AI V2 is disabled.
- Consider reusing existing projectile lead math before introducing new heavy calculations.
