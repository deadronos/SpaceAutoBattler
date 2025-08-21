# Architecture Overview

This document describes the runtime flow and contracts of SpaceAutoBattler. It includes a visual flowchart (Mermaid and an SVG) and a short list of runtime contracts, edge cases, and suggested next steps.

## High-level flow

1. Bootstrap (page load)
   - `src/main.js` finds/creates the canvas and UI, chooses a renderer (WebGL2 → WebGL1 → Canvas2D), wires UI buttons, and starts the game loop (requestAnimationFrame or timer).
2. Manager & state
   - `src/gamemanager.js` holds global arrays: `ships`, `bullets`, `particles`, `stars` and helper functions: `reset(seed)`, `initStars`, `createStarCanvas`, `simulate(dt,W,H)`, `evaluateReinforcement`.
3. Simulation step (deterministic core)
   - `simulate()` (manager) builds a `state` object and calls `simulateStep(state, dt, bounds)` in `src/simulate.js`.
   - `simulateStep` advances ships & bullets, resolves collisions, awards XP/kills, and pushes small numeric events into `state.explosions`, `state.shieldHits`, `state.healthHits`.
4. Rendering
   - Renderer (`src/webglRenderer.js` or `src/renderer.js`) reads exported arrays and events and draws frames. WebGL path uses instancing and VBOs.
5. Input & UI
   - UI events mutate manager arrays or call manager methods (e.g., `reset()`), affecting subsequent simulation ticks.

## Flowchart

- Mermaid source: `docs/flowchart.mmd`
- Static vector image: `docs/flowchart.svg`

Below is the Mermaid diagram (rendered in supporting viewers):

```mermaid
flowchart TD
  A[Page load / Bootstrap (main.js)] --> B{Choose renderer}
  B --> |WebGL2| C[createWebGLRenderer]
  B --> |WebGL1/Canvas2D| C1[createCanvasRenderer]
  C --> D[Initialize state & UI wiring]
  C1 --> D
  D --> E[Start game loop (RAF)]
  E --> F[Compute dt & bounds]
  F --> G[Manager.simulate(dt, W,H)]
  G --> H[simulateStep(state, dt, bounds)]
  H --> I[Emit events: explosions, shieldHits, healthHits]
  G --> J[Translate events to persistent flashes]
  E --> K[Renderer.draw() reads ships, bullets, particles, stars, flashes]
  K --> L[WebGL: build typed arrays -> ensureVBO -> safeDrawInstanced]
  L --> M[Frame presented]
  M --> E
  subgraph RNG
    S[srand(seed) / unseed()] --> H
  end
  subgraph UI
    U[Buttons / Input] --> D
    U --> G
  end
```

## Contracts

- `simulateStep(state, dt, bounds)` — mutates `state` and may push to `state.explosions`, `state.shieldHits`, `state.healthHits`.
- Event shapes:
  - Explosion: `{ x, y, team }`
  - Shield hit: `{ id, hitX, hitY, team, amount }`
  - Health hit: `{ id, hitX, hitY, team, amount }`
- RNG: call `srand(seed)` before simulation to get deterministic runs. Use `srandom`, `srange`, `srangeInt` for simulation randomness.

## Edge cases & recommendations

- Headless/test environments: `main.js` is defensive but tests may stub or fabricate a 2D canvas context (see `gamemanager.createStarCanvas`).
- VBO allocation: track bytes and use `safeDrawInstanced` to handle buffer growth or chunked draws.
- Avoid `Math.random()` inside simulation code when determinism is required.
- Prefer regenerating `space_themed_autobattler_canvas_red_vs_blue_standalone.html` via `npm run build-standalone` after source edits.

## Next steps (pick one)

- Create a PR with this doc and the flowchart (I can do that).  
- Add runtime diagnostics endpoints (e.g. `getRendererDiagnostics()`).  
- Generate an interactive SVG rendered from the Mermaid source.  

---

Files added:
- `docs/flowchart.mmd` (Mermaid source)
- `docs/flowchart.svg` (static vector image)

