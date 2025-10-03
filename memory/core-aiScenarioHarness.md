# Memory — core-aiScenarioHarness

Files: `src/game/aiScenarioHarness.ts`, `src/game/aiScenarioHarness/*`

Summary

- Provides a deterministic harness for running AI scenarios headlessly and producing normalized logs and KPI snapshots suitable for golden fixtures and fast regression testing.

Primary responsibilities

- Build harness-friendly `GameState` and `ShipEntity` shapes (often shims that avoid requiring a full Rapier runtime) with configurable ships, seeded traits, and optional harness-only velocities.
- Step the AI scheduler by calling `runDecisionTick` (or `updateDecisionSystem`) and record per-tick command outputs (intent, target id, heading, thrust, score, and LOD) plus metrics summaries.
- Normalize and round logs for stable JSON fixtures to be used in Vitest comparisons.

Implementation notes

- The harness creates a `HarnessGameState` type that extends `GameState` with `queries` adapted for non-physics execution and small helper shims (`createPhysicsWorldShim`, `createRapierShim`) so AI logic can be exercised without the full Rapier WASM runtime.
- Determinism is preserved by passing a `SeededRng` instance into the harness (or deriving per-ship trait seeds deterministically). The harness exposes configuration knobs for tick interval, ship counts, and initial formations.
- Harness helpers (`serializeCommands`, `serializePositions`, metrics aggregation) convert runtime structures into compact JSON-friendly arrays and objects that remain stable across runs when seeded.

Usage patterns

- Tests use the harness to run short scenarios (escort, intercept, artillery retreat) and assert the normalized command logs match stored fixtures in `test/vitest/fixtures`.
- The harness is intentionally conservative in features and avoids per-frame physics complexity; for integration tests that require physics, prefer spinning a `createGameState()` instance and running `updateGame` ticks instead.

References

- `src/game/aiScenarioHarness.ts`, `src/game/aiScenarioHarness/stateFactory.ts`, `src/game/aiScenarioHarness/integration.ts`, `test/vitest/ai-scenario-harness.spec.ts`
