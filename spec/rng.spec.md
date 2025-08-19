# rng.js — Specification

## Purpose

This document specifies the responsibilities, public API, determinism contract, and testing guidance for `src/rng.js` in the SpaceAutoBattler project.

`src/rng.js` provides a tiny seeded random number utility used by the deterministic simulation. All gameplay randomness in `src/` must come from this module (or a derivative per-entity PRNG seeded from it) so tests and recorded replays are reproducible.

## Public API

All functions are exported from `src/rng.js` as named exports.

### srand(seed)

- Purpose: seed the module's PRNG with a 32-bit unsigned integer.
- Input: `seed` (number) — will be coerced to a 32-bit unsigned integer via `>>> 0`.
- Effect: subsequent calls to `srandom()`, `srange()`, and `srangeInt()` will produce a deterministic sequence derived from this seed.
- Returns: none.

Example: `srand(12345);`

### unseed()

- Purpose: disable seeded mode so the module falls back to `Math.random()`.
- Effect: turns off deterministic mode until `srand()` is called again.
- Returns: none.

### srandom()

- Purpose: return a pseudorandom floating-point number in [0, 1).
- Behavior: when seeded via `srand`, uses a 32-bit linear congruential generator (LCG) implementation (Numerical Recipes constants) returning `_seed / 2**32`.
- When unseeded, returns `Math.random()`.
- Returns: number in [0, 1).

Notes: the implementation uses unsigned 32-bit arithmetic and updates internal `_seed` on each call.

### srange(a = 0, b = 1)

- Purpose: return a pseudorandom floating-point number in [a, b).
- Inputs: `a` (number, default 0), `b` (number, default 1).
- Uses `srandom()` internally and scales the result into the requested range.
- Returns: number >= a and < b (subject to floating point precision).

### srangeInt(a, b)

- Purpose: return a pseudorandom integer in the inclusive range [a, b].
- Inputs: `a` (number), `b` (number).
- Behavior: uses `srange(a, b + 1)` and floors the result to produce an integer in [a, b] inclusive.
- Returns: integer.

## Determinism contract

- When `srand(seed)` is called, the module enters seeded deterministic mode. From that point, the sequence of values produced by `srandom()`, `srange()`, and `srangeInt()` MUST be fully deterministic and repeatable across runs on all supported platforms (Node.js and browsers) as long as the same seed and identical call-order is used.
- The module stores an internal 32-bit unsigned `_seed`. The implementation MUST preserve the current LCG constants and arithmetic order (multiplication, addition, >>> 0) to avoid cross-platform drift.
- Consumers that require per-entity independent randomness should derive seeds deterministically (for example: `hash(globalSeed, entityId)` or calling `srangeInt` to produce a per-entity seed) rather than calling `srand` globally in multiple places. This preserves a single global stream and avoids accidental desynchronization.

## Usage guidance and best practices

- Always call `srand(seed)` once at the start of simulation/test runs that must be repeatable. Example: tests should call `srand(1)` before building simulation states and calling `simulateStep`.
- Do not mix seeded and unseeded calls in the same deterministic scenario. Calling `unseed()` or relying on `Math.random()` will break repeatability.
- Avoid reseeding mid-simulation unless intentionally resetting global randomness; if reseeding is needed, document it and write tests that cover the change in sequence.
- For per-entity RNG needs (carriers, procedural offsets), prefer deriving a per-entity seed from the global seed (deterministically) or consuming numbers from the global PRNG in a stable order.

## Edge cases and expected behavior

- `srand` coercion: non-integer seeds will be coerced via `>>> 0`. Negative values will be converted to their unsigned 32-bit equivalent.
- `srange(a,b)` when `a === b`: returns `a` (since the underlying `srandom()` times zero range will produce `a`). Consumers should avoid calling with equal endpoints unless that's intended.
- `srangeInt(a,b)` when `a > b`: current implementation will produce values based on `srange(a, b+1)` then floor; callers should not pass a > b. Tests should assert behavior or the code should be updated to guard and swap endpoints.
- Unseeded mode: if `srand` has not been called or `unseed()` was called, `srandom()` delegates to `Math.random()` and is non-deterministic.

## Tests and acceptance criteria

Create Vitest unit tests under `test/` to ensure the behavior below. Each test should seed the RNG where determinism is expected.

1) Deterministic sequence

- Arrange: call `srand(123456789)`.
- Act: call `srandom()` N times (N >= 5) collecting values.
- Assert: repeated runs with the same seed produce identical arrays of values.

2) srange scaling

- Arrange: `srand(1)`.
- Act: call `srange(10, 20)` multiple times.
- Assert: values are >= 10 and < 20 and repeat across runs with the same seed.

3) srangeInt inclusivity

- Arrange: `srand(42)`.
- Act: call `srangeInt(0, 2)` many times and collect seen values.
- Assert: only integers 0,1,2 are present and distribution matches expected randomness; repeated runs with same seed produce same sequence.

4) unseed fallback

- Arrange: call `unseed()`.
- Act: call `srandom()` and ensure value is in [0,1).
- Assert: value may differ across runs — test should only assert range and not equality.

5) Seed coercion

- Arrange: call `srand(-1)` and `srand(1.5)` in separate tests.
- Act/Assert: ensure internal coercion produces a valid 32-bit seed and subsequent `srandom()` calls do not throw and return numbers in [0,1).

6) Guard rails (recommended)

- Add a test that documents current behavior when `srangeInt(a,b)` is called with `a > b`. If the project prefers stricter behavior, change `srangeInt` to swap endpoints or throw; update spec accordingly.

## Performance and implementation notes

- `srandom()` is extremely cheap (single LCG step). Keep consumers calling it in hot loops rather than creating heavy per-call wrappers.
- The 32-bit LCG used is sufficient for gameplay randomness and determinism; it is not cryptographically secure and should not be used for anything requiring cryptographic randomness.

## Decision record guidance

If the LCG constants or algorithm are changed, add a short Decision Record in `.github/DECISIONS/` describing the rationale and the impact on recorded replays and tests. Updating the algorithm without adding tests that re-establish deterministic sequences will break existing recorded replays.

## Example — minimal deterministic smoke test (pseudo)

```js
import { srand, srandom } from '../src/rng.js';
import { expect } from 'vitest';

srand(123);
const seq = Array.from({ length: 5 }, () => srandom());
// run again and assert equality
```

---

Requirements coverage:

- Public API: described (srand, unseed, srandom, srange, srangeInt) — Done
- Determinism: explicit contract and test guidance — Done
- Edge cases: listed and recommended guards — Done
- Tests: suggested Vitest tests and examples — Done
