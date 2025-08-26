# Canvas Best Practices — SpaceAutoBattler

This document consolidates MDN-backed Canvas API guidance and tailored recommendations for SpaceAutoBattler. It covers the Canvas 2D API surface, performance best practices, worker/offscreen rendering patterns, HiDPI handling, and code examples you can drop into the codebase.

## Summary

- Use `HTMLCanvasElement.getContext('2d')` to obtain a `CanvasRenderingContext2D` for 2D drawing.
- Use `OffscreenCanvas` in Web Workers for CPU/GPU-heavy rendering to avoid blocking the main thread.
- Use `createImageBitmap()` and `ImageBitmap` for efficient image decoding and drawing.
- Use `Path2D` for reusable complex shapes.
- Use `requestAnimationFrame()` for animations.


## 1. API Reference (short)

- getContext(type, attributes)
  - `type`: '2d', 'webgl', 'webgl2', 'webgpu', 'bitmaprenderer'
  - 2D `attributes`: `alpha`, `colorSpace` ('srgb'|'display-p3'), `colorType` ('unorm8'|'float16'), `desynchronized`, `willReadFrequently`

- Common methods on `CanvasRenderingContext2D`:
  - Drawing & paths: `beginPath()`, `moveTo()`, `lineTo()`, `arc()`, `arcTo()`, `quadraticCurveTo()`, `bezierCurveTo()`, `closePath()`, `stroke()`, `fill()`
  - Rects: `fillRect()`, `strokeRect()`, `clearRect()`
  - Images: `drawImage()`, `createPattern()`
  - Pixel access: `getImageData()`, `putImageData()`
  - State & transforms: `save()`, `restore()`, `setTransform()`, `getTransform()`, `reset()`, `translate()`, `scale()`, `rotate()`
  - Text: `fillText()`, `strokeText()`, `measureText()`


## 2. Performance best practices (tailored)

- Use `requestAnimationFrame()` for the main render loop:

```js
function frame() {
  updateSimulation();
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- Offscreen rendering: Use `OffscreenCanvas` for expensive rasterization (e.g., svg -> raster) and run it in a worker. For example, adapt `svgLoader` to post SVG text to a worker that uses an `OffscreenCanvas` to rasterize and returns an `ImageBitmap`.

- Use `createImageBitmap()` to decode images off the main thread. Pass the resulting `ImageBitmap` to `drawImage()` for fast blits.

- Pool canvas elements and ImageBitmap objects where practical to reduce GC pressure. SpaceAutoBattler already uses asset pooling patterns (`src/assetPool.ts`) — add canvas/ImageBitmap pools for transient buffers.

- Batch draw calls and minimize context state switches. If many ships share the same styles, draw them in a single pass with the same ctx state.

- Use `willReadFrequently` only when you truly need many `getImageData()` calls. It can force software rendering and reduce GPU acceleration.

- For HiDPI displays, set canvas width/height attributes to pixel size and scale the drawing context by `devicePixelRatio`:

```js
function setupHiDPI(canvas, widthCss, heightCss) {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(widthCss * ratio);
  canvas.height = Math.floor(heightCss * ratio);
  canvas.style.width = widthCss + 'px';
  canvas.style.height = heightCss + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}
```

- Avoid `shadowBlur` and heavy filters on many objects — pre-render glow/shadow into a sprite or cached canvas and re-use it.


## 3. Offscreen-worker pattern (svg rasterization example)

- Main thread:

  - `const off = canvas.transferControlToOffscreen(); worker.postMessage({canvas: off}, [off]);`

  - Or for rasterization-only worker: `worker.postMessage({svgText, width, height});` and receive `ImageBitmap`.

- Worker:

  - Use `OffscreenCanvas` and `createImageBitmap()` for efficient rasterization and transferring back to main thread.


## 4. Suggested repo additions (code + tests)

- `src/render/canvasUtils.ts` — helpers: `setupHiDPI`, `createWorkerRasterizer`, `poolCanvas`, `drawImageSafe`.
- `src/assets/svgWorker.ts` — worker-side rasterizer that accepts SVG text and returns `ImageBitmap` via `postMessage`.
- Tests: small Playwright test that loads a page, draws to a canvas, and asserts non-empty pixels via screenshot.


## 5. Quick reference snippets

- Draw an ImageBitmap with fallback:

```js
async function drawSprite(ctx, src) {
  let bitmap;
  if (src instanceof ImageBitmap) bitmap = src;
  else if (src instanceof HTMLImageElement) bitmap = await createImageBitmap(src);
  else bitmap = src;
  ctx.drawImage(bitmap, 0, 0);
}
```

- Reusable Path2D caching:

```js
const shipPath = new Path2D('M10 10 L20 10 L15 20 Z');
ctx.fill(shipPath);
```


## 6. Accessibility & testing

- Provide non-canvas fallbacks (descriptive HTML, transcripts) for UI elements that convey critical information.
- For tests, use Playwright to assert canvas rendering results by comparing pixel snapshots saved under `playwright-report/`.

---

File: `docs/canvas-best-practices.md`

Created and seeded with MDN-backed content and SpaceAutoBattler-specific recommendations.

Next steps (if you want):

- I can implement `src/render/canvasUtils.ts` and `src/assets/svgWorker.ts` with unit tests and a small Playwright test.
- Or keep this as a documentation-only change.
