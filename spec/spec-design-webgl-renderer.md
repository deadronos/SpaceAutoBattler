---
title: WebGL Renderer & WebGL Utilities Specification
version: 1.0
date_created: 2025-08-20
last_updated: 2025-08-20
owner: SpaceAutoBattler Team
tags: [design, webgl, renderer, performance, graphics]
---

## Introduction

This specification defines the requirements, constraints, interfaces, data contracts, testing strategy, and acceptance criteria for the project's WebGL renderer (`src/webglRenderer.js`) and its supporting utilities (`src/webglUtils.js`). The goal is to make the renderer's behavior, integration surface, performance constraints, and testing requirements explicit and machine-friendly so that humans and generative tools can reliably reason about, extend, and verify the implementation.

## 1. Purpose & Scope

Purpose:
- Provide a precise, AI-friendly specification for the WebGL renderer implementation and utility helpers used by SpaceAutoBattler. This document captures what the renderer must do, how it integrates with the rest of the system, and how it should be verified.

Scope:
- Applies to `src/webglRenderer.js` and `src/webglUtils.js` only.
- Covers the runtime behavior (initialization, rendering, resource management), the public API surface, data shapes for inputs and outputs, constraints (performance & compatibility), and test automation strategy.

Intended audience:
- Maintainers and contributors of SpaceAutoBattler.
- Automated code-generation or refactoring tools.
- CI pipelines and test engineers.

Assumptions:
- The simulation step (`simulateStep`) and game state are deterministic and provided by other modules (`src/gamemanager.js`, `src/entities.js`).
- The environment is a browser supporting ES modules; WebGL contexts may be WebGL1 or WebGL2.
- The renderer uses seeded randomness only for non-deterministic visuals when explicitly required; core simulation logic is deterministic.

## 2. Definitions

- Renderer: The component responsible for drawing the game's visual state to a canvas. Can be WebGL-based or a 2D canvas fallback.
- WebGL2: The modern WebGL API available as `webgl2` context. Supports instanced draws and other enhancements.
- Atlas: An offscreen canvas used to store a ship hull image for efficient GPU upload.
- AtlasInfo: An object describing an atlas: `{ tex, size, baseRadius, canvas }` when uploaded to GPU; or `{ canvas, size, baseRadius }` before upload.
- DPR: Device Pixel Ratio (window.devicePixelRatio) used to scale canvas backing buffer size.
- Instanced draw: WebGL2 mechanism that draws many instances of the same geometry with per-instance attributes.
- bufferSubData streaming: Upload pattern where an existing GL buffer is updated via `gl.bufferSubData` to avoid buffer reallocations.
- maxUploadsPerFrame: Limit on how many atlas textures may be uploaded to GPU per frame to reduce upload spikes.

## 3. Requirements, Constraints & Guidelines

Use explicit requirement IDs for traceability.

- **REQ-001**: Initialization API
  - `createWebGLRenderer(canvas, opts)` MUST return a renderer object with at least the following properties and functions: `{ type: 'webgl', init(), start(cb?), stop(), isRunning(), render(state), destroy() }`.
  - If the browser/environment does not provide a usable WebGL context, `createWebGLRenderer` MAY return `null` or throw; the caller (`initRenderer`) is responsible for falling back to the canvas renderer.

- **REQ-002**: Deterministic Integration
  - The renderer MUST NOT modify game logic or simulation state. It consumes a read-only `state` object produced by the simulation loop.

- **REQ-003**: Input data contract for `render(state)`
  - `state` MUST be an object with fields: `{ W?, H?, ships?, bullets?, particles?, stars?, flashes?, shieldHits?, healthHits?, shipsVMap?, score? }`.
  - `ships` is an array of ship objects with at minimum `{ id, x, y, radius, angle, team, alive, shield?, shieldMax?, hp?, hpMax?, level? }`.

- **REQ-004**: Atlas handling
  - The renderer MUST accept an `atlasAccessor(type, radius)` callback in `opts` to obtain an atlas object for a given ship hull and radius.
  - The renderer MUST upload atlas canvases to GPU textures lazily and limit uploads to `maxUploadsPerFrame` per `render` call (configurable via `opts.maxUploadsPerFrame`).

- **REQ-005**: Texture upload policy
  - When atlas dimensions exceed `opts.atlasMaxSize`, the implementation SHOULD downscale the atlas before uploading to reduce GPU upload cost.
  - If `opts.atlasUseMipmaps` is true and the atlas is power-of-two, the renderer SHOULD generate mipmaps for the texture.

- **REQ-006**: Device Pixel Ratio clamping
  - The renderer MUST clamp DPR to a configurable `opts.maxDevicePixelRatio` (default 1.5) before resizing the canvas backing store to avoid large GPU presentation delays.

- **REQ-007**: Instancing
  - If WebGL2 is available and an instanced shader is compiled successfully, the renderer SHOULD use `drawElementsInstanced` for ship batches to reduce CPU draw-call overhead.
  - The instanced attribute layout MUST pack attributes tightly and use typed arrays to minimize allocations.

- **REQ-008**: Streaming buffers
  - The renderer MUST use streaming buffers for dynamic per-frame vertex and index data (grow-on-demand strategy) and prefer `gl.bufferSubData` when the required size <= current capacity.

- **REQ-009**: Index type handling
  - The renderer MUST detect support for 32-bit indices using `OES_element_index_uint` in WebGL1 or native WebGL2 support and choose Uint16Array vs Uint32Array accordingly.

- **REQ-010**: Graceful degradation
  - If an instanced path or optimized shader fails, the renderer MUST fall back to a safe, functional drawing path that produces visually equivalent output.

- **REQ-011**: Shader Precision
  - All shaders MUST explicitly declare precision qualifiers. Fragment shaders SHOULD use `mediump` unless high precision is required for specific calculations.

- **REQ-012**: Deterministic Rendering
  - The renderer MUST NOT use `Math.random()`, `performance.now()`, or any other non-deterministic sources. All randomness and timings MUST come from the simulation event list.

- **REQ-013**: Context Loss Handling
  - The renderer MUST handle `webglcontextlost` and `webglcontextrestored` events. On context loss, it MUST prevent default behavior and reinitialize resources on restoration.

- **REQ-014**: Alpha Blending
  - The renderer MUST use premultiplied alpha blending. Textures and framebuffers MUST be configured with `UNPACK_PREMULTIPLY_ALPHA_WEBGL` and blending set to `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`.

- **REQ-015**: Viewport and Pixel Ratio
  - The renderer MUST update the canvas dimensions and call `gl.viewport` on resize events. It MUST scale the canvas dimensions by `devicePixelRatio` to ensure sharp rendering.

- **REQ-016**: Material/Pass Concept
  - The renderer MUST organize rendering into distinct passes (e.g., Background, Ships, Bullets, FX, UI) to minimize state changes and improve performance.

- **REQ-017**: Testing Strategy
  - The renderer MUST include headless WebGL tests for shader compilation, program linking, and golden-image tests using OffscreenCanvas. These tests MUST verify rendering correctness and performance thresholds.

- **CON-001**: No DOM writes during render
  - The `render(state)` function MUST NOT perform DOM modifications (creating elements or adding listeners); UI updates belong to the higher-level module.

- **GUD-001**: Minimize per-frame allocations
  - Reuse typed arrays and buffers across frames; allocate only when capacity growth is required.

- **GUD-002**: Profiling hooks
  - Expose simple diagnostic fields (e.g., `_diagCounter`, `_batchVBOCapacity`) and a `getRendererDiagnostics()` accessor in the higher-level module to help debugging performance issues.

## 4. Interfaces & Data Contracts

Public creator and renderer contract:

- Signature: `createWebGLRenderer(canvas: HTMLCanvasElement, opts?: RendererOptions): Renderer | null`

RendererOptions:

```javascript
{
  webgl2?: boolean,                // request webgl2 if available
  maxDevicePixelRatio?: number,    // clamp for DPR (default 1.5)
  atlasAccessor?: (type:string, radius:number) => Atlas | null,
  atlasLODs?: number[],            // list of baseRadius LODs
  maxUploadsPerFrame?: number,     // limit GPU uploads per frame
  atlasUseMipmaps?: boolean,
  atlasMaxSize?: number,
}
```

Atlas (pre-upload):

```javascript
{ canvas: HTMLCanvasElement, size: number, baseRadius: number }
```

AtlasInfo (post-upload):

```javascript
{ tex: WebGLTexture, size: number, baseRadius: number, canvas: HTMLCanvasElement }
```

Renderer object (returned):

```javascript
{
  type: 'webgl',
  webgl2: boolean,
  init(): boolean,
  start(cb?: () => void): void,
  stop(): void,
  isRunning(): boolean,
  render(state: RenderState): void,
  destroy(): void,
  // diagnostics (optional):
  _batchVBOCapacity?: number,
  _batchIBOCapacity?: number,
  _instanceVBOCapacity?: number,
}
```

RenderState (consumed by render): see REQ-003. Example minimal state:

```javascript
{
  W: 800, H: 600,
  ships: [ { id:1, x:100, y:150, radius:8, angle:0, team:0, alive:true } ],
  bullets: [],
  particles: [],
  flashes: [],
  score: { red: 0, blue: 0 }
}
```

## 5. Acceptance Criteria

- **AC-001**: Given a canvas and WebGL2 available, when `createWebGLRenderer(canvas, { webgl2: true })` is called and `init()` is invoked, then it returns a renderer object and `renderer.init()` returns true.

- **AC-002**: Given a large number of ships (>100), when `render(state)` is invoked with WebGL2 available, then the implementation uses instanced draws (one or few draw calls) to render those ships (observable via diagnostics or profiler traces) and still produces correct visuals.

- **AC-003**: Given atlas canvases that exceed `atlasMaxSize`, when `render` uploads them, then uploaded textures have dimensions <= `atlasMaxSize` (downscaled) and the number of uploads per frame <= `maxUploadsPerFrame`.

- **AC-004**: Given a high DPR (e.g., 3.0), when `render` computes the backing buffer size, then DPR is clamped to `maxDevicePixelRatio` and the drawing buffer size is <= `clientSize * maxDevicePixelRatio`.

- **AC-005**: If WebGL is unavailable or initialization fails, `createWebGLRenderer` must not throw unhandled errors and the caller must be able to fall back to the canvas renderer.

## 6. Test Automation Strategy

- Test Levels:
  - Unit tests: validate pure functions (e.g., `computeShipBatchRanges`, `splitVertexRanges`, texture upload decision logic).
  - Integration tests (fast): instantiate renderer with a headless WebGL context (via jsdom + headless-gl or Playwright in headful mode) and assert `init()` returns expected flags and that `render` doesn't throw.
  - End-to-end: run Playwright tests against the inlined standalone page to verify AUTO_INIT and actual rendering behaviour.

- Frameworks & Tools:
  - Vitest (unit + integration), Playwright (E2E), headless-gl (for Node WebGL mocks), esbuild for bundling.

- Test Data Management:
  - Synthetic states generated by small helpers that create `n` ships with deterministic positions.
  - Use seeded RNG (`srand(seed)`) in tests to ensure deterministic outcomes.

- CI/CD Integration:
  - Unit tests must run in the PR pipeline. E2E tests (Playwright) run in a separate job (optional, resource-heavy).

- Coverage Requirements:
  - Maintain >80% branch coverage for renderer-critical modules. Ensure computeShipBatchRanges and buffer streaming logic are covered.

- Performance Tests:
  - Add a micro-benchmark (local only) to measure time for `render` with 100/500/1000 ships and assert that per-frame JS-side CPU time is within acceptable bounds (example thresholds defined per environment).

## 7. Rationale & Context

- Many browsers expose large backing buffers for high-DPI displays; clamping DPR prevents long GPU upload/presentation delays seen in DevTools as "Presentation delay".
- Instanced draws dramatically reduce CPU overhead (attribute packing and a single draw call) for repeated geometry like ship quads.
- Streaming buffers with grow-on-demand and `gl.bufferSubData` reduce driver reallocations that can cause stutters.
- Limiting texture uploads per frame smooths CPU/GPU spikes caused by uploading many large canvases.

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: Browser environment - The renderer requires a browser or a WebGL-capable runtime to run.

### Third-Party Services

- **SVC-001**: None required at runtime. Playwright or headless-gl may be used during testing.

### Infrastructure Dependencies

- **INF-001**: CI runners with GPU-accelerated browsers for reliable WebGL E2E tests (optional but recommended).

### Data Dependencies

- **DAT-001**: None external. All visual assets are generated at runtime by the renderer or simulation.

### Technology Platform Dependencies

- **PLT-001**: Node.js for build tooling (esbuild) and Vitest for tests.

### Compliance Dependencies

- **COM-001**: None.

## 9. Examples & Edge Cases

Example: creating a renderer and rendering a simple state

```javascript
import { createWebGLRenderer } from '../src/webglRenderer.js';
const canvas = document.getElementById('world');
const renderer = createWebGLRenderer(canvas, { webgl2: true, maxDevicePixelRatio: 1.5 });
if (renderer && renderer.init()) {
  renderer.start(() => requestAnimationFrame(() => renderer.render({ W:800, H:600, ships: [ { id:1, x:100, y:100, radius:8, angle:0, team:0, alive:true } ] })));
}
```

Edge cases:
- atlasAccessor throws: renderer must catch and fallback to procedural drawing (disc fallback).
- atlas canvas has zero width/height: treat as missing atlas and fallback.
- extremely large devicePixelRatio: clamp to `maxDevicePixelRatio` to avoid overflow or huge allocations.
- WebGL context lost during runtime: renderer should handle `contextlost`/`contextrestored` events if required or at minimum not crash.

## 10. Validation Criteria

- Unit tests exist for: `computeShipBatchRanges`, `splitVertexRanges`, DPR clamping, texture upload gating.
- Integration test: `createWebGLRenderer` returns non-null on a browser with WebGL and `renderer.init()` returns true.
- E2E smoke: inlined standalone page must contain the `AUTO_INIT_SNIPPET` and the renderer fingerprint (`__isSpaceAutoRenderer`) in its output.

## 11. Related Specifications / Further Reading

- `spec/spec-design-renderer.md` (if present) - broader renderer and UI design.
- MDN WebGL documentation - for WebGL API semantics.
- Project `README.md` - build and run instructions.

---

This specification is intended to be machine-friendly and sufficiently detailed for generative tools and human contributors to implement, refactor, and verify the WebGL renderer and its utilities safely.
