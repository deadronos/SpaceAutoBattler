# Active Context — SpaceAutoBattler

Current focuses (short-term):

- Monitor AI V2 validation suites (determinism, scoring, executors, intercept/regroup selection, scenario harness, legacy fallback) and keep them green during feature work.
- Maintain the expanded AI scenario harness fixtures (escort, bomber intercept, artillery retreat) while keeping rollout playbook + `npm run test:ci` aligned.
- Gather feedback on the HUD debug overlay and extend documentation with practical tuning scenarios.

Recent changes:

- Added Vitest suites for determinism (`ai-determinism`), scorer outputs (`ai-scorer`), executor behaviors (`ai-executor`), and legacy parity (`ai-regression`).
- Authored `scripts/perf/assert-ai-budget.ts` with `npm run perf:ai-budget` to guard the 300-ship tick budget.
- Introduced HUD `AiDebugOverlay`, UI toggles, and refreshed `docs/ai-v2-overview.md` with validation details.

Next steps:

- Capture HUD overlay screenshots that illustrate intercept/reposition/regroup/bomber pursuit states for docs/QA follow-ups.
- Socialize the AI V2 rollout playbook with QA/ops, capture overlay screenshots for docs, and plan a dry-run with `AI_V2_DEFAULT=on`.
- Continue monitoring perf budget regressions as we scale ship counts; consider caching nearest-enemy queries if budgets tighten.

- Updated: 2025-09-25
