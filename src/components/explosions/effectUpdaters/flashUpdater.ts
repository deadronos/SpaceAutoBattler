import type { InstancedMesh } from 'three';
import { FLASH_DURATION } from '../constants.js';
import { clamp01, easeOutQuad, getCachedColor } from '../derived.js';
import {
  EMPTY_EFFECT_RESULT,
  type EffectUpdateContext,
  type EffectUpdater,
  type EffectUpdateResult,
} from './types.js';

/**
 * Updates flash effect instances.
 * Flash is a bright, camera-facing sphere that quickly fades at explosion start.
 */
export const updateFlash: EffectUpdater = (
  ctx: EffectUpdateContext,
  mesh: InstancedMesh,
  startIndex: number,
  capacity: number,
): EffectUpdateResult => {
  const { event, time, camera, derived, dummy, color } = ctx;

  if (time > FLASH_DURATION) {
    return EMPTY_EFFECT_RESULT;
  }

  if (startIndex >= capacity) {
    return { count: 0, saturated: true };
  }

  const flashT = clamp01(time / FLASH_DURATION);
  const intensity = (1 - flashT) * event.flashIntensity * derived.flicker;
  const scale = event.radius * (0.6 + 0.5 * easeOutQuad(1 - flashT));

  dummy.position.copy(event.position);
  dummy.scale.setScalar(scale);
  dummy.quaternion.copy(camera.quaternion);
  dummy.updateMatrix();

  mesh.setMatrixAt(startIndex, dummy.matrix);

  color.copy(getCachedColor(event.palette.flash)).multiplyScalar(Math.max(0.3, intensity));
  mesh.setColorAt(startIndex, color);

  return { count: 1, saturated: false };
};
