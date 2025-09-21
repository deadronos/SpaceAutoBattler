# Memory — core-rng

File: `src/utils/rng.ts`

Responsibilities

- Seeded RNG for deterministic behavior in spawning and any simulation randomness.
- Instantiate as `new SeededRng(seed)`; prefer using the instance on `GameState` (`state.rng`).

Guidance

- Do not use `Math.random()` in simulation paths. Pipe all randomness through the seeded RNG.
