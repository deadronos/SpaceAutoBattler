# WebGL Best Practices — SpaceAutoBattler

This document summarizes MDN-backed WebGL and WebGL2 guidance, performance best practices, and tailored recommendations for SpaceAutoBattler. It focuses on high-performance sprite rendering, texture management, shader compilation strategies, and graceful fallbacks.

## Summary

- Use WebGL/WebGL2 when you need GPU-accelerated rendering for large numbers of sprites, advanced blending, or complex effects.
- Prefer instanced rendering (`drawArraysInstanced`, `drawElementsInstanced`) for drawing many similar objects (e.g., fleets of ships).
- Upload textures and resources thoughtfully to avoid pipeline flushes — prepare textures ahead of time and avoid uploading during draw calls.
- Compile and link shaders responsibly: compile shaders early, link programs, and use `KHR_parallel_shader_compile` when available.
- Use sync/fences and async readback for operations requiring GPU->CPU transfers.

## 1. Getting a WebGL context

```js
const canvas = document.getElementById('gl-canvas');
const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
if (!gl) {
  console.warn('WebGL not available — falling back to Canvas 2D');
}
gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
```

Pass context attributes like `{ antialias: false, depth: false }` when requesting a context if you want to optimize for performance.

## 2. Instancing & batching

- Use `drawArraysInstanced` / `drawElementsInstanced` or the WEBGL_multi_draw extension to render many sprites/objects with a single draw call.
- Pack per-instance data into a VBO with `vertexAttribDivisor` to control per-instance attributes.

Example (drawArraysInstanced):

```js
// Setup per-instance attribute with divisor
gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
gl.vertexAttribPointer(instAttrLoc, 2, gl.FLOAT, false, 0, 0);
gl.vertexAttribDivisor(instAttrLoc, 1);
// Draw N instances
gl.drawArraysInstanced(gl.TRIANGLES, 0, vertexCount, instanceCount);
```

## 3. Texture uploads and pipeline flushes

- Avoid uploading textures (`texImage2D`, `texSubImage2D`) during the middle of a frame for many textures — schedule uploads outside hot paths.
- Uploads from DOM elements (HTMLImageElement, HTMLVideoElement) may cause internal conversions and pipeline flushes; use `createImageBitmap()` where possible and upload from ImageBitmap to reduce costs.
- Use texture compression formats and mipmaps for large textures where appropriate.

## 4. Shader compilation & program linking

- Compile shaders ahead of time. Use a two-phase approach: compile all shaders, then link programs. This reduces the risk of pipeline stalls.
- Use `KHR_parallel_shader_compile` extension if available to allow asynchronous compilation.
- Defer heavy validation and logs to development builds only.

## 5. Readback and sync

- Avoid synchronous `readPixels()` and `getBufferSubData()` on the main thread; prefer async readback using pixel pack buffers and `getBufferSubData` with fences.
- Example async readPixels (WebGL2): create PIXEL_PACK_BUFFER, call readPixels into it, then use fenceSync and getBufferSubData after GPU work completes.

## 6. Performance tips (MDN + tailored)

- Minimize WebGL state changes — bind once, draw many.
- Use VAOs (WebGL2) to store attribute state for faster binds.
- Use `drawElementsInstanced` for repeated geometry.
- Consider rendering to a smaller backbuffer and upscale for performance/quality trade-offs.
- Avoid expensive WebGL calls in production (getError, getParameter, getShaderInfoLog frequently).

## 7. Fallback strategy

- Detect WebGL/WebGL2 support and gracefully fall back to Canvas 2D rendering (use the existing renderer). Keep shared rendering logic in simulation and transform rendering code between backends.

## 8. Recommended repo changes

- `src/render/webgl/` folder with:
  - `glContext.ts` — safe context acquisition and attribute handling
  - `instancedRenderer.ts` — instanced sprite renderer for ships
  - `textureManager.ts` — pre-upload textures, manage mipmaps, and handle ImageBitmap uploads
  - `shaderCache.ts` — compile-once and cache shader programs (use KHR_parallel_shader_compile when available)

- Tests: headless WebGL tests via Playwright + WebGL canvas capture; smoke test that draws simple instanced sprites and asserts pixel differences.

## 9. Short examples

- Parallel shader compile detection:

```js
const ext = gl.getExtension('KHR_parallel_shader_compile');
if (ext) {
  // compile then check ext.COMPLETION_STATUS_KHR on program later
}
```

- Render to smaller back buffer:

```js
canvas.style.width = `${displayW}px`;
canvas.style.height = `${displayH}px`;
canvas.width = Math.floor(displayW * 0.5);
canvas.height = Math.floor(displayH * 0.5);
gl.viewport(0, 0, canvas.width, canvas.height);
```

---

File: `docs/webgl-best-practices.md`

Created and seeded with MDN-backed content and SpaceAutoBattler-specific recommendations.

If you'd like, I can now implement a small `src/render/webgl/instancedRenderer.ts` proof-of-concept plus tests. Which should I do next?