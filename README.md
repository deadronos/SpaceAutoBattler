# Space Autobattler

This is a small browser-based space-themed auto-battler game (Red vs Blue).

This repo now contains modular game logic under `src/` and unit tests under `test/` using Vitest.

Getting started (PowerShell on Windows):

```powershell
# From repository root (d:\GitHub\SpaceAutoBattler)
npm install
npm test
# Optional: run in watch mode
npx vitest --watch
```

To view the game in a browser during development you can run a tiny static server and open the HTML file:

```powershell
# install the dev dependencies first (if not already installed)
npm install
# start a local server on http://localhost:8080
npm run serve
# then open http://localhost:8080/space_themed_autobattler_canvas_red_vs_blue.html in your browser
```

Notes:
- The visual renderer is in `src/renderer.js` and references the DOM canvas in the HTML.
- Core logic suitable for unit testing is split into `src/rng.js`, `src/entities.js`, and `src/simulate.js`.
- Tests are located in `test/` and are runnable with Vitest.

Deterministic RNG & draw-ordering (testing)
-----------------------------------------
The project uses a seeded RNG (`src/rng.js`) for all gameplay randomness. For deterministic tests that simulate UI flows (for example clicking Add Red/Blue), the draw order is:

- type index (via `randomShipType()` / `srangeInt`) ->
- position X (`srange`) -> position Y (`srange`) ->
- per-type numeric draws (only for the chosen type; e.g. corvette/frag/destroyer/fighter ≈ 3 draws, carrier ≈ 6 draws total).

When writing deterministic tests, call `srand(seed)` once and pre-consume draws in this order (or use the public helpers that mirror the real draw order) before invoking the UI helper that creates ships. This avoids surprising RNG cross-talk between unrelated code paths.

Strict seeded mode (CI)
-----------------------
To enforce that tests always seed the RNG (prevent accidental use of `Math.random()`), the library supports a strict mode controlled by the environment variable `RNG_REQUIRE_SEEDED`. When set to `1` (or `true`) the RNG will throw if code calls `srandom()`/`srange()` before `srand(seed)` is called.

Enable locally (PowerShell):

```powershell
$env:RNG_REQUIRE_SEEDED = '1'
npm test
```

Programmatic toggle (tests):

```js
import { setRequireSeededMode } from './src/rng.js';
setRequireSeededMode(true);
// run tests that must explicitly call srand(seed)
```

Recommended CI snippet (GitHub Actions):

```yaml
jobs:
	test:
		runs-on: ubuntu-latest
		env:
			RNG_REQUIRE_SEEDED: '1'
		steps:
			- uses: actions/checkout@v4
			- uses: actions/setup-node@v4
				with:
					node-version: 18
			- run: npm ci
			- run: npm test
```

Game mechanics: The simulation features five ship classes—`corvette`, `frigate`, `destroyer`, `carrier`, and `fighter`—each with distinct speed, HP, reload, vision and weapon range (see `src/entities.js`). Ships acquire the nearest visible enemy, lead their shots, and fire bullets with randomized damage; ship kills increment the Red/Blue score shown in the UI. Carriers periodically launch fighters (handled in `src/simulate.js`) and ships wrap around the screen edges. You can seed the simulation RNG using the UI Seed button or `srand(seed)` to make the core simulation deterministic (`src/rng.js`), but note that some purely visual randomness in `src/renderer.js` currently uses `Math.random()` and therefore is not controlled by the seed—swap those uses to the seeded RNG if you need full visual determinism. UI controls include Start/Pause, Reset, Add Red/Blue, Toggle Trails, Speed multiplier, Seed, and Re-form Fleets.

<!-- markdownlint-disable-file -->