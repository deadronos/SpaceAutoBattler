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
