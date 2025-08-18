---
title: Simulation Design Specification
version: 1.0
date_created: 2025-08-19
last_updated: 2025-08-19
owner: SpaceAutoBattler Team
tags: [design, simulation, contract, determinism]
---

# Simulation Design Specification

This specification defines the requirements, constraints, interfaces, and validation strategy for the deterministic game simulation used by SpaceAutoBattler. It is written to be unambiguous and machine-friendly so that engineers and generative AIs can reliably consume and implement the simulation contract.

## 1. Purpose & Scope

Purpose: Define the precise behavior and public contract of the simulation stepper (time-step), including data shapes, side-effects, determinism rules, and acceptance tests.

Scope: Applies to the deterministic simulation code in `src/simulate.js`, related entities in `src/entities.js`, and the seeded RNG in `src/rng.js`. Audience: engine developers, test authors, renderer authors, and automation agents.

Assumptions:
- The simulation runs in discrete time-steps and mutates a single `state` object passed to it.
- Rendering is separate and consumes the simulation state and its emitted events.

## 2. Definitions

- simulateStep: The function that advances simulation by a delta time. Signature required in this repository (see Section 4).
- state: The single mutable object representing world state passed to `simulateStep`.
- bounds: The playfield bounds object (at least `{ W, H }`).
- event arrays: `state.explosions`, `state.shieldHits`, `state.healthHits` — arrays that the simulation may push event objects into for the renderer to consume.
- determinism: Given the same initial state and RNG seed, repeated runs produce identical simulation outcomes.
- seeded RNG: The deterministic random number generator exported from `src/rng.js` (functions like `srand`, `srange`, etc.).

## 3. Requirements, Constraints & Guidelines
- **REQ-001**: The simulation must expose a function `simulateStep(state, dt, bounds)` that advances the state by `dt` seconds and returns nothing (mutates `state`).
# Simulation Design Specification

This specification defines the requirements, constraints, interfaces, and validation strategy for the deterministic game simulation used by SpaceAutoBattler. It is written to be unambiguous and machine-friendly so that engineers and generative AIs can reliably consume and implement the simulation contract.

## Purpose & Scope

Purpose: Define the precise behavior and public contract of the simulation stepper (time-step), including data shapes, side-effects, determinism rules, and acceptance tests.

Scope: Applies to the deterministic simulation code in `src/simulate.js`, related entities in `src/entities.js`, and the seeded RNG in `src/rng.js`. Audience: engine developers, test authors, renderer authors, and automation agents.

Assumptions:

- The simulation runs in discrete time-steps and mutates a single `state` object passed to it.
- Rendering is separate and consumes the simulation state and its emitted events.

## Definitions

- `simulateStep`: The function that advances simulation by a delta time. Signature required in this repository (see Section 4).
- `state`: The single mutable object representing world state passed to `simulateStep`.
- `dt`: Delta time (seconds) to advance the simulation.
- `bounds`: The playfield bounds object (at least `{ W, H }`).
- `event arrays`: `state.explosions`, `state.shieldHits`, `state.healthHits` — arrays that the simulation may push event objects into for the renderer to consume.
- `determinism`: Given the same initial state and RNG seed, repeated runs produce identical simulation outcomes.
- `seeded RNG`: The deterministic random number generator exported from `src/rng.js` (functions like `srand`, `srange`, etc.).

## Requirements, Constraints & Guidelines

- **REQ-001**: The simulation must expose a function `simulateStep(state, dt, bounds)` that advances the state by `dt` seconds and returns nothing (mutates `state`).

- **REQ-002**: `simulateStep` must only mutate the provided `state` object and not perform any DOM or Canvas rendering.

- **REQ-003**: The function must emit (push) numeric, minimal event objects into the following arrays when appropriate: `state.explosions`, `state.shieldHits`, `state.healthHits`.

- **REQ-004**: Event shapes must follow these contracts:

  - Explosion: `{ x: number, y: number, team: string|number, id?: string|number }`
  - ShieldHit: `{ id: number, hitX: number, hitY: number, team: string|number, amount: number }`
  - HealthHit: `{ id: number, hitX: number, hitY: number, team: string|number, amount: number }`

- **REQ-005**: Bullets created by ships must include an `ownerId` property so XP / kill crediting is unambiguous.

- **REQ-006**: All randomness that affects simulation outcomes must come exclusively from the seeded RNG in `src/rng.js`. The simulation must not use `Math.random()` for gameplay logic. Renderer-only cosmetic randomness may use `Math.random()`.

- **REQ-007**: `simulateStep` must be deterministic when the seeded RNG is set to a known value (via `srand(seed)`) and given identical inputs.

- **SEC-001**: The simulation must not leak secrets or make network calls.

- **CON-001**: The simulation must run synchronously and be suitable for fast unit-testing; it must avoid blocking I/O.

- **GUD-001**: Keep event objects minimal and numeric to simplify renderer replay and reduce bundle size.

## Interfaces & Data Contracts

Function signature (required):

```js
// Required function signature
simulateStep(state, dt, bounds)
```

State shape (partial, required fields for simulation contract):

```js
{
  ships: Array<Ship>,
  bullets: Array<Bullet>,
  explosions: Array,    // simulation may push { x, y, team }
  shieldHits: Array,    // simulation may push { id, hitX, hitY, team, amount }
  healthHits: Array,    // simulation may push { id, hitX, hitY, team, amount }
  // ...other engine fields (score, timers, rngState, etc.)
}
```

Ship (required properties used by simulation):

```js
{
  id: number,
  x: number, y: number,
  vx: number, vy: number,
  hp: number,
  shield: number,
  team: string|number,
  // progression fields
  xp?: number,
  level?: number,
}
```

Bullet (required properties):

```js
{
  id: number,
  x: number, y: number,
  vx: number, vy: number,
  dmg: number,
  team: string|number,
  ownerId: number, // REQ-005
}
```

Event shapes (examples):

```js
state.explosions.push({ x: ship.x, y: ship.y, team: ship.team, id: ship.id });
state.shieldHits.push({ id: ship.id, hitX: x, hitY: y, team: ship.team, amount: absorbed });
state.healthHits.push({ id: ship.id, hitX: x, hitY: y, team: ship.team, amount: hpDamage });
```

Error modes:

- If `state` is missing expected arrays (`explosions`, `shieldHits`, `healthHits`), `simulateStep` should create them (defensive) or clearly document that callers must provide them. Prefer creating them to ease test setup.

## Acceptance Criteria

- **AC-001**: Given a seeded RNG and an initial `state` with one ship and one bullet on a collision course, When `simulateStep(state, dt, bounds)` runs until collision, Then `state.healthHits` contains an entry for the damage and `ownerId` of the bullet's ship is credited in XP bookkeeping.

- **AC-002**: Given `srand(seed)` and identical state inputs, When `simulateStep` executes N steps, Then the sequence of emitted events and final state must be byte-for-byte identical across runs.

- **AC-003**: Given a ship whose shield fully absorbs incoming damage, When damage is applied, Then `state.shieldHits` length increases and `state.healthHits` is not pushed for that hit.

- **AC-004**: Given a ship death, When death is detected in `simulateStep`, Then `state.explosions` contains an explosion object with coordinates and team, and the ship is removed from `state.ships` or marked dead per implementation convention (documented behavior).

- **AC-005**: Given an invalid `state` missing event arrays, When `simulateStep` runs, Then it creates missing `explosions`, `shieldHits`, and `healthHits` arrays and proceeds without throwing.

## Test Automation Strategy

- Test Levels: Unit, Integration

- Frameworks: Vitest (existing project tests use Vitest). Use `test/` folder to add tests.

- Test Data Management: Tests should construct minimal `state` objects in-memory and call `srand(seed)` before calling `simulateStep` to ensure determinism. No external resources.

- CI/CD Integration: Add/maintain Vitest runs in CI pipeline. Use `npm test` to run tests locally and in CI.

- Coverage Requirements: Aim for >= 80% coverage for simulation-critical modules (`src/simulate.js`, `src/entities.js`).

- Performance: Add a microbenchmark test that steps a reasonably-sized `state` (e.g., 100 ships, 1000 bullets) for 100 steps to assert no pathological slowdowns.

Suggested test cases (minimum):

- simulate-step-basic: one ship, one bullet collision -> assert shield/health events and XP assignment.
- simulate-determinism: seed RNG, run steps, record serialized state/events, rerun and compare equality.
- simulate-shield-absorb: ensure shieldHits emitted but not healthHits when shield absorbs.

Event shapes (examples):

```js
state.explosions.push({ x: ship.x, y: ship.y, team: ship.team, id: ship.id });
state.shieldHits.push({ id: ship.id, hitX: x, hitY: y, team: ship.team, amount: absorbed });
state.healthHits.push({ id: ship.id, hitX: x, hitY: y, team: ship.team, amount: hpDamage });
```

Error modes:

- If `state` is missing expected arrays (`explosions`, `shieldHits`, `healthHits`), `simulateStep` should create them (defensive) or clearly document that callers must provide them. Prefer creating them to ease test setup.

## Acceptance Criteria

- **AC-001**: Given a seeded RNG and an initial `state` with one ship and one bullet on a collision course, When `simulateStep(state, dt, bounds)` runs until collision, Then `state.healthHits` contains an entry for the damage and `ownerId` of the bullet's ship is credited in XP bookkeeping.

- **AC-002**: Given `srand(seed)` and identical state inputs, When `simulateStep` executes N steps, Then the sequence of emitted events and final state must be byte-for-byte identical across runs.

- **AC-003**: Given a ship whose shield fully absorbs incoming damage, When damage is applied, Then `state.shieldHits` length increases and `state.healthHits` is not pushed for that hit.

- **AC-004**: Given a ship death, When death is detected in `simulateStep`, Then `state.explosions` contains an explosion object with coordinates and team, and the ship is removed from `state.ships` or marked dead per implementation convention (documented behavior).

- **AC-005**: Given an invalid `state` missing event arrays, When `simulateStep` runs, Then it creates missing `explosions`, `shieldHits`, and `healthHits` arrays and proceeds without throwing.

## Test Automation Strategy

- Test Levels: Unit, Integration

- Frameworks: Vitest (existing project tests use Vitest). Use `test/` folder to add tests.

- Test Data Management: Tests should construct minimal `state` objects in-memory and call `srand(seed)` before calling `simulateStep` to ensure determinism. No external resources.

- CI/CD Integration: Add/maintain Vitest runs in CI pipeline. Use `npm test` to run tests locally and in CI.

- Coverage Requirements: Aim for >= 80% coverage for simulation-critical modules (`src/simulate.js`, `src/entities.js`).

- Performance: Add a microbenchmark test that steps a reasonably-sized `state` (e.g., 100 ships, 1000 bullets) for 100 steps to assert no pathological slowdowns.

Suggested test cases (minimum):

- simulate-step-basic: one ship, one bullet collision -> assert shield/health events and XP assignment.
- simulate-determinism: seed RNG, run steps, record serialized state/events, rerun and compare equality.
- simulate-shield-absorb: ensure shieldHits emitted but not healthHits when shield absorbs.
- **EXT-001**: None — Simulation is self-contained and must not call external systems.

### Third-Party Services

- **SVC-001**: None required. Dev tooling uses Vitest and esbuild but they are not part of runtime simulation.

### Infrastructure Dependencies

- **INF-001**: Node.js dev environment for running tests/builds. CI must run `npm test`.

### Data Dependencies

- **DAT-001**: None — state is in-memory.

### Technology Platform Dependencies

- **PLT-001**: JavaScript runtime (Node.js) for tests and browser for rendering. No version pin required in this spec; follow project package.json.

### Compliance Dependencies

- **COM-001**: No regulatory constraints apply.

## Examples & Edge Cases

Example: basic simulateStep usage

```js
import { srand } from '../src/rng.js';
import { simulateStep } from '../src/simulate.js';

srand(12345);
const state = {
  ships: [{ id: 1, x: 10, y: 10, vx: 0, vy: 0, hp: 10, shield: 5, team: 'red' }],
  bullets: [{ id: 99, x: 0, y: 10, vx: 10, vy: 0, dmg: 6, team: 'blue', ownerId: 2 }],
  explosions: [], shieldHits: [], healthHits: []
};

simulateStep(state, 0.1, { W: 800, H: 600 });
// After repeated steps until collision: expect state.shieldHits or state.healthHits to contain entries
```

Edge cases to test and document:

- Zero or negative `dt` values: `simulateStep` should treat `dt <= 0` as a no-op.
- Extremely large `dt` values: ensure stable behavior (either clamp or simulate multiple sub-steps internally and document approach).
- Simultaneous collisions: multiple bullets hitting a ship in the same step should be applied deterministically (well-defined order — e.g., bullet array order) and XP attributed deterministically.
- Ownership edge cases: bullets with missing `ownerId` should be treated as neutral (no XP) and logged in tests.

## Validation Criteria

- Unit tests in `test/` covering the suggested test cases must pass.

- Determinism test: repeated runs with identical seed must produce identical JSON-serialized state+events.

- Linting/format: files should pass the project's linting rules (if present).

- Performance microbenchmark: stepping 100 ships and 1000 bullets for 100 steps should complete within an acceptable time (define threshold in CI if needed).

## Related Specifications / Further Reading

- `spec/spec-design-renderer.md` — renderer contract and how it consumes simulation events.
- `src/rng.js` — seeded RNG implementation and API (srand, unseed, srange, srangeInt).
- `src/simulate.js` and `src/entities.js` — canonical implementation files for the simulation and entities.

---

Requirements coverage summary:

- REQ-001..007: Defined in section 3 and mapped to acceptance criteria in section 5.
- AC-001..AC-005: Testable with Vitest per section 6.

Next steps:

- Add/adjust unit tests in `test/` to implement the suggested cases if any are missing.
- Ensure `src/simulate.js` adheres to the contract and create defensive array-initialization for event arrays.

<!-- markdownlint-disable-file -->