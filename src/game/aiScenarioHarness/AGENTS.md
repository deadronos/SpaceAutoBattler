```markdown
# Agents Guide: src/game/aiScenarioHarness

- Purpose: Headless AI scenario harnesses used for deterministic AI testing and golden-log regression tests.
- Determinism: Always seed the RNG and snapshot `GameState` slices relevant to the scenario to create repeatable baselines.
- Tests: Provide golden logs and small fixtures that drive the harness with known seeds to assert behaviour.
```
