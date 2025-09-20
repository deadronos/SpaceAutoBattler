# core-rng.md

## Purpose

Short memory describing the deterministic seeded RNG used by the simulation: `src/utils/rng.ts`.

## Location

`src/utils/rng.ts`

## Summary

The repository uses a small seeded RNG (Lehmer/multiplicative linear congruential style) implemented in `src/utils/rng.ts`. The RNG is deterministic and intentionally simple so it can be used to seed simulation behavior (cooldown jitter, spawn variations) while preserving reproducibility across runs when the same seed is used.

Public API (summary):

- `class SeededRng { constructor(seed: number | string) }` — creates a reproducible RNG instance.
- `next()` — returns a float in [0, 1).
- `range(min, max)` — float in [min, max).
- `int(min, maxInclusive)` — integer in range.
- `pick(array)` — deterministic choice from an array.

Integration:

- `createGameState` in `src/game/state.ts` constructs a `SeededRng` and attaches it to the returned GameState as `state.rng` so all simulation code (ship spawn, cooldown jitter, etc.) can use a single deterministic RNG instance.

Notes:

- Preserve usage of `state.rng` for deterministic behaviors in tests and replays.

Tags: rng, deterministic, seeded
