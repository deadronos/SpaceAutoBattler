---
title: Design - Simulation Step (simulateStep)
version: 1.0
date_created: 2025-08-20
last_updated: 2025-08-20
owner: SpaceAutoBattler Contributors
tags: [design, simulate, game, determinism]
---

## Introduction

This specification documents the deterministic simulation step contract implemented by `src/simulate.js`. It defines inputs, outputs, event shapes, determinism constraints, and automated test acceptance criteria.

## 1. Purpose & Scope

Purpose: Define the `simulateStep(state, dt, bounds)` contract and the event shapes used by the renderer. Scope covers collision resolution, XP awarding, carrier launches, entity lifecycle, and RNG usage.

Scope:

- Applies to `src/simulate.js` and any code that consumes its events (renderer, tests).
- Audience: contributors, automated agents, and CI.

## 2. Definitions

- simulateStep(state, dt, bounds): the primary deterministic timestep function.
- Event sinks: `state.explosions`, `state.shieldHits`, `state.healthHits`.
- RNG: `src/rng.js` seeded PRNG used for gameplay randomness.

## 3. Requirements, Constraints & Guidelines

- **REQ-SIM-001**: Export function `simulateStep(state, dt, bounds)` that mutates `state` and emits events.
- **REQ-SIM-002**: Create event sink arrays if absent: `explosions`, `shieldHits`, `healthHits`.
- **REQ-SIM-003**: All gameplay randomness must use `src/rng.js` helpers. No `Math.random()` for game decisions.
- **REQ-SIM-004**: Maintain deterministic iteration order and RNG consumption.
- **CON-SIM-001**: Do not perform rendering or DOM operations.
- **GUD-SIM-001**: Iterate backward when removing items from arrays to avoid index shifts.

## 4. Interfaces & Data Contracts

- Function signature:

```ts
simulateStep(state: { ships: Ship[], bullets: Bullet[], explosions?: any[], shieldHits?: any[], healthHits?: any[] }, dt: number, bounds: { W: number, H: number }) -> void
```

- Event shapes:

  - Explosion: `{ x: number, y: number, team: string|number }`
  - ShieldHit: `{ id: number, hitX: number, hitY: number, team: string|number, amount: number }`
  - HealthHit: `{ id: number, hitX: number, hitY: number, team: string|number, amount: number }`

## 5. Acceptance Criteria

- **AC-SIM-001**: Given two runs with the same initial `state` and `srand(seed)`, When `simulateStep` is executed for N frames, Then final `state` and emitted events must be identical across runs.
- **AC-SIM-002**: Given a bullet collides with a ship, When collision resolves, Then `shieldHits` and/or `healthHits` contain entries with correct `id`, `hitX`, `hitY`, and `amount`.
- **AC-SIM-003**: Given a ship dies this step, Then an explosion event is pushed and the ship is removed or marked not alive before the next step.
- **AC-SIM-004**: Missing event sink arrays are created by the function and populated as events occur.

## 6. Test Automation Strategy

- Test types: Unit (Vitest), Integration (simulate+entities), Determinism (seeded runs).
- Determinism tests must call `srand(seed)` and verify exact equality of event arrays.
- Include edge-case tests: `dt <= 0` no-op, large `dt` handled via clamping or substeps, empty arrays handled safely.

## 7. Rationale & Context

- Keep simulation logic deterministic and side-effect free so replays and unit tests are reliable.
- Keep emitted events numeric and minimal for efficient rendering.

## 8. Dependencies & External Integrations

- **EXT-001**: `src/entities.js` — entity methods and damage contract.
- **EXT-002**: `src/rng.js` — seeded RNG.
- **EXT-003**: `src/progressionConfig.js` — XP and level progression constants.

## 9. Examples & Edge Cases

Pseudocode example (high level):

```js
function simulateStep(state, dt, bounds) {
  if (!dt || dt <= 0) return;
  state.explosions = state.explosions || [];
  state.shieldHits = state.shieldHits || [];
  state.healthHits = state.healthHits || [];
  // update ships
  for (let i = 0; i < state.ships.length; i++) {
    const s = state.ships[i];
    s.update(dt, state);
    wrapPosition(s, bounds);
    // carrier logic deterministic via src/rng.js
  }
  // update bullets & resolve collisions (iterate backwards)
  for (let b = state.bullets.length - 1; b >= 0; b--) {
    const bullet = state.bullets[b];
    bullet.update(dt);
    if (!bullet.alive(bounds)) { state.bullets.splice(b, 1); continue; }
    for (let i = state.ships.length - 1; i >= 0; i--) {
      const t = state.ships[i];
      if (t.team === bullet.team) continue;
      if (collides(bullet, t)) {
        const hit = t.damage(bullet.dmg);
        if (hit.shield) state.shieldHits.push({ id: t.id, hitX: bullet.x, hitY: bullet.y, team: t.team, amount: hit.shield });
        if (hit.hp) state.healthHits.push({ id: t.id, hitX: bullet.x, hitY: bullet.y, team: t.team, amount: hit.hp });
        awardXp(bullet.ownerId, hit);
        state.bullets.splice(b, 1);
        if (!t.alive) { state.explosions.push({ x: t.x, y: t.y, team: t.team }); state.ships.splice(i, 1); }
        break;
      }
    }
  }
}
```

## 10. Validation Criteria

- Determinism: seed-based runs produce identical outputs.
- Event shapes validated via unit tests.
- No DOM usage in `src/simulate.js`.

*** End of file
