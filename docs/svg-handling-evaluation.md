# SVG handling evaluation

This document summarizes how SVGs are handled in the codebase and recommendations.

Overview

- SVG logic lives in `src/assets/svgLoader.ts` and offers:
  - parseSvgForMounts(svgText): extracts turret/engine mount points and viewBox
  - rasterizeSvgToCanvas(svgText,outW,outH): rasterizes into a canvas (async draw)
  - rasterizeHullOnlySvgToCanvas(svgText,outW,outH): removes `<rect class="turret">` then rasterizes

Key behaviors

- Parsing:
  - Uses DOMParser and queries the top-level `<svg>`.
  - Extracts viewBox from `viewBox` attr or width/height fallback.
  - Scans elements with id/class; id/class matching /(mount|turret|gun)/i produce turret mounts; /engine/i produce engine mounts.
  - Uses getBBox() if available to compute center; falls back to cx/cy or x/y attributes or (0,0).
  - Wrapped in try/catch; failures return empty results.

- Rasterization:
  - Creates a canvas sized to outW/outH and an Image using a Blob URL created from svgText.
  - Drawing occurs in `img.onload` (asynchronous) and URL.revokeObjectURL is called on load/error.
  - The function returns the canvas immediately; pixels may be empty until onload runs.

- Hull-only rasterization:
  - Parses SVG, removes `rect.turret` elements, serializes, and rasterizes the result.
  - Falls back to rasterizing the original SVG on error.

Integration points

- SVG assets at `src/config/assets/svg/*.svg` are inputs for loader.
- Tests: `test/vitest/svgLoader_hullonly.spec.ts` and `test/vitest/setup-inline-svgs.ts` reference loader behavior and test setup for headless DOM.
- Scripts: `scripts/smoke-turret-svg.ts` demonstrates usage.
- Build output: `dist/assets/svgLoader.ts` mirrors source for runtime.

- Team-color regions: prefer marking SVG elements that should be recolored using a `data-team` attribute. Examples: `data-team="primary"` for hull, `data-team="accent"` for highlights. The loader will expose these as `colorRegions` with optional bbox/id/class to help the renderer apply tints.

Suggested small changes (candidate PRs)

- Add `rasterizeSvgToCanvasAsync` returning a Promise that resolves once drawing completes.
- Add unit tests for parseSvgForMounts edge cases (no viewBox, no getBBox, different mount markers).
- Update `docs/svg-assets-migration.md` with explicit authoring guidelines: use `id`/`class` conventions or prefer `data-mount` attributes.

Files inspected

- src/assets/svgLoader.ts
- src/config/assets/svg/\*.svg
- test/vitest/svgLoader_hullonly.spec.ts
- test/vitest/setup-inline-svgs.ts
- scripts/smoke-turret-svg.ts

If you want, I can implement the async rasterize API and update tests accordingly.
