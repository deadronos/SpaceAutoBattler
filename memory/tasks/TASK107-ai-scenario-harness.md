# TASK107 — AI Scenario Harness & Visual QA

## Summary
- Deliver Phase 9 of `plan/plan-ai-system.md` by adding deterministic battle scenarios and HUD validation tools.
- Provide headless scenario harnesses (escort swap, artillery standoff, bomber intercept) that emit golden logs for regression tests.
- Capture representative HUD `AiDebugOverlay` output via screenshots or automated UI flows for documentation.

## Status
- Owner: automated agent (2025-09-23)
- State: Planned

## Subtasks
- [ ] Implement scenario configuration format + runner that can execute without rendering and record per-tick summaries.
- [ ] Add Vitest (or dedicated script) assertions comparing scenario logs against golden fixtures under seeded RNG.
- [ ] Create Playwright or screenshot workflow to toggle the AI debug overlay and capture annotated output for docs.
- [ ] Update docs/memory (plan, docs/ai-*) with instructions for running the scenario harness.

## Notes
- Keep scenario seeds/versioning in memory to simplify log regeneration.
- Ensure harness respects perf budgets so it can run in CI without flakiness.
