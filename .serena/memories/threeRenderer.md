# threeRenderer.ts — Renderer overview

Last-Reviewed: 2025-09-07

This memory captures the state and responsibilities of `src/renderer/threeRenderer.ts` based on the provided file excerpt.

## Purpose
- Implements the Three.js renderer used by SpaceAutoBattler.
- Creates and configures the `THREE.WebGLRenderer`, `Scene`, and `PerspectiveCamera`.
- Manages camera positioning and a focus helper (`__focusCameraOn`).
- Generates a procedural animated skybox (cube textures and an interior sphere fallback).
- Adds scene lighting and world boundary wireframe visualization.
- Manages object containers/groups for ships, bullets, health bars, and shield effects.
- Offers developer debug helpers exposed on `globalThis` for runtime inspection (listing meshes, instanced health bar diagnostics, periodic logging).
- Integrates asset pooling and lazy SVG rasterization for ship visuals; supports optional glTF prototypes and instancers.
- Initializes instancers: bullet instancer, health bar instancer, and ship instancer (if enabled in config).
- Implements mesh factories: `meshForShip`, `meshForBullet`, and `createHealthBar`/`updateHealthBar` and `createShieldEffect`.

## Notable behaviors & details
- Uses a seeded RNG (falls back to createRNG) to support deterministic visuals when possible.
- Procedural skybox generation uses a precomputed starfield and animated canvases; supports nebula overlays and twinkling.
- Exposes multiple debug utilities on `globalThis`, including `__listNonInstancedMeshes`, `__highlightNonInstancedMeshes`, `__listInstancedHealthBarShips`, `__hbInstancerStats`, `__hbDebugScale`, `__hbDebugMatrix`, `__hbPeriodicStart`, `__hbPeriodicStop`, `__dumpShipsNearBounds`, and `__listShipsWithHealthBar`.
- Health bars support GPU billboarding via pooled shader materials when `GPU_BILLBOARD` is true.
- Uses careful try/catch and logging when wiring optional dev helpers and instancer initialization to avoid breaking production builds.
- Uses `RendererConfig` and `RendererEffectsConfig` extensively for configurable behavior (e.g., instancing, skybox size, starfield counts, lighting, health bar sizing).
- Uses `assetPool` from `GameState` for caching rasterized SVG assets and possible glTF prototypes.
- Instruments `group.add` for `shipsGroup`, `healthBarsGroup`, and `scene` to detect stray Mesh additions and aid debugging.

## Interfaces & helpers mentioned
- createThreeRenderer(state: GameState, canvas: HTMLCanvasElement): RendererHandles
- meshForShip(s: Ship): THREE.Object3D
- meshForBullet(b: Bullet): THREE.Object3D
- createHealthBar(ship: Ship): THREE.Object3D
- updateHealthBar(ship: Ship, barGroup: THREE.Object3D)
- createShieldEffect(ship: Ship): THREE.Object3D

## Integration points
- Relies on `state.simConfig`, `state.rng`, `state.assetPool`, and `state.ships`/`state.bullets`.
- Uses `ShipVisualConfig`, `RendererConfig`, `RendererEffectsConfig` and `defaultSVGConfig` values from project config.
- Ship SVG rasterization via `loadSVGAsset` and image bitmap cache in `assetPool`.
- May allocate ships into `shipInstancer` when GLTF prototypes are available.

## Acceptance / when to update
- Update this memory when `src/renderer/threeRenderer.ts` is modified in a meaningful way (API, major internal behavior, debug helpers, or config keys).

## Quick notes
- File includes many defensive try/catch blocks — changes to debug helper wiring should preserve these guards.
- Health bar instancing and GPU billboarding are notable performance optimizations and should be documented if changed.


Generated on 2025-09-07 by GitHub Copilot agent.