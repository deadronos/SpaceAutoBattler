import { FLASH_DURATION } from '../constants.js';
import { easeOutQuad, getCachedColor } from '../derived.js';
import { clamp01 } from '../../../utils/math.js';
import {
  EMPTY_EFFECT_RESULT,
  type EffectUpdateContext,
  type EffectUpdater,
  type EffectUpdateResult,
} from './types.js';
import { emitSingleInstance } from './instanceHelpers.js';

/**
 * Updates flash effect instances.
 * Flash is a bright, camera-facing sphere that quickly fades at explosion start.
 */
export const updateFlash: EffectUpdater = (
  ctx: EffectUpdateContext,
  manager,
  keyBase: string,
): EffectUpdateResult => {
  const { event, time, camera, derived, dummy, color } = ctx;

  if (time > FLASH_DURATION) {
    return EMPTY_EFFECT_RESULT;
  }
  const flashT = clamp01(time / FLASH_DURATION);
  const intensity = (1 - flashT) * event.flashIntensity * derived.flicker;
  const scale = event.radius * (0.6 + 0.5 * easeOutQuad(1 - flashT));

  dummy.position.copy(event.position);
  dummy.scale.setScalar(scale);
  dummy.quaternion.copy(camera.quaternion);
  dummy.updateMatrix();

  color.copy(getCachedColor(event.palette.flash)).multiplyScalar(Math.max(0.3, intensity));

  return emitSingleInstance(manager, keyBase, 'flash', dummy, color);
};
