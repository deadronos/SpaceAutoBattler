
# Renderer scale (RendererConfig.rendererScale)

All rendering is driven by the canonical `GameState` object (`src/types/index.ts`). The renderer receives the current `GameState` and renders only from its properties—no scattered state variables. This ensures deterministic, reproducible visuals and supports serialization/replay for debugging and validation.

Purpose: `RendererConfig.rendererScale` is a developer-facing multiplier applied on top of `window.devicePixelRatio` to scale the renderer backing store. It allows you to increase or decrease the number of physical pixels the canvas uses without changing the logical (CSS) scene coordinate system.

## How it works

The UI and simulation use logical (CSS) pixels for coordinates (ship.x, ship.y, sizes).

`main.fitCanvasToWindow()` sets the canvas's backing-store size (canvas.width/height) to `bounds * (devicePixelRatio * rendererScale)`.

For the Canvas renderer, the renderer sets a transform on the 2D context so you can continue drawing using logical coordinates while the backing store is higher-resolution.

For the WebGL renderer, the viewport uses the backing-store pixel dimensions so shader coordinates can be adapted appropriately.

## Practical notes & limits

- Increasing `rendererScale` above 1 improves clarity (useful for screenshots or high-DPI recording) but increases GPU/CPU work because the canvas backing store grows (memory and fill cost increase roughly quadratically with scale).

- Very high values (2x, 3x) may be slow on low-end GPUs or may exceed browser/OS maximum texture sizes for WebGL surfaces.

- Keep `rendererScale` between 0.5 and 2.0 for normal interactive use; use higher values only for one-off high-quality captures.

## Developer controls

- There's a developer slider in the UI (`Renderer scale` in the on-page controls) that updates `RendererConfig.rendererScale` and re-sizes the backing store at runtime.

- When the backing store is changed, the Canvas renderer re-applies its 2D context transform and the WebGL renderer updates its viewport so visuals remain consistent.

## Troubleshooting

- If visuals appear unchanged after changing the slider:

  - Ensure the page's dev slider is wired and that the renderer re-initializes (the app calls `renderer.init()` or `renderer.updateScale()` when the backing store changes).

  - For WebGL, check the browser console for context loss or errors; fall back to Canvas if WebGL fails.

- If rendering becomes choppy after raising the scale, lower `rendererScale` to reduce CPU/GPU workload.

This document is intentionally short — see the code in `src/main.js`, `src/canvasrenderer.ts`, and `src/webglrenderer.ts` for the concrete implementation details.
