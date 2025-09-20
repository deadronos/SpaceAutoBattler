# Active Context — SpaceAutoBattler

Current focuses (short-term):

- Fixes to AI passive behavior and deterministic edge-cases (branch `ai-passive-fix`).
- Improve unit test coverage for core AI decision logic and physics-message sync.
- Maintain canonical `GameState` and reduce module-level side effects.

Recent changes:

- Updated AI scoring helpers and several memory entries generated on 2025-09-02.

Next steps:

- Run full test suite and ensure `npx tsc --noEmit` passes on CI.
- Add a small deterministic replay test harness to `test/` to assert repeatable simulations.

Generated: 2025-09-15
