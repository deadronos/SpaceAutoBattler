# Active Context — SpaceAutoBattler

Current focuses (short-term):

- Monitor AI V2 validation suites (determinism, scoring, executors, legacy fallback) and keep them green during feature work.
- Track Phase 8–10 follow-up work (intercept/regroup intents, deterministic scenario harness, CI integration) while keeping legacy parity intact.
- Integrate the perf budget assertion into automation once CI hardware targets are finalized.
- Gather feedback on the HUD debug overlay and extend documentation with practical tuning scenarios.

Recent changes:

- Added Vitest suites for determinism (`ai-determinism`), scorer outputs (`ai-scorer`), executor behaviors (`ai-executor`), and legacy parity (`ai-regression`).
- Authored `scripts/perf/assert-ai-budget.ts` with `npm run perf:ai-budget` to guard the 300-ship tick budget.
- Introduced HUD `AiDebugOverlay`, UI toggles, and refreshed `docs/ai-v2-overview.md` with validation details.

Next steps:

- Phase 8: Implement intercept/reposition/regroup intents with deterministic scorers and executors.
- Phase 9: Add scenario-driven docs/tests (escort swap, artillery standoff) plus overlay capture flows.
- Phase 10: Wire perf harness + AI toggle coverage into CI before considering flag-on by default.

Updated: 2025-09-23
