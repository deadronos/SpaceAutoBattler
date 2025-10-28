# TASK105 — AI V2 Validation & Tooling

## Summary

- Build the missing AI V2 validation harness promised in `plan/plan-ai-system.md`.
- Cover deterministic command streams, utility scoring snapshots, and executor invariants with Vitest.
- Reinstate a lightweight debug overlay for intent/band diagnostics when AI V2 is enabled.
- Provide an automated perf guard that fails when AI ticks exceed the configured budget at scale.
- Refresh docs/memory to mark phases 3–7 as complete and capture new tooling.

## Status

- Owner: automated agent (2025-09-22)
- State: Completed

## Subtasks

- [x] Add Vitest determinism spec that compares command streams across seeded runs.
- [x] Snapshot utility scores (attack/kite/escort/flee) under varying posture/traits.
- [x] Verify executor commands (band keeping, escort radius, fire gating) via unit tests.
- [x] Regression test legacy fallback with AI flag disabled.
- [x] Author `scripts/perf/assert-ai-budget.mjs` and wire npm script.
- [x] Implement HUD debug overlay + UI toggles tied to `uiStore`.
- [x] Update docs/memory/plan to reflect completed validation work.

## Notes

- Keep overlay behind opt-in toggle to avoid perf impact in production builds.
- Perf assertion should be configurable via env vars (ship count, ticks, budget) for CI flexibility.
