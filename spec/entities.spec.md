# entities.js — Specification

## Purpose

This document specifies the responsibilities, public API, data shapes, deterministic contracts, and testing guidance for `src/entities.js` in the SpaceAutoBattler project.

`src/entities.js` contains the core logic for the game's domain objects: Ship and Bullet (and any small helper entity types). This file defines how entities are constructed, how they update, how they take damage / restore shields, and how XP/level progression hooks integrate with damage and kills.

## Context and goals

Entities are the smallest unit of game logic and are relied on by `src/simulate.js` to advance the simulation. The key goals for `src/entities.js` are:

- Clear, minimal public contracts for `Ship` and `Bullet` objects so the simulator and renderer can interact predictably.
- Deterministic behavior when any randomness is required (use `src/rng.js`).
- Minimal side-effects: entities should not touch DOM or perform rendering.
- Small, well-documented state shapes so tests can create and assert entity behavior easily.

## Public API

This file SHOULD export constructor functions or classes and helper functions with the following (recommended) surface:

- `createShip(opts)` -> Ship
  - Inputs: object with fields: `id`, `x`, `y`, `vx`, `vy`, `team`, `hp`, `maxHp`, `shield`, `maxShield`, `shieldRegen`, `dmg`, `radius`, `isCarrier` (optional), `level` (optional), `xp` (optional), and other gameplay flags.
  - Output: a `Ship` object with the methods/fields below.

- `createBullet(opts)` -> Bullet
  - Inputs: `x`, `y`, `vx`, `vy`, `team`, `dmg`, `ownerId`, `ttl` or `lifespan`, `radius`, `id` (optional).
  - Output: a `Bullet` object with the methods/fields below.

- `Ship` methods/fields (contract)
  - Fields: `id`, `team`, `x`, `y`, `vx`, `vy`, `hp`, `maxHp`, `shield`, `maxShield`, `alive` (boolean), `level`, `xp`.
  - Methods:
    - `update(dt, state)` — advance movement, regen shields, perform per-frame logic (carrier launches live in simulate but ship may expose helpers).
    - `damage(amount, source)` — apply damage to shield first, then hp; return an object describing the hit: `{ shield: number, hp: number, killed: boolean }` and the numeric amounts absorbed by shield/hp.
    - `gainXp(amount)` — add XP and apply level-ups using `src/progressionConfig.js` (or call into a shared progression helper).
    - `applyLevel(level)` — apply the stat changes for the provided level (HP/dmg/shield scaling) deterministically.

- `Bullet` methods/fields (contract)
  - Fields: `id`, `x`, `y`, `vx`, `vy`, `dmg`, `team`, `ownerId`, `ttl` / `lifespan`.
  - Methods:
    - `update(dt)` — advance position and reduce lifespan.
    - `alive(bounds)` — return whether the bullet is still live (inside bounds and ttl>0).

Note: the project historically uses functional JS + small prototypes. Export shapes that are easy to serialize for tests (plain objects with methods attached or small class instances).

## Data shapes (stable contracts)

Ship (example):

```js
{
  id: 42,
  team: 'red',
  x: 123.4,
  y: 200.1,
  vx: 0.5,
  vy: -0.2,
  hp: 30,
  maxHp: 50,
  shield: 8,
  maxShield: 10,
  shieldRegen: 0.5,
  dmg: 5,
  radius: 8,
  isCarrier: false,
  alive: true,
  level: 1,
  xp: 0
}
```

Bullet (example):

```js
{
  id: 1001,
  x: 120,
  y: 210,
  vx: 0,
  vy: -200,
  dmg: 6,
  team: 'red',
  ownerId: 42,
  ttl: 2.0,
  radius: 2
}
```

Methods may return small plain objects describing results (for example, `damage()` returns `{ shield: amount, hp: amount, killed: boolean }`). Keep these shapes minimal so `simulate.js` can map them into events.

## Behavior and invariants

- Movement: `update(dt)` updates `x` and `y` using `vx`/`vy` and exposes a simple `wrapPosition(bounds)` helper or leaves wrapping to `simulate.js`.
- Shields: damage is applied to `shield` first. If `shield` absorbs all damage, `hp` is unchanged. If damage exceeds `shield`, remaining damage reduces `hp`.
- Shield regeneration: `update(dt)` should increase `shield` by `shieldRegen * dt` up to `maxShield`.
- Death: when `hp <= 0`, `alive` becomes `false`. `damage()` should indicate `killed: true` for the killing blow.
- XP / level: `gainXp(amount)` should follow progression constants from `src/progressionConfig.js`. Level application MUST be idempotent and deterministic.
- Bullet ownership: bullets created by a ship SHOULD set `ownerId` so XP/kill crediting can be assigned by `simulate.js`.

Invariants:

- Ship hp/shield never exceed their respective max values.
- `alive` accurately reflects `hp > 0`.
- `damage()` must be pure except for mutating the ship/bullet state; it must not perform side-effects like awarding XP to other entities directly — that should be done by `simulate.js` using bullet.ownerId.

## Events and how simulate consumes them

Entities should return small numeric results so `simulate.js` can convert them to the established event shapes.

- `Ship.damage(amount, source)` returns something like `{ shield: X, hp: Y, killed: boolean }` where `shield` is the amount absorbed by shield, and `hp` is the amount subtracted from hp.
- `Bullet.update(dt)` returns nothing but `simulate.js` inspects `bullet.x/y` for collision and `bullet.ttl` for expiry.

By keeping these return values small and numeric, `simulate.js` can emit `state.shieldHits` and `state.healthHits` events in the format defined in `spec/simulate.spec.md`.

## Determinism and RNG

- Any randomness inside entity creation or behavior MUST use `src/rng.js` (`srange`, `srangeInt`) so tests remain deterministic when seeded.
- Do not use `Math.random()` inside entities for gameplay decisions.

## Edge cases

- Damage with fractional shields: support fractional shield values and ensure partial absorption is reported correctly.
- Overkill: if damage far exceeds current hp, `damage()` should clamp hp to zero and report the actual hp reduced (not negative values).
- Repeated level-ups in a single XP gain: `gainXp()` should loop applying levels until XP < next-level threshold.
- Missing optional fields: constructors should fill sensible defaults (e.g., `shieldRegen: 0`, `level: 1`, `xp: 0`).

## Testing guidance and acceptance criteria

Write unit tests under `test/` that exercise `src/entities.js` directly. Recommended tests:

- Ship damage ordering (happy path): shields first, then hp; verify returned `damage()` object and mutated ship state.
- Shield regen: after calling `update(dt)` ensure `shield` increased by `shieldRegen * dt` and did not exceed `maxShield`.
- Death and explosion contract: `damage()` killing a ship should set `alive=false` and allow `simulate.js` to push an explosion event (test by simulating the minimal loop).
- XP & level progression: seed RNG if needed, call `gainXp()` and assert `level` and stat changes match `src/progressionConfig.js` rules. Include tests for multiple-level gains.
- Bullet lifetime: `Bullet.update(dt)` should decrement ttl and `alive(bounds)` should return false after expiry or when outside bounds.
- Determinism: any test involving RNG should call `srand(seed)` before creating entities.

Each test should be small and focused. Use the existing Vitest setup; tests already in `test/` are good examples for style and seeding.

## Implementation notes and suggestions

- Prefer plain, serializable objects for entity state so tests can deep-equal states easily. Methods may be attached but keep core state as plain fields.
- Small helper functions (e.g., `applyDamageToShield(ship, amount)`) are fine but keep them private to the module unless reused elsewhere.
- Document any public helper exports in this spec and add short comments in code referencing this spec file when behavior is non-obvious.

## Decision records

If you introduce a change that affects determinism (per-ship RNG, event shapes, progression math), add a short Decision Record under `.github/DECISIONS/` describing the change and tests added.

## Appendix — safe pseudocode

```js
function damage(ship, amount) {
  const result = { shield: 0, hp: 0, killed: false };
  const shieldAbsorb = Math.min(ship.shield, amount);
  ship.shield -= shieldAbsorb;
  result.shield = shieldAbsorb;
  const leftover = amount - shieldAbsorb;
  if (leftover > 0) {
    const hpReduce = Math.min(ship.hp, leftover);
    ship.hp -= hpReduce;
    result.hp = hpReduce;
    if (ship.hp <= 0) { ship.alive = false; result.killed = true; }
  }
  return result;
}
```

---

Requirements coverage (summary):

- Public API: documented and recommended exports. — Done
- Data shapes: `Ship` and `Bullet` examples and return shapes. — Done
- Determinism: RNG guidance included. — Done
- Tests: list of unit tests and acceptance criteria. — Done

```