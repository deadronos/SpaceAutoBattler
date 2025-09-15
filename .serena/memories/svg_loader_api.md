# svg_loader_api — SVG rasterizer and asset pool integration

Last-Reviewed: 2025-09-15

Overview

- Provides deterministic SVG rasterization into ImageBitmap(s) or textures for use as ship visuals.
- Integrates with `state.assetPool` to register bitmap assets by key and reference count.

Key functions

- `rasterizeSVG(svgString, scale, options)` -> Promise<ImageBitmap>
- `preloadSVGAssets(listOfKeys)` -> Promise<void> — rasterize and store results into `state.assetPool`
- `getAsset(key)` -> returns cached ImageBitmap or null
- `clearCache()` -> clears cached bitmaps and releases resources
- `listCached()` -> debug helper returning keys and sizes

Determinism & performance

- Uses consistent rendering settings and devicePixelRatio scaling for consistent visuals across runs.
- For deterministic simulations (headless tests), support a no-raster mode that uses placeholder geometries.

Session notes (2025-09-15): Reviewed API and updated Last-Reviewed. Verified integration points with `main.ts` bootstrap and `threeRenderer` assetPool usage.
