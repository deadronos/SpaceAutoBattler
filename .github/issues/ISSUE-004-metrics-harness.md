# Metrics harness and deterministic tests for AI experiments

Labels: test, ci, enhancement

## Summary

Add a small test harness and deterministic Vitest specs that run seeded simulated scenarios and collect the acceptance metrics defined in `plan/plan-ai-improvement-v0.1.1.md` (time-to-first-shot p50/p90, vertical dispersion, in-band time, attack posture percentage).

## Target files

- `test/vitest/ai-metrics.spec.ts`
- `src/game/blackboard.ts` or `src/game/systems.ts` instrumentation locations (collect metrics)

## Implementation steps

1. Create `test/vitest/ai-metrics.spec.ts` with seeded runs (seed=1337) for at least three scenarios: 8v8, 12v12, 15v15. Use snapshot assertions for metrics.
2. Add lightweight metrics sink in code (exported function `collectTestMetrics()` or similar) to be called after simulation runs.
3. Ensure tests run fast; mock heavy renderers and physics where possible or run with simplified simulation tick counts.

## Acceptance criteria

- Tests pass deterministically and check the acceptance metric thresholds in plans.

## Notes

Keep tests small and fast; aim to run in CI as part of `npm test`.
