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

Build & standalone workflow (new)
--------------------------------

This repository includes a small build helper that bundles the ES modules in `src/` and produces distributable files in `dist/`.

- Build only the JS bundle (outputs `dist/bundle.js`):

```powershell
npm run build-bundle
```

- Build the JS bundle + `dist/index.html` (links the bundle) and a single-file `dist/standalone.html` that inlines the JS and CSS:

```powershell
npm run build-standalone
```

- Build and watch for changes (rebuilds on save):

```powershell
npm run build-standalone:watch
```

Outputs placed in `dist/`:

- `dist/bundle.js` — ES module bundle of `src/main.js` and its imports.
- `dist/bundle.css` — concatenated CSS extracted from `src/styles/`.
- `dist/index.html` — a small HTML page that references `./bundle.css` and `./dist/bundle.js`.
- `dist/standalone.html` — a single-file HTML with the CSS and JS inlined for easy distribution.

To preview the built output locally, you can serve the `dist/` folder with a static server, e.g.:

```powershell
npx http-server ./dist -c-1 -p 8080
# then open http://localhost:8080/index.html
```

Running the demo locally
------------------------
1. Serve the repository or open `space_themed_autobattler_canvas_red_vs_blue.html` in a modern browser.
2. The renderer imports `src/renderer.js` and runs the visual demo while the simulation logic stays deterministic when seeded.

Testing & determinism
---------------------
- Tests are in `test/` and are written for Vitest.
- Seed the RNG in tests for deterministic results: `srand(12345)`.

Playwright (JS vs TS discovery)
--------------------------------
If Playwright's VS Code extension or test discovery doesn't show your Playwright tests, it may be configured to look for TypeScript tests by default. This repo uses JavaScript test files in `test/playwright/`.

- Ensure the Playwright extension is pointed at the repo config (we set this in `.vscode/settings.json` via `"playwright.configPath": "playwright.config.cjs"`).
- If the extension is configured for TypeScript projects, change the language/discovery option to JavaScript or set Playwright's init options to JavaScript so files like `test/playwright/*.test.js` are discovered.
- Alternatively, use an explicit glob in your Test Explorer settings (see `.vscode/settings.json`) such as `test/**/*.test.js` or the explicit array of patterns to force discovery of `.js` tests.

This project includes a `.vscode/settings.json` entry that helps both Playwright and Test Explorer locate JS tests.

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

## WebGL Renderer (Experimental)

### Overview
The WebGL renderer is an experimental feature designed to improve performance and visual fidelity. It uses instanced rendering and batching techniques to minimize draw calls and optimize GPU usage.

### How to Start
1. Ensure you have a local server running (`npm run serve`).
2. Open `space_themed_autobattler_canvas_red_vs_blue_standalone.html` in your browser.

### Key Files
- `src/webglRenderer.js`: Core WebGL rendering logic.
- `src/webgl_head.js`: Shader definitions and setup.

### Additional WebGL files

- `src/webglRenderer_HEAD.js` — renderer head / setup helpers.
- `src/webglUtils.js` — utility helpers for GL (shader compile/link, buffer helpers, VAO helpers).

### Start (development)

```powershell
npm run serve
# then open http://localhost:8080/space_themed_autobattler_canvas_red_vs_blue.html and choose the WebGL renderer if the UI exposes it
```

### Notes
- The WebGL renderer adheres to the deterministic simulation contract.
- All randomness is sourced from the simulation (`rng.js`).
- Precision qualifiers (`mediump`, `highp`) are used in shaders for mobile compatibility.