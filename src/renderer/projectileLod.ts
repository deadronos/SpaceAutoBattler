/** Projects within this distance (squared) are updated at full frame rate. */
export const LOD_CLOSE_DISTANCE_SQ = 200 * 200;
/** Far projectiles update their instance matrix every Nth frame. */
export const LOD_FAR_UPDATE_INTERVAL = 2;

/**
 * Decides whether a projectile's instance matrix should be recomputed this
 * frame: always for close/new projectiles, otherwise every Nth frame.
 *
 * @param {{ distanceSq: number; isNew: boolean; frameId: number; projectileId: number }} params
 * @returns {boolean} True if the matrix should be updated.
 */
export function shouldUpdateProjectileMatrix(params: {
  distanceSq: number;
  isNew: boolean;
  frameId: number;
  projectileId: number;
}): boolean {
  const { distanceSq, isNew, frameId, projectileId } = params;
  const isClose = distanceSq < LOD_CLOSE_DISTANCE_SQ;
  return isClose || isNew || (frameId + projectileId) % LOD_FAR_UPDATE_INTERVAL === 0;
}
