# main.ts — Application entry and glue logic

Last-Reviewed: 2025-09-15

This memory documents the role and key behaviors of `src/main.ts`.

Purpose

- Application bootstrap for SpaceAutoBattler. Initializes GameState, assets, physics, renderer, UI bindings, and main loops.
- Exposes debug helpers on `window` for asset inspection and perf diagnostics.

Key responsibilities

- Apply global renderer patches early via `applyGlobalPatches()`.
- Ensure single shared `THREE` instance on `globalThis` to avoid multiple-three instances issues.
- Create initial `GameState` via `createInitialState(seed)` and initialize `state.assetPool`.
- Preload SVG assets (unless GLTF mode or SVG subsystem disabled) and populate `state.assetPool` with rasterized SVG bitmaps.
- Configure and start physics: prefer a module `simWorker` worker for Rapier; fallback to in-thread physics stepper via `createPhysicsStepper` when worker creation fails or disabled.
- When using simWorker: pack ship state into Float32Array and send to worker, receive transferable Float32Array transform buffers and apply to `state.ships` positions/velocities.
- Optionally preload GLTF ship models and register prototypes with `shipInstancer`.
- Spawn initial fleets and call `createThreeRenderer` to create renderer using `ui.canvas`.
- Wire UI controls (`wireControls`) and camera controls (`setupCameraControls`), setup perf overlay and start the main render/sim loops (`startLoops`).

UI & controls

- `bindUI()` collects DOM elements for UI interactions.
- `wireControls()` wires buttons and toggles for start/pause, reset, add ships, toggle trails, speed, seed, and formation.
- `setupCameraControls()` attaches mouse/keyboard/wheel handlers, supports cinematic camera and manual movement with WASD, C to enter cinematic mode.

Loops & perf

- `startLoops()` runs a fixed-step simulation loop with a max steps guard, steps physics via `state.physicsStepper?.step`, advances state.time/tick, and calls `state.renderer.render(dt)` each frame.
- Provides an optional perf overlay controlled by query parameter `showPerf=1` and a debug perf collector `?debugPerf=1`.

Debugging & globals

- `window.__appDebug` exposes state, asset pool accessors, and lazy loader wrappers for manual preloading.
- `window.debugSVG` exposes svg loader operations (getStats, reloadAll, clearCache, listCached) when SVG subsystem active.
- Query params supported: `instancerDebug`, `debugPerf`, `showPerf`.

Integration points

- Uses `createThreeRenderer` from `src/renderer/threeRenderer.ts` for rendering.
- Interfaces with `core/gameState`, `core/physics`, `core/svgLoader`, `renderer/shipInstancer`, `renderer/meshFactory` and various `config/*` modules.

When to update

- Update this memory when `src/main.ts` changes bootstrap sequence, worker messaging contract, or public debug utilities.

Notes from this session (2025-09-15): Reviewed and updated last-reviewed date.
