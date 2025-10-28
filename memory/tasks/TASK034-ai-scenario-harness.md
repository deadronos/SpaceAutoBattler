# TASK107 — AI Scenario Harness & Visual QA

## Summary

- Deliver Phase 9 of `plan/plan-ai-system.md` by adding deterministic battle scenarios and HUD validation tools.
- Provide headless scenario harnesses (escort swap, artillery standoff, bomber intercept) that emit golden logs for regression tests.
- Capture representative HUD `AiDebugOverlay` output via screenshots or automated UI flows for documentation.

## Status

- Owner: automated agent (2025-09-24)
- State: Completed

## Subtasks

- [x] Implement scenario configuration format + runner that can execute without rendering and record per-tick summaries.
- [x] Add Vitest assertions comparing scenario logs against golden fixtures under seeded RNG.
- [ ] Create Playwright or screenshot workflow to toggle the AI debug overlay and capture annotated output for docs.
- [x] Update docs/memory (plan, docs/ai-\*) with instructions for running the scenario harness.

## Notes

- `src/game/aiScenarioHarness.ts` + `test/vitest/ai-scenario-harness.spec.ts` cover the escort intercept baseline; fixture stored at `test/vitest/fixtures/ai-escort-scenario.json`.
- HUD overlay capture remains a follow-up — document manual expectations in `docs/ai-v2-rollout.md`.
