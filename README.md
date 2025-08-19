# Space Autobattler
# SpaceAutoBattler

[![Gameplay preview — click to open VideoCapture.gif](VideoCapture.gif)](VideoCapture.gif)

A small, deterministic 2D auto-battler (Red vs Blue) implemented with vanilla ES modules and the Canvas 2D API. The simulation is deterministic when seeded and is intentionally separated from the renderer so the game logic can be unit tested independently from visuals.

Why this project exists
-----------------------
- A compact, deterministic simulation useful for experimentation and automated testing.
- A renderer that consumes minimal, numeric event objects from the simulator (explosions, shieldHits, healthHits) so visuals are replayable.

Highlights
----------
- Deterministic RNG via `src/rng.js` (use `srand(seed)` in tests).
- Ships with HP, regenerating shields, XP, and per-level progression (`src/progressionConfig.js`).
- Bullets carry `ownerId` so kills and XP credit are attributed correctly.
- The simulation step `simulateStep(state, dt, bounds)` is pure game-logic and emits small event arrays for the renderer.

Quick demo
----------
Click the preview above to view the animated capture (`VideoCapture.gif`). If you prefer a static screenshot, extract a frame from `VideoCapture.gif` (for example with ImageMagick: `magick VideoCapture.gif[0] VideoCapture_screenshot.png`) and place it in the repo as `VideoCapture_screenshot.png`, then update this README to reference that file instead.

Important files
---------------
- `src/entities.js` — Ship and Bullet definitions, damage/shield handling, XP and level code.
- `src/simulate.js` — Deterministic time-step: `simulateStep(state, dt, bounds)`.
- `src/renderer.js` — Visual layer (Canvas) that consumes `state` and event arrays.
- `src/rng.js` — Seeded RNG used by the simulation.
- `src/progressionConfig.js` — XP and progression constants.
- `space_themed_autobattler_canvas_red_vs_blue.html` — Main page to open in a browser.
- `space_themed_autobattler_canvas_red_vs_blue_standalone.html` — Single-file exported build.
- `scripts/build-standalone.mjs` — Bundles the renderer and inlines a standalone HTML in `./dist/`.

Development
-----------

Prerequisites: Node.js (for tests and build tooling), npm.

Install dev dependencies:

```powershell
npm install
```

Run unit tests (Vitest):

```powershell
npm test
```

Build a standalone inlined HTML:

```powershell
npm run build-standalone
```

Serve locally (static server):

```powershell
npm run serve
# then open http://localhost:8080/space_themed_autobattler_canvas_red_vs_blue.html
```

Running the demo locally
------------------------
1. Serve the repository or open `space_themed_autobattler_canvas_red_vs_blue.html` in a modern browser.
2. The renderer imports `src/renderer.js` and runs the visual demo while the simulation logic stays deterministic when seeded.

Testing & determinism
---------------------
- Tests are in `test/` and are written for Vitest.
- Seed the RNG in tests for deterministic results: `srand(12345)`.

Contributing
------------
Contributions welcome. When changing gameplay behavior:
1. Keep changes minimal and surgical.
2. Add/update unit tests under `test/` and seed the RNG for determinism.
3. Preserve public contracts: `simulateStep(state, dt, bounds)` and event shapes (`explosions`, `shieldHits`, `healthHits`).

For larger design decisions consider adding a short Decision Record under `.github/DECISIONS/`.

License
-------
MIT

<!-- markdownlint-disable-file -->

## GameManager API

A `src/gamemanager.js` module centralizes simulation and game state so renderers can remain visual-only. Publicly exported symbols include:

- `reset(seed?)` — reset world state; optionally seed RNG for deterministic runs.
- `simulate(dt, W, H)` — advance game state by dt; returns an object containing `{ ships, bullets, particles, flashes, shieldFlashes, healthFlashes, stars }`.
- `ships, bullets, particles, stars, flashes, shieldFlashes, healthFlashes` — arrays containing live game objects and visual event lists.
- `acquireParticle, releaseParticle, particlePool, Particle` — particle pool and helper for visual effects.
- `initStars()` — regenerate the starfield.
- `setReinforcementInterval(seconds), getReinforcementInterval()` — control reinforcement check timing.
- `resetReinforcementCooldowns(), handleReinforcement(dt, team), evaluateReinforcement(dt)` — reinforcement helpers for tests.

Prefer importing `src/gamemanager.js` directly in unit tests when you need to assert on simulation state without involving the renderer.