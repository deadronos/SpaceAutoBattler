/**
 * Centralized scene layer ordering constants for deterministic rendering.
 * 
 * Rendering order (back-to-front for transparency):
 * 1. OPAQUE_CORE: Depth-writing opaque geometry (star cores)
 * 2. OPAQUE_GEOMETRY (default 0): Standard opaque meshes (planets, ships, etc.)
 * 3. TRANSLUCENT_ADDITIVE: Additive transparent effects (halos, rings, glows)
 * 
 * All additive layers use depthTest=true to respect occlusion while avoiding
 * darkening artifacts from normal blending.
 */

/**
 * Opaque depth-writing cores that establish depth buffer baseline.
 * Drawn first to ensure proper occlusion for all subsequent geometry.
 */
export const RENDER_ORDER_OPAQUE_CORE = -10;

/**
 * Standard opaque geometry (planets, ships, asteroids, etc.).
 * Uses default renderOrder of 0 - no need to set explicitly.
 */
export const RENDER_ORDER_OPAQUE_GEOMETRY = 0;

/**
 * Translucent additive effects (star halos, bloom glows).
 * Drawn late with depthTest=true to respect occlusion while adding light.
 */
export const RENDER_ORDER_TRANSLUCENT_ADDITIVE = 10;

/**
 * Foreground translucent elements that must sit above the generic additive layer.
 * Used for planetary rings so they composite cleanly over the star halo without
 * risking z-fighting or precision artifacts when render order ties occur.
 */
export const RENDER_ORDER_TRANSLUCENT_FOREGROUND = 12;

/**
 * Helper to validate renderOrder assignments during development.
 * Logs warning if a component uses non-standard renderOrder value.
 */
export function validateRenderOrder(
  componentName: string,
  renderOrder: number
): void {
  const validOrders = [
    RENDER_ORDER_OPAQUE_CORE,
    RENDER_ORDER_OPAQUE_GEOMETRY,
    RENDER_ORDER_TRANSLUCENT_ADDITIVE,
    RENDER_ORDER_TRANSLUCENT_FOREGROUND,
  ];

  if (!validOrders.includes(renderOrder)) {
    console.warn(
      `[SceneLayerOrder] ${componentName} uses non-standard renderOrder ${renderOrder}. ` +
      `Consider using: OPAQUE_CORE (${RENDER_ORDER_OPAQUE_CORE}), ` +
      `OPAQUE_GEOMETRY (${RENDER_ORDER_OPAQUE_GEOMETRY}), or ` +
      `TRANSLUCENT_ADDITIVE (${RENDER_ORDER_TRANSLUCENT_ADDITIVE})`
    );
  }
}
