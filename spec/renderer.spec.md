# Renderer Specification — src/renderer.js

**Last updated:** 2025-08-19


## Purpose

This document specifies the responsibilities, runtime contract, inputs/outputs, events, performance expectations, and testing guidance for the renderer module at `src/renderer.js` in the SpaceAutoBattler project.

## Why this spec exists

The renderer is intentionally separated from the deterministic simulation. The simulation produces minimal numeric events; the renderer converts them to visual effects. This spec documents that contract and describes performance and test expectations so future contributors don't accidentally couple visual side-effects to game logic.

## Scope and responsibilities

- Initialize and manage the HTML Canvas and the visual scene.
- Maintain and update renderer-local state (particles, flashes, cached Path2D/gradients, visual wrappers).
- Consume simulation state/events (the output of `simulateStep`) and produce visuals.
- Provide UI controls (start/pause, reset, seed setting, add ships, trails toggle, speed, formation) and small UX helpers (toasts).
- Keep visual-only randomness (Math.random or other browser RNG) segregated from deterministic game logic RNG.

### Public entry points

The renderer is used from the browser via the module import in `space_themed_autobattler_canvas_red_vs_blue.html` and does the following on import:

- Query DOM elements (canvas, controls) and wire UI event handlers.
- Call `reset()` to initialize seeded or unseeded state.
- Start an animation loop (`requestAnimationFrame(loop)`) which calls `simulate()` and `render()`.

### Important exported/visible functions (internal use patterns)

- `reset(seedValue)` — resets the renderer and simulation state. If `seedValue` is provided, seeds the deterministic RNG used by simulation via `srand(seedValue)`.
- `simulate(dt)` — internal step: advances visual state (particles, flashes), invokes `simulateStep(...)` (the deterministic simulation), then consumes emitted events to spawn visuals.
- `render()` — draws the current visuals to the canvas.

### Simulation / renderer contract

Renderer consumes the following parts of the simulation state (shape expected from `simulateStep`):

- `state.ships` — array of `Ship` logic objects with properties: `id, x, y, angle, type, team, hp, hpMax, shield, shieldMax, level, alive, radius`.
- `state.bullets` — array of `Bullet` logic objects with properties: `x, y, vx, vy, radius, team`.
- `state.explosions` (optional) — array of explosion events: `{ x, y, team }`.
- `state.shieldHits` (optional) — array of shield hit events: `{ id, hitX, hitY, team, amount }`.
- `state.healthHits` (optional) — array of health hit events: `{ id, hitX, hitY, team, amount }`.

Renderer MUST NOT: mutate simulation-only fields in `state` or perform game-altering logic. The renderer may, however, create renderer-local visual wrappers and auxiliary arrays (particles, flashes) that are not passed back into simulation.

### Event handling and visuals

- **Explosions:** push a `flash` at the explosion coordinates and spawn particle bursts.
- **ShieldHits:** renderer will locate the referenced `Ship` object (by id) and create a shield arc flash attached to that ship's visual wrapper; will also spawn impact particles at `hitX, hitY`.
- **HealthHits:** renderer will locate referenced ship and add a short-lived health flash used to color the health bar.

### Performance guidance

- Keep renderer-local allocations small and reuse objects where possible. Consider pooling for `Particle` and `Flash` objects.
- Cache expensive drawing artifacts such as radial gradients and hull `Path2D` if many ships share the same type/scale.
- Batch small particle draws when possible instead of issuing separate draw calls per particle.
- Avoid creating new Canvas gradients per-frame for the same region: reuse or weakly cache them keyed by radius/position zone.
- Use `requestAnimationFrame` for the render loop and clamp `dt` to avoid large steps after tab backgrounding.

### Determinism boundary

- All deterministic game randomness must come from `src/rng.js` and be invoked inside simulation code (`simulateStep`, `entities`). The renderer may use `Math.random()` or window RNG for purely cosmetic variety (particles jitter, star phases). Keep this separation explicit in comments.

### Testing and acceptance criteria

Automated tests should verify:

- The renderer consumes events with the expected shapes without throwing exceptions when fields are missing.
- Visual wrapper sync: when simulation adds/removes a `Ship`, the renderer must add/remove corresponding visual wrappers (`ShipV`) and not leak references.
- Event-to-visual mapping: passing a `shieldHits` array should produce `shieldFlashes` entries attached to the correct ship id; `healthHits` should push health flash entries.
- Performance smoke test: running `simulate()` + `render()` repeatedly for a short burst (e.g., 200 frames) should not allocate excessively; tests can instrument GC or measure allocations indirectly (Vitest-based microbenchmark exists in `test/simulate.benchmark.test.js`).

### Unit test suggestions

- `renderer.sync.test.js`: Create a minimal `state` with one ship and one explosion/shieldHit/healthHit and call `simulate()`; assert `flashes`, `shieldFlashes`, and `healthFlashes` arrays are populated and cleared over time.
- `renderer.pool.test.js`: (Optional) Add a pooling mechanism and a test that verifies object reuse.
- `renderer.integration.test.js`: Use `srand(seed)` and `reset(seed)` to create deterministic visuals and run a short sequence of frames asserting no exceptions and stable wrapper map sizes.

### Developer notes and TODOs

- TODO: Implement pooling for `Particle` and `Flash` objects to reduce GC pressure.
- TODO: Cache gradients and `Path2D` hulls per ship type/scale to avoid per-frame recreation.
- TODO: Batch small particle draws for improved performance.
- TODO: Consider `WeakMap` for `shipsVMap` to avoid manual deletion when wrapper lifecycle matches ship logic object lifecycle.

### Acceptance criteria

- The renderer respects the simulation/renderer contract and only consumes simulation output.
- Visual events faithfully reflect simulation events (explosions, shield/health hits).
- Tests included in the test-suite cover the critical event handling paths and wrapper lifecycle.
- Performance guidance items are noted and low-risk changes (comments, TODOs) have been added to `src/renderer.js`.

### Appendix: Event schemas

- **Explosion:** `{ x: number, y: number, team: Team }`.
- **ShieldHit:** `{ id: number, hitX: number, hitY: number, team: Team, amount: number }`.
- **HealthHit:** `{ id: number, hitX: number, hitY: number, team: Team, amount: number }`.

### Document history

- `2025-08-19`: Initial spec created by AI assistant per user request.
