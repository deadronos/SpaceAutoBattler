# SpaceAutoBattler — Quick Context (for Copilot Chat & contributors)

This one-page summary gives the essential, non-negotiable facts about the repository so Copilot Chat and contributors can make safe, deterministic edits.

## Simulation contract (must be preserved)

- simulateStep signature: `simulateStep(state, dt, bounds)` (see `src/simulate.js`).

- Behavior: `simulateStep` MUST mutate `state` by advancing ships & bullets, resolving collisions, awarding XP, and returning small event objects for visual rendering.

- Event arrays allowed on `state` (create before pushing):
  - `state.explosions` — objects: `{ x, y, team }` when a ship dies.
  - `state.shieldHits` — objects: `{ id, hitX, hitY, team, amount }` when shield absorbs damage.
  - `state.healthHits` — objects: `{ id, hitX, hitY, team, amount }` when HP is reduced.

- Do NOT perform DOM manipulation or Canvas drawing in `simulateStep`.

## Determinism & RNG

- Use `src/rng.js` for any randomness in game logic. Do NOT use `Math.random()` for logic; `Math.random()` is acceptable only for purely cosmetic renderer effects.

- Seed the RNG in tests using `srand(seed)` (see `test/setupTests.js` pattern). Deterministic tests are required for game logic changes.

## Important contracts

- Bullets must include `ownerId` when created so XP and kill crediting works.

- Progression & level effects are in `src/progressionConfig.js`. If you change progression numbers, add unit tests covering two values to catch regressions.

- Do not change the shapes of the event objects without updating tests and the renderer (`src/renderer.js`).

## Key files & responsibilities

- `src/entities.js` — Ship and Bullet definitions, damage/shield handling, XP/level functions (Ship.gainXp, Ship.applyLevel).

- `src/simulate.js` — Time-step and game logic: advances entities, resolves collisions, emits events. Keep deterministic.

- `src/renderer.js` — Visual layer: reads state and event arrays and draws to Canvas. Safe to add cosmetic randomness here.

- `src/rng.js` — Seeded RNG (srand, srandom, srange, srangeInt). Use this in simulation code.

- `src/progressionConfig.js` — XP and per-level scaling constants.

- `scripts/build-standalone.mjs` — Bundles the renderer into a single standalone HTML file (`dist/` output).

## Testing

- Test runner: Vitest. Use `npm test` or `npx vitest`.

- Tests should seed the RNG for deterministic scenarios (call `srand(12345)` at top of tests when needed).

- Add a happy-path unit test and at least one edge-case test when changing numeric/gameplay constants.

- Playwright tests exist in `test/playwright/` for visual verification and capture flows.

## Local dev & helpful scripts

- `node ./scripts/build-standalone.mjs` — creates the single-file distribution for manual testing.

- `npm test` — runs Vitest.

- `npx playwright install --with-deps` — installs browsers needed for Playwright tests.

## WebGL & renderer notes

- The `webgl-streaming-instancing` branch adds streaming instancing behavior to dynamic entities in the WebGL renderer. When changing rendering code:
  - Prefer dev-only instrumentation guarded by flags (e.g., `DEBUG_WEBGL`).
  - Use Spector.js for frame capture and inspection in Chrome.
  - Avoid changing simulation logic in renderer files.

  ## WebGL game-loop & buffer-streaming best practices

  - Use requestAnimationFrame for rendering. It synchronizes with display vsync and lets the browser throttle when hidden.
  - Decouple simulation (update) from rendering using a fixed timestep (e.g. dt = 1/60s). Run deterministic updates on the fixed timestep and render at requestAnimationFrame frequency using an accumulator.
  - Interpolate renders between the previous and current simulation states (alpha = accumulator / dt) so visuals are smooth while keeping simulation deterministic (see "Fix Your Timestep").
  - Clamp very large frame deltas (e.g. frameTime = Math.min(frameTime, 0.25)) to avoid the spiral-of-death after pauses or tab-switches.
  - Avoid per-frame allocations in the hot path: reuse TypedArrays, object pools, and pre-allocated buffers to minimize GC pauses.
  - Minimize draw calls and GPU state changes: batch geometry, use texture atlases, and prefer instancing (WebGL2 or ANGLE_instanced_arrays) for many similar objects.
  - For dynamic vertex/instance data prefer these streaming strategies:
    - Orphaning: re-specify buffer storage (gl.bufferData with size/null) and then upload with gl.bufferSubData to avoid implicit GPU synchronization.
    - Multi-buffering: rotate between 2–3 buffers to ensure you don't write into a buffer the GPU is still reading.
    - Large pre-allocated buffers: update ranges (single gl.bufferSubData call per large block) and avoid many small uploads per frame.
    - Use instanced attribute buffers for per-instance dynamic data and call draw*Instanced.
  - Profile on real devices (SpectorJS, Chrome DevTools, GPU vendor tools). Look for CPU vs GPU stalls and implicit sync caused by streaming uploads.
  - Handle visibility and throttling: use the Page Visibility API to pause or reduce update rate when the page is hidden; on resume clamp dt and avoid long blocking catch-up loops.
  - Handle WebGL context loss: listen for 'webglcontextlost'/'webglcontextrestored' and recreate GPU resources safely.

  References:

  - "Fix Your Timestep" — Glenn Fiedler (deterministic fixed-timestep + interpolation): [https://gafferongames.com/post/fix_your_timestep/](https://gafferongames.com/post/fix_your_timestep/)
  - MDN — requestAnimationFrame and rendering guidance: [https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
  - Khronos / OpenGL Wiki — Buffer Object Streaming (orphaning, multi-buffering, persistent mapping): [https://www.khronos.org/opengl/wiki/Buffer_Object_Streaming](https://www.khronos.org/opengl/wiki/Buffer_Object_Streaming)
  - WebGLFundamentals — instanced drawing & optimizations: [https://webglfundamentals.org/webgl/lessons/webgl-instanced-drawing.html](https://webglfundamentals.org/webgl/lessons/webgl-instanced-drawing.html)
  - SpectorJS — WebGL capture & diagnostics: [https://spector.babylonjs.com/](https://spector.babylonjs.com/)

## Build & CI expectations

- CI should run linting (if added), run `npm test`, and run the standalone build script to verify no build regressions.

- Keep changes small and add tests for any logic changes.

## Quick checklist for any Copilot Chat change

1. Does it touch `src/simulate.js` or `src/entities.js`? If yes, add/modify tests and seed RNG.

2. Does it change event shapes? Update renderer and tests.

3. Is any randomness used? Use `src/rng.js`.

4. Keep changes minimal; prefer small, focused commits and PRs.

---

This file is intentionally short. For more detailed design notes, see `docs/ARCHITECTURE.md` and `spec/` files in the repo.
