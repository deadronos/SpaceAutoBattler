# SpaceAutoBattler

AutoBattler simulation and renderer for space fleet battles.
## Quickstart

1. Install dependencies: `npm install`
## Architecture: Canonical GameState

All simulation, rendering, and UI state is centralized in the canonical `GameState` type (`src/types/index.ts`).
Every subsystem (simulation, renderer, UI) receives and mutates the `GameState` object—no scattered state variables.
Simulation is deterministic and uses seeded RNG (`src/rng.ts`).
State serialization and deserialization are supported for replay, debugging, and determinism validation.
## Contributor Workflow

1. Make minimal, targeted edits. Prefer small, test-backed changes.
4. All new code and tests must use the canonical `GameState` for state access and mutation.
5. For serialization/replay, use the provided helpers and validate determinism with test cases.
## Recent Changes

- Canonical `GameState` type now required for all simulation, renderer, and UI logic.
- All state must be a property of `GameState`.
- Renderer and simulation refactored to use only `GameState`.
- Serialization and replay logic added for determinism and debugging.
## Maintainers

- Owner: deadronos
- Main branch: `main`
## Simulation boundary behavior

The simulation exposes a config option for boundary behavior of ships and bullets:

- `src/config/simConfig.ts` — `boundaryBehavior` object with `ships` and `bullets` keys.
	- Each can be set to `'remove'`, `'wrap'`, or `'bounce'`.
		- `'remove'`: entities are removed when out of bounds.
		- `'wrap'`: entities wrap around the playfield edges (toroidal).
		- `'bounce'`: entities bounce off the edges, inverting velocity.

Example usage:

```typescript
import { boundaryBehavior } from './src/config/simConfig';
boundaryBehavior.ships = 'bounce';
boundaryBehavior.bullets = 'wrap';
```

Unit tests cover all three behaviors for both ships and bullets in `test/vitest/simulationflow.spec.ts`.
# SpaceAutoBattler

[![Gameplay preview — click to open VideoCapture.gif](VideoCapture.gif)](VideoCapture.gif)

A small, deterministic 2D auto-battler (Red vs Blue) implemented with TypeScript/ES modules and a Canvas 2D renderer. The simulation is deterministic when seeded and is separated from the renderer so game logic can be unit tested independently from visuals.

## Why this project exists

- A compact, deterministic simulation useful for experimentation and automated testing.
- A renderer that consumes minimal, numeric event objects from the simulator (explosions, shieldHits, healthHits) so visuals are replayable.

## Highlights

- Deterministic RNG via `src/rng.ts` (use `srand(seed)` in tests).
- Ships with HP, regenerating shields, XP, and per-level progression (`src/progressionConfig.ts`).
- Bullets carry `ownerId` so kills and XP credit are attributed correctly.
- The simulation step `simulateStep(state, dt, bounds)` is pure game-logic and emits small event arrays for the renderer.

## Design notes — authoritative sources and configs

- Game logic and the authoritative GameManager implementation live in TypeScript: `src/gamemanager.ts`.
- The build system now uses only TypeScript sources in `/src/*.ts` for all runtime and bundling. No JS shims or transpilation steps are required.
- Fleet composition and team defaults are configured under `src/config/teamsConfig.ts` (re-exported as `TeamsConfig`). The manager (and UI) now sample ship types from `TeamsConfig.defaultFleet.counts` when `spawnShip()` is called without an explicit type. If no counts are present the manager falls back to `getDefaultShipType()` for deterministic behavior.

These choices keep balancing/config in config modules and the runtime behavior in TS source so tests remain deterministic and UI behavior reflects configured fleet composition.

## Quick demo

Click the preview above to view the animated capture (`VideoCapture.gif`). If you prefer a static screenshot, extract a frame from `VideoCapture.gif` (for example with ImageMagick: `magick VideoCapture.gif[0] VideoCapture_screenshot.png`) and place it in the repo as `VideoCapture_screenshot.png`, then update this README to reference that file instead.

## Important files

- `src/entities.ts` — Ship and Bullet definitions, damage/shield handling, XP and level code.
- `src/simulate.ts` — Deterministic time-step: `simulateStep(state, dt, bounds)`.
- `src/canvasrenderer.ts` / `src/webglrenderer.ts` — Visual layer (Canvas/WebGL) that consumes `state` and event arrays.
- `src/rng.ts` — Seeded RNG used by the simulation (use `srand(seed)` in tests).
- `src/progressionConfig.ts` — XP and progression constants.
- `src/gamemanagerConfig.ts` — visual/config defaults for the gamemanager (explosion/shield/health/stars).
- `space_themed_autobattler_canvas_red_vs_blue.html` — Main page to open in a browser.
- `space_themed_autobattler_canvas_red_vs_blue_standalone.html` — Single-file exported build.
- `scripts/build-standalone.mjs` — Bundles the renderer and inlines a standalone HTML in `./dist/`.

## Migration & Agentic Docs

---

- **Type/config migration decision records:** See `/PR_NOTES/2025-08-23-type-config-tightening.md` for the latest major migration.
- **Granular change logs:** See `.copilot-tracking/changes/2025-08-23-*` for details on recent type/config changes.
- **Implementation status:** See `/spec/IMPLEMENTATION_STATUS.md` for current migration and config status.
- **Agentic workflow guide:** See `/docs/agentic-migration-workflow.md` for how agents and contributors should discover and execute migrations.
- **Contributor guidelines:** See `AGENTS.md` for requirements, validation, and cross-links to all major docs.

## Development

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

## Build & standalone workflow (new)

This repository includes a small build helper that bundles the ES modules in `src/` and produces distributable files in `dist/`.

- Build the JS bundle + `dist/index.html` (links the bundle) and a single-file `dist/standalone.html` that inlines the JS and CSS:

```powershell
npm run build-standalone
```

- Build and watch for changes (rebuilds on save):

```powershell
npm run build-standalone:watch
```

Outputs placed in `dist/`:

- `dist/bundle.js` — ES module bundle of `src/main.ts` and its imports.
- `dist/bundle.css` — concatenated CSS extracted from `src/styles/`.
- `dist/index.html` — a small HTML page that references `./bundle.css` and `./dist/bundle.js`.
- `dist/standalone.html` — a single-file HTML with the CSS and JS inlined for easy distribution.

To preview the built output locally, you can serve the `dist/` folder with a static server, e.g.:

```powershell
npx http-server ./dist -c-1 -p 8080
# then open http://localhost:8080/index.html
```

## Render the architecture flowchart (Graphviz / DOT)

This repo includes a DOT source at `docs/flowchart.dot` (Graphviz). You can render it to SVG in two ways:

- If you have Graphviz installed (native `dot` command):

```powershell
dot -Tsvg docs/flowchart.dot -o docs/flowchart.svg
```

- If you prefer a JS-only path (no native Graphviz), install `viz.js` and use the included helper:

```powershell
npm install --save-dev viz.js
node tools/renderDot.cjs docs/flowchart.dot docs/flowchart.svg
```

The repository also contains `docs/flowchart.dot` (source). If you want me to run the render and commit the SVG for you, I can add `viz.js` as a devDependency and generate `docs/flowchart.svg` in the repo — tell me to proceed.

## Migration: initStars and createStarCanvas API changes

Recent changes made the `initStars` and `createStarCanvas` APIs explicit to improve determinism and testability.

- Old (legacy) signatures:

```js
// legacy - ambiguous star source (removed)
// initStars(W, H, count);
// createStarCanvas(W, H, bg);
```

- New signatures (BREAKING change):

```js
// new - explicit state-first API
// state must be an object containing `stars` array, e.g. { stars }
initStars(state, (W = 800), (H = 600), (count = 140));
createStarCanvas(state, (W = 800), (H = 600), (bg = "#041018"));
```

Migration steps:

1. Where you previously called `initStars(W, H, count)`, change it to:

```js
// assume you have `const stars = []` somewhere
initStars({ stars }, W, H, count);
// or pass your existing state object that contains a `stars` array
initStars(state, W, H, count);
```

2. For `createStarCanvas`, prefer passing the same state object so the function reads the canonical star list:

```js
// recommended
const canvas = createStarCanvas({ stars }, W, H, "#041018");

// legacy form is still supported for now but will be removed in a future release
// createStarCanvas(W, H, '#041018');
```

3. Ensure your code seeds the RNG before calling `initStars` if you expect deterministic results in tests:

```js
import { srand } from "./src/rng.js";
srand(12345);
initStars(state, 800, 600, 140);
```

Rationale:

- Passing `state` first makes the star helpers explicitly operate on the provided star array and avoids implicit global state usage. It also keeps RNG call order deterministic for tests.

If you want help updating a specific file or test to the new API, tell me which file and I will update it.

## Gamemanager visual/config note

The file `src/gamemanagerConfig.ts` centralizes visual tuning defaults for the game manager (matching the style of `behaviorConfig.ts` and `progressionConfig.ts`).

- It exports named defaults: `SHIELD`, `HEALTH`, `EXPLOSION`, and `STARS`.
- The runtime `src/gamemanager.js` copies these into a `config` object and exposes `setManagerConfig()` for shallow merging of runtime overrides.

Example (change explosion particle count at runtime):

```powershell
// Example usage in TypeScript:
// import { setManagerConfig, getManagerConfig } from './src/gamemanager.ts';
// setManagerConfig({ explosion: { particleCount: 24 } });
// console.log(getManagerConfig().explosion.particleCount);
```

`setManagerConfig` performs a shallow merge for top-level object keys, so partial updates only modify supplied fields.

## Running the demo locally

1. Serve the repository or open `space_themed_autobattler_canvas_red_vs_blue.html` in a modern browser.
2. The renderer imports `src/canvasrenderer.ts` or `src/webglrenderer.ts` and runs the visual demo while the simulation logic stays deterministic when seeded.

## Testing & determinism

- Tests are in `test/` and are written for Vitest.
- Seed the RNG in tests for deterministic results: `srand(12345)`.

## Playwright (JS vs TS discovery)

If Playwright's VS Code extension or test discovery doesn't show your Playwright tests, it may be configured to look for TypeScript tests by default. This repo uses JavaScript test files in `test/playwright/`.

- Ensure the Playwright extension is pointed at the repo config (we set this in `.vscode/settings.json` via `"playwright.configPath": "playwright.config.cjs"`).
- If the extension is configured for TypeScript projects, change the language/discovery option to JavaScript or set Playwright's init options to JavaScript so files like `test/playwright/*.test.js` are discovered.
- Alternatively, use an explicit glob in your Test Explorer settings (see `.vscode/settings.json`) such as `test/**/*.test.js` or the explicit array of patterns to force discovery of `.js` tests.

This project includes a `.vscode/settings.json` entry that helps both Playwright and Test Explorer locate JS tests.

## Contributing

Contributions welcome. When changing gameplay behavior:

1. Keep changes minimal and surgical.
2. Add/update unit tests under `test/` and seed the RNG for determinism.
3. Preserve public contracts: `simulateStep(state, dt, bounds)` and event shapes (`explosions`, `shieldHits`, `healthHits`).

For larger design decisions consider adding a short Decision Record under `.github/DECISIONS/`.

## License

MIT

<!-- markdownlint-disable-file -->

## GameManager API

The GameManager implementation and API are written in TypeScript (`src/gamemanager.ts`).
Publicly exported symbols include:

- `reset(seed?)` — reset world state; optionally seed RNG for deterministic runs.
- `simulate(dt, W, H)` — advance game state by dt; returns an object containing `{ ships, bullets, particles, flashes, shieldFlashes, healthFlashes, stars }`.
- `ships, bullets, particles, stars, flashes, shieldFlashes, healthFlashes` — arrays containing live game objects and visual event lists.
- Particle pooling helpers (state-first API): use `acquireParticle(state, x, y, opts)` and `releaseParticle(state, p)`; pool free-lists live under `state.assetPool.effects.get('particle')` for inspection.

Example:

```typescript
import { makeInitialState } from './src/entities';
import { acquireParticle, releaseParticle } from './src/gamemanager';

const state = makeInitialState();
const p = acquireParticle(state, 100, 200, { vx: 1, vy: -0.5, ttl: 0.8 });
// When particle expires or is no longer needed:
releaseParticle(state, p);

// Inspect free-list size:
const freeCount = (state.assetPool.effects.get('particle') || []).length;
```
- `initStars()` — regenerate the starfield.
- `setReinforcementInterval(seconds), getReinforcementInterval()` — control reinforcement check timing.
- `resetReinforcementCooldowns(), handleReinforcement(dt, team), evaluateReinforcement(dt)` — reinforcement helpers for tests.

Import `src/gamemanager.ts` directly in unit tests when you need to assert on simulation state without involving the renderer.

## WebGL Renderer (Experimental)

### Overview

The WebGL renderer is an experimental feature designed to improve performance and visual fidelity. It uses instanced rendering and batching techniques to minimize draw calls and optimize GPU usage.

### How to Start

1. Ensure you have a local server running (`npm run serve`).
2. Open `space_themed_autobattler_canvas_red_vs_blue_standalone.html` in your browser.

### Key Files

- `src/webglrenderer.ts`: Core WebGL rendering logic.
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
- All randomness is sourced from the simulation (`rng.ts`).
- Precision qualifiers (`mediump`, `highp`) are used in shaders for mobile compatibility.
