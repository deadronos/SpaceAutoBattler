---
applyTo: 'src/**'
description: 'Deterministic simulation rules and RNG usage for SpaceAutoBattler.'
---

# Determinism & RNG — Repo Rules

Receipt: "Preserve deterministic simulation behavior across runs and tests."

Plan: 1) Use the canonical seeded RNG for all simulation decisions; 2) Add deterministic replay tests; 3) Fail CI on nondeterministic usage.

Checklist:

- [ ] Only use the seeded RNG exported from `src/utils/rng.ts` for simulation/AI/decision code. Do not call `Math.random()` in sim code.
- [ ] Keep all simulation state on the canonical `GameState` type (`src/types/index.ts`). Deterministic outputs must derive solely from GameState + seeded RNG + deterministic inputs.
- [ ] Document seed sourcing: tests should seed the RNG explicitly; gameplay may derive a seed from configuration. Record seed policy in this file.
- [ ] Add a deterministic replay unit test that: seed RNG, run N ticks, snapshot a compact representation of GameState, and assert equality on replay.
- [ ] Make nondeterministic functions (crypto, Date.now(), setTimeout drift) explicit and isolated from core simulation loops. Wrap or mock them in tests.

Notes:

- Violations of these rules are considered regressions. CI should run the replay test on PRs that touch simulation, AI, or physics code.
