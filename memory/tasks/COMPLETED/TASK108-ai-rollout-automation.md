# TASK108 — AI V2 Rollout & Automation

## Summary
- Execute Phase 10 of `plan/plan-ai-system.md` to prepare AI V2 for wider rollout with automation safeguards.
- Integrate perf/determinism checks into CI and document operational toggles + rollback paths.
- Coordinate enabling the AI V2 flag (when ready) with supporting docs and troubleshooting guidance.

## Status
- Owner: automated agent (2025-09-24)
- State: Completed

## Subtasks
- [x] Wire `npm run perf:ai-budget` (and scenario harness) into CI with configurable budgets (`npm run test:ci`).
- [x] Draft `docs/ai-v2-rollout.md` covering toggles, metrics, recovery steps, and flag-on criteria.
- [x] Provide automation hooks or scripts to flip AI V2 defaults per environment while preserving legacy fallback.
- [x] Update memory/tasks once rollout date and gating metrics are finalised.

## Notes
- Environment flag `AI_V2_DEFAULT=on` now controls the default; rollout playbook documents required checks and rollback steps.
- Continue coordinating with QA/ops on budget thresholds before making the new `test:ci` target mandatory in shared pipelines.
