# simulate.js — Specification

## Purpose

This document specifies the responsibilities, public API, deterministic contracts, event shapes, and testing guidance for `src/simulate.js` in the SpaceAutoBattler project.

## Context and goals

`src/simulate.js` implements the deterministic simulation timestep. It advances ship and bullet state, resolves collisions, spawns and destroys entities, awards XP, and emits small numeric events for the renderer.

Primary goals:

- Determinism: with the same initial state and RNG seed (via `src/rng.js::srand(seed)`) the simulator must produce the same sequence of state mutations and events.
- Isolation: simulator must not touch DOM or rendering APIs.
- Stable contract: provide a fixed function signature and stable event shapes for the renderer and tests.

## Public API

### simulateStep(state, dt, bounds)

Inputs:

- `state` (object) — expected keys: `ships` (array), `bullets` (array). Optional event sink arrays: `explosions`, `shieldHits`, `healthHits` (the function SHOULD create these if absent).
- `dt` (number) — timestep in seconds (e.g., 1/60).
- `bounds` (object) — `{ W, H }` playfield size.

Behavior summary:

- Advance ships and bullets using their logic methods.
- Handle carrier launches deterministically.
- Detect and resolve collisions, apply damage to shields/HP, remove dead bullets/ships.
- Award XP to bullet owners / killers using constants from `src/progressionConfig.js`.
- Push minimal events into `state.explosions`, `state.shieldHits`, and `state.healthHits`.

Output: none — the function mutates `state` in place and emits events via the event arrays.

## Event shapes (stable contract)

- Explosion event: `{ x: number, y: number, team: string|number }`
- Shield hit: `{ id: number, hitX: number, hitY: number, team: string|number, amount: number }`
- Health hit: `{ id: number, hitX: number, hitY: number, team: string|number, amount: number }`

Event payloads must remain small and numeric-only so the renderer can efficiently consume them.

## Determinism and RNG

- All simulation randomness MUST use `src/rng.js` helpers (`srand`, `srange`, `srangeInt`). Callers should invoke `srand(seed)` before running steps to ensure repeatability.
- Do not use `Math.random()` or other non-seeded sources for gameplay decisions (positions, spawn choices, carrier timing, etc.).
- Keep iteration order and RNG consumption stable: iterate arrays in a fixed order and avoid non-deterministic constructs.

### Carrier launch determinism

Carrier ships (`ship.isCarrier === true`) typically have `launchCooldown` and `launchAmount`.

Recommended approaches (in decreasing order of preference):

- Attach a small per-ship deterministic PRNG state at ship creation (for example, a 32-bit LCG seeded from `ship.id` and the global seed) and use this per-ship RNG for launch offsets and other carrier-local randomness so the global RNG stream remains stable.
- Use `srange`/`srangeInt` in a stable, well-documented location to compute deterministic offsets.

Do NOT call `Math.random()` during simulation for launch timing or fighter spawning.

## Lifecycle and invariants

- Ships and bullets are logic-only objects and must not access DOM APIs.
- When a ship dies:

  - Push an explosion event to `state.explosions`.
  - Remove it from `state.ships` (or mark `alive=false` and remove within the same step) so subsequent steps don't update it.

- When a bullet hits a ship or leaves bounds: remove it from `state.bullets`.
- XP awarding must be deterministic and use constants from `src/progressionConfig.js`. If a bullet has `ownerId`, the owner (if alive) must receive XP for damage and kills per the progression rules.

## Edge cases

- `dt <= 0`: treat as a no-op.
- Very large `dt`: consider clamping or performing internal substeps to keep collision detection stable.
- Missing event arrays: `simulateStep` SHOULD create `state.explosions`, `state.shieldHits`, and `state.healthHits` if they are not present.
- Empty `state.ships` or `state.bullets`: function should return quickly without exceptions.

## Testing guidance and acceptance criteria

- Determinism tests (required):

  1. Seeded smoke test: call `srand(12345)`, create a reproducible state, run N frames, repeat, and assert deep-equality of final states and event arrays.
  2. Carrier launch determinism: with a seeded RNG, assert identical launch timings and spawn counts across repeated runs.

- Functional tests (required):

  - Bullet collision: verify shields absorb damage first (produce `shieldHits`), then HP reduction (`healthHits`), and explosions on death.
  - XP awarding: owners receive XP for damage and kills when `ownerId` is present.
  - Event-sink tests: verify missing sinks are created and populated correctly.

- Edge-case tests: dt=0 no-op, empty arrays handled gracefully.

## Performance notes

- Prefer in-place mutation and iterate backwards when splicing arrays in hot loops.
- Keep event objects minimal to reduce GC pressure.
- Avoid heavy computations in the simulation loop that belong to rendering; leave those to `src/renderer.js`.

## Implementation hints

- Use `srange`/`srangeInt` from `src/rng.js` for required randomness.
- When removing items from arrays during iteration, iterate backward to avoid index skips.
- Keep `simulateStep`'s signature stable; add optional parameters only with backward-compatible defaults.

## Decision records

For non-trivial changes (e.g., per-ship PRNG or event-shape changes), publish a short Decision Record in `.github/DECISIONS/` describing rationale, alternatives considered, and tests added.

## Appendix — safe pseudocode

```js
function simulateStep(state, dt, bounds) {
  if (!dt || dt <= 0) return;

  state.explosions = state.explosions || [];
  state.shieldHits = state.shieldHits || [];
  state.healthHits = state.healthHits || [];

  // Update ships
  for (let i = 0; i < state.ships.length; i++) {
    const s = state.ships[i];
    s.update(dt, state.ships, state.bullets);
    wrapPosition(s, bounds);
    if (s.isCarrier) {
      s.launchCooldown -= dt;
      if (s.launchCooldown <= 0) {
        const fighters = s.launchFighters(); // deterministic via seeded RNG or per-ship RNG
        state.ships.push(...fighters);
        s.resetLaunchCooldown();
      }
    }
  }

  // Update bullets & resolve collisions (iterate backwards)
  for (let b = state.bullets.length - 1; b >= 0; b--) {
    const bullet = state.bullets[b];
    bullet.update(dt);
    if (!bullet.alive(bounds)) { state.bullets.splice(b, 1); continue; }
    for (let i = state.ships.length - 1; i >= 0; i--) {
      const target = state.ships[i];
      if (target.team === bullet.team) continue;
      if (collides(bullet, target)) {
        const hit = target.damage(bullet.dmg);
        if (hit.shield) state.shieldHits.push({ id: target.id, hitX: bullet.x, hitY: bullet.y, team: target.team, amount: hit.amount });
        if (hit.hp) state.healthHits.push({ id: target.id, hitX: bullet.x, hitY: bullet.y, team: target.team, amount: hit.amount });
        awardXpToOwner(bullet.ownerId, hit);
        state.bullets.splice(b, 1);
        if (!target.alive) {
          state.explosions.push({ x: target.x, y: target.y, team: target.team });
          state.ships.splice(i, 1);
        }
        break;
      }
    }
  }
}
```

---

Requirements coverage:

- Determinism: covered by tests and RNG guidance.
- Event shapes: explicitly enumerated.
- API: `simulateStep(state, dt, bounds)` documented and stable.
- Tests: recommended suite and acceptance criteria included.
 # simulate.js — Specification

## Purpose

This document specifies the responsibilities, public API, deterministic contracts, event shapes, and testing guidance for `src/simulate.js` in the SpaceAutoBattler project.

## Context and goals

`src/simulate.js` implements the deterministic simulation timestep. It advances ship and bullet state, resolves collisions, spawns and destroys entities, awards XP, and emits small numeric events for the renderer.

Primary goals:

- Determinism: with the same initial state and RNG seed (via `src/rng.js::srand(seed)`) the simulator must produce the same sequence of state mutations and events.
- Isolation: simulator must not touch DOM or rendering APIs.
- Stable contract: provide a fixed function signature and stable event shapes for the renderer and tests.

## Public API

### simulateStep(state, dt, bounds)

Inputs:

- `state` (object) — expected keys: `ships` (array), `bullets` (array). Optional event sink arrays: `explosions`, `shieldHits`, `healthHits` (the function SHOULD create these if absent).
- `dt` (number) — timestep in seconds (e.g., 1/60).
- `bounds` (object) — `{ W, H }` playfield size.

Behavior summary:

- Advance ships and bullets using their logic methods.
- Handle carrier launches deterministically.
- Detect and resolve collisions, apply damage to shields/HP, remove dead bullets/ships.
- Award XP to bullet owners / killers using constants from `src/progressionConfig.js`.
- Push minimal events into `state.explosions`, `state.shieldHits`, and `state.healthHits`.

Output: none — the function mutates `state` in place and emits events via the event arrays.

## Event shapes (stable contract)

- Explosion event: `{ x: number, y: number, team: string|number }`
- Shield hit: `{ id: number, hitX: number, hitY: number, team: string|number, amount: number }`
- Health hit: `{ id: number, hitX: number, hitY: number, team: string|number, amount: number }`

Event payloads must remain small and numeric-only so the renderer can efficiently consume them.

## Determinism and RNG

- All simulation randomness MUST use `src/rng.js` helpers (`srand`, `srange`, `srangeInt`). Callers should invoke `srand(seed)` before running steps to ensure repeatability.
- Do not use `Math.random()` or other non-seeded sources for gameplay decisions (positions, spawn choices, carrier timing, etc.).
- Keep iteration order and RNG consumption stable: iterate arrays in a fixed order and avoid non-deterministic constructs.

### Carrier launch determinism

Carrier ships (`ship.isCarrier === true`) typically have `launchCooldown` and `launchAmount`.

Recommended approaches (in decreasing order of preference):

- Attach a small per-ship deterministic PRNG state at ship creation (for example, a 32-bit LCG seeded from `ship.id` and the global seed) and use this per-ship RNG for launch offsets and other carrier-local randomness so the global RNG stream remains stable.
- Use `srange`/`srangeInt` in a stable, well-documented location to compute deterministic offsets.

Do NOT call `Math.random()` during simulation for launch timing or fighter spawning.

## Lifecycle and invariants

- Ships and bullets are logic-only objects and must not access DOM APIs.
- When a ship dies:

  - Push an explosion event to `state.explosions`.
  - Remove it from `state.ships` (or mark `alive=false` and remove within the same step) so subsequent steps don't update it.

- When a bullet hits a ship or leaves bounds: remove it from `state.bullets`.
- XP awarding must be deterministic and use constants from `src/progressionConfig.js`. If a bullet has `ownerId`, the owner (if alive) must receive XP for damage and kills per the progression rules.

## Edge cases

- `dt <= 0`: treat as a no-op.
- Very large `dt`: consider clamping or performing internal substeps to keep collision detection stable.
- Missing event arrays: `simulateStep` SHOULD create `state.explosions`, `state.shieldHits`, and `state.healthHits` if they are not present.
- Empty `state.ships` or `state.bullets`: function should return quickly without exceptions.

## Testing guidance and acceptance criteria

- Determinism tests (required):

  1. Seeded smoke test: call `srand(12345)`, create a reproducible state, run N frames, repeat, and assert deep-equality of final states and event arrays.
  2. Carrier launch determinism: with a seeded RNG, assert identical launch timings and spawn counts across repeated runs.

- Functional tests (required):

  - Bullet collision: verify shields absorb damage first (produce `shieldHits`), then HP reduction (`healthHits`), and explosions on death.
  - XP awarding: owners receive XP for damage and kills when `ownerId` is present.
  - Event-sink tests: verify missing sinks are created and populated correctly.

- Edge-case tests: dt=0 no-op, empty arrays handled gracefully.

## Performance notes

- Prefer in-place mutation and iterate backwards when splicing arrays in hot loops.
- Keep event objects minimal to reduce GC pressure.
- Avoid heavy computations in the simulation loop that belong to rendering; leave those to `src/renderer.js`.

## Implementation hints

- Use `srange`/`srangeInt` from `src/rng.js` for required randomness.
- When removing items from arrays during iteration, iterate backward to avoid index skips.
- Keep `simulateStep`'s signature stable; add optional parameters only with backward-compatible defaults.

## Decision records

For non-trivial changes (e.g., per-ship PRNG or event-shape changes), publish a short Decision Record in `.github/DECISIONS/` describing rationale, alternatives considered, and tests added.

## Appendix — safe pseudocode

```js
function simulateStep(state, dt, bounds) {
  if (!dt || dt <= 0) return;

  state.explosions = state.explosions || [];
  state.shieldHits = state.shieldHits || [];
  state.healthHits = state.healthHits || [];

  // Update ships
  for (let i = 0; i < state.ships.length; i++) {
    const s = state.ships[i];
    s.update(dt, state.ships, state.bullets);
    wrapPosition(s, bounds);
    if (s.isCarrier) {
      s.launchCooldown -= dt;
      if (s.launchCooldown <= 0) {
        const fighters = s.launchFighters(); // deterministic via seeded RNG or per-ship RNG
        state.ships.push(...fighters);
        s.resetLaunchCooldown();
      }
    }
  }

  // Update bullets & resolve collisions (iterate backwards)
  for (let b = state.bullets.length - 1; b >= 0; b--) {
    const bullet = state.bullets[b];
    bullet.update(dt);
    if (!bullet.alive(bounds)) { state.bullets.splice(b, 1); continue; }
    for (let i = state.ships.length - 1; i >= 0; i--) {
      const target = state.ships[i];
      if (target.team === bullet.team) continue;
      if (collides(bullet, target)) {
        const hit = target.damage(bullet.dmg);
        if (hit.shield) state.shieldHits.push({ id: target.id, hitX: bullet.x, hitY: bullet.y, team: target.team, amount: hit.amount });
        if (hit.hp) state.healthHits.push({ id: target.id, hitX: bullet.x, hitY: bullet.y, team: target.team, amount: hit.amount });
        awardXpToOwner(bullet.ownerId, hit);
        state.bullets.splice(b, 1);
        if (!target.alive) {
          state.explosions.push({ x: target.x, y: target.y, team: target.team });
          state.ships.splice(i, 1);
        }
        break;
      }
    }
  }
}
```

---

Requirements coverage:

- Determinism: covered by tests and RNG guidance.
- Event shapes: explicitly enumerated.
- API: `simulateStep(state, dt, bounds)` documented and stable.
- Tests: recommended suite and acceptance criteria included.

        state.bullets.splice(b, 1);
        if (!target.alive) {
          state.explosions.push({ x: target.x, y: target.y, team: target.team });
          state.ships.splice(i, 1);
        }
        break;
      }
    }
  }
}
```

---

Requirements coverage:

- Determinism: covered by tests and RNG guidance.
- Event shapes: explicitly enumerated.
- API: `simulateStep(state, dt, bounds)` documented and stable.
- Tests: recommended suite and acceptance criteria included.


