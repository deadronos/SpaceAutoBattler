---
title: Design - Entities (Ship & Bullet)
version: 1.1
date_created: 2025-08-20
last_updated: 2025-08-20
owner: SpaceAutoBattler Contributors
tags: [design, entities, game, simulation]
---

## Introduction

This specification documents the design, requirements, data contracts, and testable acceptance criteria for the entities module that implements game objects (Ship and Bullet) used by the SpaceAutoBattler deterministic simulation. It is written to be machine-parsable and clear for generative-AI and developer consumption.

## 1. Purpose & Scope

Purpose: Define the exact behavior, public API, invariants, and test strategy for the module that creates and manipulates Ships and Bullets used by `src/simulate.js`.

Scope:

- Applies to the entity logic used by `src/simulate.js` and `src/renderer.js`.
- Intended audience: contributors, automated agents, test authors, and CI systems.
- Assumptions: the simulation contract (seeded RNG, event shapes) is enforced elsewhere; entities must not perform rendering or DOM operations.

## 2. Definitions

- Ship: a game actor with position, velocity, HP, shields, team, and progression data.
- Bullet: a projectile with position, velocity, damage, ownerId, and lifespan.
- RNG: seeded random number generator provided by `src/rng.js`.
- Event sinks: `state.explosions`, `state.shieldHits`, `state.healthHits` used by `simulateStep`.

## 3. Requirements, Constraints & Guidelines

- **REQ-ENT-001**: Expose constructors/factory functions that create serializable Ship and Bullet state objects.
- **REQ-ENT-002**: Entities must provide stable method contracts: `update(dt[, state])`, `damage(amount, source?)`, and `alive(bounds)` (for bullets) where applicable.
- **REQ-ENT-003**: Shields absorb damage first; damage overflow reduces HP.
- **REQ-ENT-004**: Shield regeneration occurs in `update(dt)` at `shieldRegen * dt` and clamps at `maxShield`.
- **REQ-ENT-005**: `damage()` returns an explicit result object summarizing amounts applied to shield and HP and whether the hit killed the ship. It must not perform external side-effects (no XP awarding inside `damage()`).
- **REQ-ENT-006**: Any gameplay randomness in entity construction or behavior MUST use `src/rng.js` functions (e.g., `srand`, `srange`, `srangeInt`).
- **SEC-ENT-001**: Entities must not access DOM or networking. No external side-effects from entity methods.
- **CON-ENT-001**: Entities must be deterministic when RNG is seeded and call-order is fixed.
- **GUD-ENT-001**: Prefer plain serializable objects for state; attach small methods if needed but keep core state as POJOs for ease of testing.
- **REQ-ENT-007**: Modularized Ship Components
  - Ships MUST have modularized components for hull, armor, and shields. Each component MUST have independent stats and behavior.
  - Hull: Base HP and structural integrity.
  - Armor: Reduces incoming damage by a percentage or flat value.
  - Shields: Absorb damage before armor and hull; regenerate over time.

- **REQ-ENT-008**: Cannon System
  - Ships MUST support multiple cannon types for firing bullets. Each cannon MUST have independent stats (reload time, range, damage).
  - Bullets fired MUST include `ownerId` to tie them to the ship that fired them.

## 4. Interfaces & Data Contracts

Public factories and their expected shapes (recommended names):

- createShip(opts) -> Ship

  - opts: { id, x, y, vx, vy, team, hp, maxHp, shield, maxShield, shieldRegen, dmg, radius, isCarrier?, level?, xp? }
  - Returns Ship object with fields: id, team, x, y, vx, vy, hp, maxHp, shield, maxShield, shieldRegen, dmg, radius, isCarrier, alive, level, xp
  - Methods (on object or prototype): update(dt, state?), damage(amount, source?), gainXp(amount), applyLevel(level)

- createBullet(opts) -> Bullet

  - opts: { id?, x, y, vx, vy, team, dmg, ownerId?, ttl?, radius? }
  - Returns Bullet with fields: id, x, y, vx, vy, dmg, team, ownerId, ttl, radius
  - Methods: update(dt), alive(bounds?)

Data contract examples:

Ship example JSON (expanded):

```json
{
  "id": 42,
  "team": "red",
  "x": 123.4,
  "y": 200.1,
  "vx": 0.5,
  "vy": -0.2,
  "hp": 30,
  "maxHp": 50,
  "armor": 10,
  "shield": 8,
  "maxShield": 10,
  "shieldRegen": 0.5,
  "dmg": 5,
  "radius": 8,
  "cannons": [
    { "type": "laser", "reload": 0.2, "range": 150, "damage": 10 },
    { "type": "missile", "reload": 1.0, "range": 300, "damage": 25 }
  ],
  "isCarrier": false,
  "alive": true,
  "level": 1,
  "xp": 0
}
```

Bullet example JSON:

```json
{
  "id": 1001,
  "x": 120,
  "y": 210,
  "vx": 0,
  "vy": -200,
  "dmg": 6,
  "team": "red",
  "ownerId": 42,
  "ttl": 2.0,
  "radius": 2
}
```

Damage result contract (returned by `damage()`):

```json
{ "shield": 0, "hp": 0, "killed": false }
```

## 5. Acceptance Criteria

- **AC-ENT-001**: Given a Ship with shield > 0, When `damage(amount)` is called with amount <= shield, Then shield is reduced by amount, HP unchanged, and return `{ shield: amount, hp: 0, killed: false }`.
- **AC-ENT-002**: Given a Ship with shield < amount, When `damage(amount)` is called, Then shield becomes 0, HP reduced by (amount - shieldBefore), and `killed` true if HP <= 0.
- **AC-ENT-003**: Given `update(dt)` is called, When `shield < maxShield`, Then `shield` increases by `shieldRegen * dt` and clamps at `maxShield`.
- **AC-ENT-004**: Given a Bullet with ttl <= 0 or outside bounds, When `alive(bounds)` is invoked, Then it returns false.
- **AC-ENT-005**: Given deterministic tests call `srand(seed)` before constructing entities and exercising methods, When repeated, Then state mutations and returned values are identical across runs.

## 6. Test Automation Strategy

- Test Levels: Unit (Vitest), Integration (simulate + entities), Smoke/Determinism tests.
- Framework: Vitest (existing project tests already use Vitest).
- Test data management: Tests should create minimal POJO states and call `srand(seed)` when determinism is required; clean up per-test.
- CI: Run `npm test` in CI and require no failing tests.
- Coverage: Focus on behavior (damage, regen, death, xp application) rather than implementation details.

Suggested unit tests:

- Ship damage ordering, including fractional shields and overkill.
- Shield regeneration clamping.
- gainXp producing multiple level-ups in one call.
- Bullet TTL and bounds-checking.

## 7. Rationale & Context

- Keep entity state plain and deterministic to make simulation reproducible and tests simple.
- Isolate side-effects (XP awarding, event emission) to `simulateStep` to keep entities single-responsibility and easy to unit test.

## 8. Dependencies & External Integrations

- **EXT-001**: `src/simulate.js` — consumer of entities; must respect returned damage objects and fields.
- **EXT-002**: `src/rng.js` — deterministic RNG for any gameplay randomness; entities must consume it rather than `Math.random()`.
- **INF-001**: Node.js + Vitest environment used for automated testing.

## 9. Examples & Edge Cases

Example `damage()` pseudocode (edge cases handled):

```javascript
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

Edge cases:

- Fractional shields and damage must be supported.
- Multiple-level gains from a single XP increment must apply deterministically.

## 10. Validation Criteria

- Unit tests pass in CI (`npm test`).
- Determinism tests seeded with `srand(seed)` pass consistently.
- No entity code performs DOM or external effects in unit tests.

## 11. Related Specifications / Further Reading

- `spec/spec-design-simulate.md` — simulation step contract and events.
- `spec/spec-design-rng.md` — seeded RNG contract and usage.
