# TASK108 — AI V2 Rollout & Automation

## Summary
- Execute Phase 10 of `plan/plan-ai-system.md` to prepare AI V2 for wider rollout with automation safeguards.
- Integrate perf/determinism checks into CI and document operational toggles + rollback paths.
- Coordinate enabling the AI V2 flag (when ready) with supporting docs and troubleshooting guidance.

## Status
- Owner: automated agent (2025-09-23)
- State: Planned

## Subtasks
- [ ] Wire `npm run perf:ai-budget` (and scenario harness) into CI with configurable budgets.
- [ ] Draft `docs/ai-v2-rollout.md` covering toggles, metrics, recovery steps, and flag-on criteria.
- [ ] Provide automation hooks or scripts to flip AI V2 defaults per environment while preserving legacy fallback.
- [ ] Update memory/tasks once rollout date and gating metrics are finalised.

## Notes
- Coordinate with QA to define acceptable perf budget thresholds before making CI gating mandatory.
- Keep rollout reversible; document environment variables or config switches required for hotfixes.
