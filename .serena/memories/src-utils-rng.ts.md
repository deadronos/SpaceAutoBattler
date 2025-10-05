# src/utils/rng.ts

Path: src/utils/rng.ts
Last-Reviewed: 2025-10-05

Purpose: Deterministic, seeded RNG utility used by the simulation for reproducible runs and deterministic tests. Prefer `SeededRng` for any simulation-critical randomness.

Key exports / summary of implementation:

- `export class SeededRng` — A small, deterministic PRNG class with the following notable behavior:
  - Internal state: `state: number` (32-bit unsigned) initialized via `reset(seed: number)`; seed coerced and zero replaced with 1.
  - `next(): number` — Produces a pseudo-random float in (0, 1] using a Lehmer-style generator (multiplicative congruential) with multiplier `48271` and modulus `0x7fffffff` (glibc-style parameters). Returns `state / 0x7fffffff`.
  - `range(min: number, max: number): number` — Float in [min, max).
  - `int(min: number, max: number): number` — Integer in [min, max] (inclusive) implemented via `Math.floor(range(min, max + 1))`.
  - `pick<T>(values: readonly T[]): T` — Random element chooser.
  - `normal(mean = 0, stdDev = 1): number` — Gaussian sample using the Box–Muller transform (ensures non-zero uniform inputs before transform).

Notes & recommendations:
- This RNG is intentionally small and deterministic; do not replace this with `Math.random` for simulation-critical code or tests.
- The `GameState` factory (`createGameState`) seeds an instance of `SeededRng` (commonly using a default seed in tests), attach it on the returned `GameState` object, and all simulation code should read from that instance to remain deterministic.

References:
- `src/utils/rng.ts` (implementation)
- `src/game/state.ts` (seed wiring and use in factory)
