---
title: Design - RNG (seeded PRNG contract)
version: 1.0
date_created: 2025-08-20
last_updated: 2025-08-20
owner: SpaceAutoBattler Contributors
tags: [design, rng, determinism]
---

## Introduction

This specification defines the seeded random number generator contract implemented by `src/rng.js`. It is written to be explicit about determinism, API surface, and testable acceptance criteria.

## 1. Purpose & Scope

Purpose: Provide a deterministic RNG for gameplay logic so simulation runs and tests are reproducible.

Scope: `src/rng.js` and any consumer that needs deterministic randomness. Non-deterministic cosmetic randomness (renderer) is out of scope.

## 2. Definitions

- `srand(seed)`: seed the RNG with a 32-bit value.
- `srandom()`: returns float in [0,1).
- `srange(a,b)`: float in [a,b).
- `srangeInt(a,b)`: integer in [a,b] inclusive.

## 3. Requirements & Constraints

- **REQ-RNG-001**: Expose functions: `srand(seed)`, `unseed()`, `srandom()`, `srange(a,b)`, `srangeInt(a,b)`.
- **REQ-RNG-002**: When seeded via `srand`, RNG outputs must be deterministic and repeatable across Node.js and browsers given the same seed and call order.
- **CON-RNG-001**: Implementation must use unsigned 32-bit arithmetic and preserve LCG step order to avoid cross-platform drift.
- **GUD-RNG-001**: Consumers needing per-entity independent randomness should derive seeds deterministically rather than reseeding the global PRNG mid-simulation.

## 4. Interfaces & Data Contracts

- `srand(seed: number) -> void`
- `unseed() -> void`
- `srandom() -> number [0,1)`
- `srange(a=0,b=1) -> number in [a,b)`
- `srangeInt(a,b) -> integer in [a,b]`

## 5. Acceptance Criteria

- **AC-RNG-001**: Given `srand(12345)` and repeated calls to `srandom()`, When repeated across runs, Then the sequences are identical.
- **AC-RNG-002**: `srange(a,b)` returns values >= a and < b and repeats with same seed.
- **AC-RNG-003**: `srangeInt(a,b)` returns integers a..b inclusive and repeats with same seed.
- **AC-RNG-004**: `unseed()` causes `srandom()` to delegate to `Math.random()`.

## 6. Test Automation Strategy

- Use Vitest. Seed RNG in each deterministic test with `srand(seed)`.
- Tests: deterministic sequence, srange scaling, srangeInt inclusivity, unseed fallback, coercion of seed inputs.

## 7. Rationale & Context

- LCG is sufficient for gameplay repeatability; not for cryptography.
- Preserve algorithm order and constants to avoid invalidating recorded replays.

## 8. Dependencies

- Consumers: `src/simulate.js`, `src/entities.js`.

## 9. Examples & Edge Cases

Pseudocode:

```js
srand(123);
const a = srandom();
const b = srange(10,20);
const c = srangeInt(0,2);
```

Edge cases: seed coercion, a===b in srange, a>b in srangeInt (should be documented behavior).

## 10. Validation Criteria

- Vitest tests validate deterministic sequences and edge behaviors.

*** End of file
