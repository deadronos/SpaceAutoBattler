# SVG hull outline: findings and actionable TODOs

This document summarizes feasibility, findings, and an actionable implementation roadmap to derive hull outlines from ship SVGs and use them for shield visuals and precise collision.

Findings

- SVG parsing & rasterization live in `src/assets/svgLoader.ts`.
- Current loader extracts mountpoints heuristically and rasterizes SVGs asynchronously via Image + Blob URL.
- SVG assets are in `src/config/assets/svg/*.svg` and tests exist (`test/vitest/svgLoader_hullonly.spec.ts`).
- It's feasible to extract path geometry, flatten curves to polylines, and compute an outline usable for visuals and collisions.

Design goals

- Produce per-ship polygonal contours (outer hull + holes) in same coordinate space as renderer.
- Keep performance acceptable: use AABB and simplified hulls for fast rejection; enable detailed polygon tests only when needed.
- Provide a graceful, opt-in migration path that preserves existing circle-based collisions as fallback.

Actionable TODOs

1. Add SVG->polylines utility (in `src/assets/svgToPolylines.ts`) - high
   - Read SVG via DOMParser, collect <path>, <polygon>, <polyline>, <rect>, <circle>, <ellipse>.
   - Resolve transforms and viewBox scaling to renderer local coordinates.
   - Flatten Bézier/arcs to polylines with adjustable tolerance.
   - Return: { contours: number[][][], bbox: {minX,minY,maxX,maxY}, convexHull?: number[][] }

2. Add polygon utilities (in `src/math/polygon.ts`) - high
   - pointInPolygon (raycast/winding)
   - distancePointToSegment
   - circleIntersectsPolygon (center,radius)
   - polygonSimplify (Ramer–Douglas–Peucker)
   - optional: triangulate via earcut for filled shield meshes

3. Produce shield outline visuals - medium
   - Canvas2D Path2D stroke implementation using contours (quick)
   - Optional WebGL mesh generator that offsets outline and triangulates for glow effects (later)

4. Integrate collision tests into simulate pipeline - high
   - In `simulate.ts` or collision module, add an opt-in polygon collision path:
     - Quick reject via AABB and circle-vs-convexHull
     - Detailed test: circle vs polygon edges + point-in-polygon
   - Keep legacy circle collision behind flag/config per-ship

5. Tests & benchmarks - high
   - Unit tests for svg->polylines on sample SVG assets
   - Unit tests for polygon math (point-in-polygon, circle vs polygon)
   - Performance benchmark simulating many bullets vs ships to tune simplification tolerance

6. Asset guidelines & documentation - low
   - Update `docs/svg-assets-migration.md` to recommend `data-mount` attributes and turret class conventions
   - Document coordinate expectations and transforms

7. Rollout plan - medium
   - Start with shield visuals only (non-physics) to validate parsing and transforms
   - Add polygon collision as opt-in for specific ship types; monitor perf
   - If stable, enable by default and remove legacy fallback after validation

Notes & risks

- Complex SVGs may produce high-vertex polygons; always simplify before using for collision.
- getBBox and DOM APIs can behave differently in headless/test environments; ensure parsing tests account for that.
- Rasterization is async; for visual-only shield generation prefer vector stroke (fast) or ensure waiting for raster completion.

If you'd like, I can start implementing TODO #1 and #2 (svgToPolylines and polygon utils) now and add unit tests using existing SVG assets. Proceed?
