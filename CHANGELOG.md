# Changelog

## Unreleased

### Key changes
- Introduced a new renderer configuration flag `RendererConfig.disableSvgSubsystem`.
  - Default: `true` (SVG subsystem disabled by default to prefer GLTF models at runtime).
  - When enabled (set to `true`), the SVG rasterization subsystem will be short-circuited to avoid creating the raster worker, performing rasterization, or watching SVG files.

- Made the SVG raster worker lazy-initialized.
  - The `SVGLoader` now defers creation of the raster `Worker` until rasterization is actually requested.
  - This avoids spawning the worker and warming SVG caches when GLTF models are preferred.
  - Worker creation logs a diagnostic: `[SVGLoader] Worker instance created (lazy init)`.

- GLTF-first behavior and SVG fallbacks
  - The app now prefers GLTF ship prototypes when `RendererConfig.loadGltfModels` is enabled.
  - SVG rasterization and preloads are skipped when GLTF model loading is active or the SVG subsystem is disabled.
  - Debug helpers such as `window.debugSVG` are no-ops when GLTF mode or the SVG subsystem is disabled.

- Guarded rasterization
  - `SVGLoader.rasterizeSVG` / `rasterizeWithWorker` now explicitly fail fast when `RendererConfig.disableSvgSubsystem` is set, preventing accidental worker creation or main-thread raster work.

- Tests and validation
  - Added `test/vitest/svgWorker.lazy.spec.ts` to assert the worker is initialized lazily and that GLTF mode prevents worker creation.
  - Added `test/vitest/debugSVG.noop.spec.ts` to validate debug helper no-op behavior when SVG is disabled.

- Boot-time syntax fix
  - Fixed a parsing/brace imbalance in `src/main.ts` around the simulation worker (simWorker) initialization IIFE. This resolved TypeScript/webpack build failures seen in CI.

### Files changed (high-level)
- src/config/rendererConfig.ts — added `disableSvgSubsystem` flag and defaulted to `true`.
- src/core/svgLoader.ts — lazy worker initialization, guard checks, logging, and fail-fast rasterization paths.
- src/main.ts — skipped SVG preloads and debug SVG helpers when GLTF or SVG subsystem disabled; fixed parsing/brace issue.
- src/renderer/meshFactory.ts and src/renderer/threeRenderer.ts — respect `disableSvgSubsystem` guards when rasterizing or creating SVG-based meshes.
- test/vitest/svgWorker.lazy.spec.ts — tests for lazy worker initialization.
- test/vitest/debugSVG.noop.spec.ts — test for debug helper no-op.

### How to verify
1. Run TypeScript checks:

```powershell
npx tsc --noEmit
```

2. Run the full unit test suite:

```powershell
npm test
```

3. Manual runtime checks:
- Start a local build and inspect the console during rasterization flows:

```powershell
npm run build
npm run serve:dist
# open http://localhost:8080/dist/spaceautobattler.html
```

- When `RendererConfig.disableSvgSubsystem` is `true` you should NOT see `svgRasterWorker.js` network requests or the log `[SVGLoader] Worker instance created (lazy init)`.
- When `RendererConfig.loadGltfModels` is enabled and SVG is disabled, `window.debugSVG` calls should be no-ops and safe to call from the console.

### Notes / Rationale
- Many consumers will prefer GLTF ship models for richer visuals and lower runtime raster work. Defaulting the SVG subsystem to disabled avoids unnecessary worker creation and raster memory usage in that common scenario.
- Lazy worker initialization keeps the worker cost only when the app actually needs rasterization (SVG fallback or explicit debug tasks).
- Fail-fast guards prevent accidental rasterization in environments where SVG is intentionally disabled.

### Follow-ups (optional)
- Consider adding a small integration test to assert `DefaultRendererConfig.disableSvgSubsystem === true` for CI safety.
- Add a short entry to `README.md` explaining the GLTF-first recommendation and how to re-enable the SVG subsystem during local testing.

---
Generated on: 2025-09-06
