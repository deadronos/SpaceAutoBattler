import type { InstancedMesh } from 'three';
import { clamp01, easeOutQuad, getCachedColor } from '../derived.js';
import { EMPTY_EFFECT_RESULT, type EffectUpdateContext, type EffectUpdater, type EffectUpdateResult } from './types.js';

/**
 * Updates shockwave effect instances.
 * Shockwave is an expanding ring billboard that fades as it grows.
 */
export const updateShockwave: EffectUpdater = (
  ctx: EffectUpdateContext,
  mesh: InstancedMesh,
  startIndex: number,
  capacity: number,
): EffectUpdateResult => {
  const { event, time, camera, dummy, color } = ctx;

  const shockwaveT = time - event.shockwave.delay;
  if (shockwaveT < 0 || shockwaveT > event.shockwave.duration) {
    return EMPTY_EFFECT_RESULT;
  }

  if (startIndex >= capacity) {
    return { count: 0, saturated: true };
  }

  const phase = clamp01(shockwaveT / event.shockwave.duration);
  const radius = event.shockwave.maxRadius * easeOutQuad(phase);

  dummy.position.copy(event.position);
  dummy.scale.set(radius, radius, radius);
  dummy.quaternion.copy(camera.quaternion);
  dummy.updateMatrix();

  mesh.setMatrixAt(startIndex, dummy.matrix);

  color
    .copy(getCachedColor(event.palette.shockwave))
    .multiplyScalar(Math.max(0.2, 1 - phase * 0.9));
  mesh.setColorAt(startIndex, color);

  return { count: 1, saturated: false };
};
