## SVG Loader

Last-Reviewed: 2025-09-07

The SVG Loader is responsible for loading SVG source files, rasterizing them to `ImageBitmap`, and applying optional tinting or transformations. It is used by `meshFactory` and `assetPool` during prototype creation.

### Features

- Async rasterization to `ImageBitmap` using `createImageBitmap` for performance.
- Optional caching via `assetPool`.
- Handles retina scale and viewBox normalization.
- Error handling: falls back to a simple colored rectangle if the SVG can't be rasterized.

### API

- `loadSVG(url: string): Promise<ImageBitmap>`
- `rasterizeSVG(svgText: string, scale: number, tint?: string): Promise<ImageBitmap>`

### Notes

- Performs no network fetches in worker threads; loading happens on the main thread with transfer to rendering systems.
