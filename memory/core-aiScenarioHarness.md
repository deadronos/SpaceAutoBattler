# Memory — core-aiScenarioHarness

Files: `test/support/aiScenarioHarness.ts`, `test/support/aiScenarioHarness/*` (test-only, not part of runtime)

Summary

- Provides a deterministic harness for running AI scenarios headlessly and producing normalized logs and KPI snapshots suitable for golden fixtures and fast regression testing.
- Harness is stabilized and intentionally minimal; only `runAIScenario`, `collectTestMetrics`, and exported types form the supported surface.
- **Important:** This harness is strictly test-only and does not ship with the runtime. Use `updateGame()` ticks for production simulation. No imports from `test/support/aiScenarioHarness` are allowed under `src/**`.
- A dedicated Vitest guard spec asserts that no `test/support/aiScenarioHarness` imports appear in runtime modules.

Primary responsibilities

- Build harness-friendly `GameState` and `ShipEntity` shapes (often shims that avoid requiring a full Rapier runtime) with configurable ships, seeded traits, and optional harness-only velocities.
- Step the AI scheduler by calling `runDecisionTick` (or `updateDecisionSystem`) and record per-tick command outputs (intent, target id, heading, thrust, score, and LOD) plus metrics summaries.
- Normalize and round logs for stable JSON fixtures to be used in Vitest comparisons.

Determinism guarantees

- All harness runs are deterministic and reproducible when seeded with the same `AIScenarioConfig` and `seed` value.
- Uses `SeededRng` from `src/utils/rng.ts` to ensure stable trait generation and decision sequences across test runs.
- Per-ship trait seeds are derived deterministically from the scenario seed, ensuring both reproducibility and independence from test ordering.

Implementation notes

- The harness creates a `HarnessGameState` type that extends `GameState` with `queries` adapted for non-physics execution and small helper shims (`createPhysicsWorldShim`, `createRapierShim`) so AI logic can be exercised without the full Rapier WASM runtime.
- Determinism is preserved by passing a `SeededRng` instance into the harness (or deriving per-ship trait seeds deterministically). The harness exposes configuration knobs for tick interval, ship counts, and initial formations.
- Harness helpers (`serializeCommands`, `serializePositions`, metrics aggregation) convert runtime structures into compact JSON-friendly arrays and objects that remain stable across runs when seeded.

Usage patterns

- Tests use the harness to run short scenarios (escort, intercept, artillery retreat) and assert the normalized command logs match stored fixtures in `test/vitest/fixtures`.
- The harness is intentionally conservative in features and avoids per-frame physics complexity; for integration tests that require physics, prefer spinning a `createGameState()` instance and running `updateGame` ticks instead.
- See `guides/TEST_HARNESS_PATTERNS.md` for detailed examples and best practices.

References

- `test/support/aiScenarioHarness.ts` (main entry point)
- `test/support/aiScenarioHarness/` (sub-modules: types, factories, logging, metrics, integration)
- `test/vitest/ai-scenario-harness.spec.ts` (golden fixture regression tests)
- `test/vitest/ai-metrics.spec.ts` (metrics validation)
- `guides/TEST_HARNESS_PATTERNS.md` (how to write AI tests)
- `guides/AI_DEPRECATION_GUIDE.md` (removed features and migration)
