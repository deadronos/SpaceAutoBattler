export interface ShadowCameraParams {
  near: number;
  far: number;
  halfSize: number;
}

/**
 * Half-size (world units) of the orthographic shadow frustum, centred on the
 * action. Tuned so ship-scale geometry gets usable shadow-map resolution
 * instead of being spread across the whole world.
 */
export const DEFAULT_SHADOW_FRUSTUM_RADIUS = 600;

/**
 * Computes an orthographic directional-shadow frustum that tightly brackets the
 * action around the origin. The previous implementation used a span derived
 * from the (very large) star distance, which spread a 2048² shadow map over
 * tens of thousands of units so ships cast no readable shadows.
 *
 * @param {number} lightDistance - Distance from the light to the origin.
 * @param {number} [radius] - Half-size of the shadowed region around the origin.
 * @returns {ShadowCameraParams} Orthographic near/far/half-size for the shadow camera.
 */
export function computeShadowCameraParams(
  lightDistance: number,
  radius: number = DEFAULT_SHADOW_FRUSTUM_RADIUS,
): ShadowCameraParams {
  const halfSize = Math.max(radius, 1);
  const distance = Math.max(lightDistance, 1);
  const depth = halfSize * 2;
  return {
    near: Math.max(1, distance - depth),
    far: distance + depth,
    halfSize,
  };
}
