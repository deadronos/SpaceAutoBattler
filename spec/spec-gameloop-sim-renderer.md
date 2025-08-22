## SpaceAutoBattler — Spec: Game Loop, Simulation Loop, Renderer, RNG, Entities

### Purpose

This spec describes the small, testable specifications to author for the core timing and rendering contracts in SpaceAutoBattler. The goal is to make the game loop, simulation loop, and renderer modular, testable, and able to be decoupled (for Worker/off-main-thread execution) while preserving deterministic simulation behavior.

### Scope

- `gameloop` (high-level orchestration)
- `simloop` / `simulateStep` (deterministic simulation ticks)
- `renderer` (modular rendering API for main-thread and worker use)
- `canvas fallback renderer` (2D canvas rendering path)
- `webgl2 renderer` (WebGL2 renderer path and loop ownership)
- `rng` (seeded RNG contract and usage rules)
- `entities` (entity model and configuration spec mirroring `entitiesConfig.js`)

Each spec below contains: intent, inputs, outputs, acceptance criteria, and tests to write.

---

### 1) Spec: gameloop (orchestration)

Intent
- Provide clear rules for how the application starts and coordinates simulation and rendering. Should allow three deployment modes: (A) main-thread sim + main-thread render, (B) worker sim + main-thread render, (C) worker sim + worker render (OffscreenCanvas).

Public contract / API
- Start: `startGame({ mode, seed, state, bounds, simDtMs })`
- Stop: `stopGame()`
- Query: `isRunning()`

Behavior
- On start, the gameloop chooses wiring based on `mode` and available features (OffscreenCanvas, Worker support). It instantiates renderer and/or sim worker but does NOT assume renderer internals; it MUST respect renderer-provided flags:
  - `renderer.providesOwnLoop` (boolean)
  - `renderer.isRunning()` (may throw; gameloop must handle exceptions)

Acceptance criteria
- When `renderer.providesOwnLoop === true`, gameloop must NOT start an external requestAnimationFrame loop.
- When `renderer.isRunning() === true`, gameloop must NOT start an external rAF loop.
- If `renderer.isRunning()` throws, gameloop must fallback to safe behavior and start external rAF.

Tests to add
- Unit test covering the three cases above (mock renderer with combinations of `providesOwnLoop` and `isRunning`), as well as error path when `isRunning` throws. (See `test/main.webglloop.guard.test.js` as a template.)

---

### 2) Spec: simloop / simulateStep

Intent
- Maintain a deterministic, fixed-timestep simulation function and a recommended worker-run loop that uses an accumulator.

Contract
- `simulateStep(state, dtSeconds, bounds)` — mutates `state` in place and appends visual-only events to `state.explosions`, `state.shieldHits`, `state.healthHits`.
- Deterministic when `srand(seed)` is called before stepping.

Timing
- Sim step should be fixed-step. Recommend: `SIM_DT_MS = 16` (16 ms) or `16.6667` (60 Hz). Optionally support 8 ms.

Acceptance Criteria
- Given same initial `state` and same `seed`, repeated runs of N steps must produce identical state (including event arrays). Add unit tests that seed RNG and compare snapshots.

Tests to add
- Determinism test (seeded): run simulateStep N times and assert deep equality with known-good snapshot.
- Edge cases: large dt (clamped delta), no ships, no bullets.

---

### 3) Spec: renderer (modular)

Intent
- Provide a small renderer contract that can be implemented by multiple backends (DOM Canvas 2D, WebGL2, OffscreenCanvas/WebWorker). Renderer must be able to accept an external state snapshot for rendering.

Contract / API
- `createRenderer(canvas, opts) -> renderer`
- `renderer.init()` -> boolean
- `renderer.renderState(state, interpolationAlpha?)` // pure drawing of given snapshot
- `renderer.start()` // optional — if renderer owns its own loop
- `renderer.stop()`
- `renderer.providesOwnLoop` (boolean)
- `renderer.isRunning()` -> boolean

Behavior
- Renderer must not mutate the simulation `state` object (only read). Visual-only ephemeral arrays (explosions, shieldHits, healthHits) may be consumed by renderer for visual effects; renderer may optionally clear them or copy them for visuals, but must not influence simulation state used by simulateStep.

Acceptance Criteria
- `renderState` must draw given `state` consistently and not cause side-effects to simulation state visible to next simulation step.

Tests to add
- Unit test for `renderState` that passes a small snapshot and validates no mutation occurred (deep clone before/after). DOM/integration tests can assert canvas draws or call into a headless canvas mock.

---

### 4) Spec: canvas fallback renderer (2D)

Intent
- Provide a reliable 2D Canvas renderer as fallback when WebGL2 or OffscreenCanvas isn't available.

API
- Same `createRenderer` contract; `type` property = `'canvas2d'`.

Acceptance Criteria
- Renders expected simple primitives for a small known state (e.g., one ship at x,y with color/team) — verified via integration or visual smoke test.

Tests to add
- Playwright or integration test that loads the page in a browser and validates rendered pixels or accessibility snapshot.

---

### 5) Spec: webgl2 renderer and loop ownership

Intent
- WebGL2 renderer provides higher-performance rendering; it may optionally own its own loop (e.g., using requestAnimationFrame internally). Gameloop must handle both ownership modes.

API differences / flags
- `renderer.type === 'webgl' || 'webgl2'`
- `renderer.providesOwnLoop` boolean

Acceptance Criteria
- If `providesOwnLoop` is true, the gameloop must not start an external rAF for rendering.
- If `providesOwnLoop` is false, gameloop must call `requestAnimationFrame` and call `renderer.render()` passing latest state.

Tests to add
- Unit tests that mock the webgl renderer's properties and ensure gameloop responds appropriately (see existing test file `test/main.webglloop.guard.test.js`).

---

### 6) Spec: rng (seeded random)

Intent
- Define the RNG contract and usage constraints to preserve determinism across worker/main contexts.

Contract
- `srand(seed)` — seed the RNG
- deterministic functions: `srange`, `srangeInt`, `srandom` used only inside simulation logic that affects gameplay

Rules
- Seed RNG inside simulation context before running simulate steps. Do not call seeded RNG for cosmetic rendering effects unless those cosmetic effects must be deterministic for replays.

Acceptance Criteria
- Determinism test that calls `srand(12345)` and runs simulation steps producing expected output.

Tests to add
- Extend existing `rng` tests to include worker-simulated runs if possible (or test simulateStep determinism which uses RNG internally).

---

### 7) Spec: entities & entitiesConfig mapping

Intent
- Formalize the entities model (ships, bullets, carriers, etc.) and their configuration to make serialization and worker-transfer predictable.

Contract / Data Shapes
- Ship: `{ id, x, y, vx, vy, hp, maxHp, shield, team, ownerId?, xp?, level? }`
- Bullet: `{ id, x, y, vx, vy, team, ownerId, damage }`
- EntitiesConfig: mirror `src/entitiesConfig.js` with explicit per-ship defaults

Serialization
- Define a canonical, minimal serializable representation for worker->main snapshots. Initially, structured clone with JS objects is acceptable. If performance becomes an issue, document a typed-array binary layout for ping/pong transfers.

Acceptance Criteria
- Snapshot includes arrays `ships`, `bullets`, `explosions`, `shieldHits`, `healthHits` and each entry matches the documented shapes.

Tests to add
- Unit test verifying the shape of entities after creation functions (constructors/factories) and after a simulateStep (no unexpected fields). Add test to assert snapshot keys exist.

---

### Implementation tasks (recommended prioritization)

1. Write the gameloop guarding tests (some already present — ensure they pass). Use `test/main.webglloop.guard.test.js` pattern.
2. Author `spec` files for each above item as a foundation for implementation and review (this file + separate detailed specs if needed).
3. Implement Worker-sim minimal wiring (create `src/simWorker.js`) and adapt `src/main.js` to instantiate worker (non-invasive change). Keep structured clone snapshot approach first.
4. Add `renderer.renderState(state)` wrapper so renderer can accept snapshots instead of reading a shared `state` global.
5. If profiling shows copying cost, implement typed-array serialization + transferables (ping/pong) and add tests.

### Validation & QA

- Run Vitest unit suite: `npm test` and ensure no regressions.
- Add deterministic simulation tests seeded via `srand` and compare snapshots.
- Manual smoke run: open standalone HTML or serve and confirm visual correctness.

### Notes / Rationale

- Favor minimal, test-covered changes. Preserve `simulateStep` contract exactly (mutating `state` and appending event arrays). Prefer structured clone first; move to binary transfer only if needed.

---

### Files suggested to author/update

- `spec/spec-gameloop-sim-renderer.md` (this file)
- `src/simWorker.js` (worker prototype)
- `src/main.js` (wire worker creation on opt-in)
- `src/renderer.js` (add `renderState` wrapper)
- `test/sim.worker.determinism.test.js` (unit test for seeded simulation)
- `test/main.webglloop.guard.test.js` (already present — keep and expand)

End of spec.
