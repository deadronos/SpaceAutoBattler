# Memory — core-rng

File: `src/utils/rng.ts`

Summary

- Implements a small deterministic PRNG used across the simulation: the `SeededRng` class.
- This RNG is intentionally simple and deterministic (Lehmer/LCG-style) so replays and unit tests are repeatable.

Responsibilities

- Provide deterministic streams for all simulation randomness (spawning, range variance, AI tie-breaks, procedural visual seeds, etc.).
- Expose convenience helpers used throughout the codebase: `next()`, `range`, `int`, `pick`, and `normal`.
- Be instantiated on `GameState` as `state.rng` and used by all systems that need reproducible randomness.

Implementation notes (authoritative)

- Location: `src/utils/rng.ts`.
- Class: `SeededRng` — uses a Lehmer-style multiplier (48271) and modulus 0x7fffffff to produce 32-bit deterministic outputs.
- Public API:
  - `constructor(seed: number)` — creates the RNG and calls `reset(seed)`.
  - `reset(seed: number): void` — sets internal state, normalized to a non-zero unsigned int.
  - `next(): number` — returns a deterministic float in (0, 1].
  - `range(min: number, max: number): number` — returns a continuous number between min (inclusive) and max (exclusive).
  - `int(min: number, max: number): number` — returns an integer sampled between min and max, inclusive.
  - `pick<T>(values: readonly T[]): T` — returns an item from the array using a seeded index.
  - `normal(mean = 0, stdDev = 1): number` — Box–Muller transform producing a normal-distributed sample.

Practical guidance

- Always prefer `state.rng` over constructing ad-hoc `SeededRng` instances unless you intentionally want a local, independent stream (for example when deriving weapon-range variance from a ship-local `traitSeed`).
- Default `GameState` seed: `createGameState()` constructs `state.rng = new SeededRng(1337)` by default — tests often override the RNG seed for deterministic scenarios.
- Never use `Math.random()` inside simulation logic — this will break determinism and replay fidelity.

Testing guidance

- Unit tests should set `state.rng.reset(seed)` at the start of a scenario to make run outputs deterministic and comparable to golden fixtures.
- When verifying statistical behavior (e.g., normal sampling), use fixed seeds and multiple samples to assert distribution properties deterministically.

References

- `src/utils/rng.ts` — authoritative implementation
- `src/game/state.ts` — `state.rng` instantiation and usage sites
