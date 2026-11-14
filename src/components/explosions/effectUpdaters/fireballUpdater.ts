import { clamp01 } from '../../../utils/math.js';
import {
  EMPTY_EFFECT_RESULT,
  type EffectUpdateContext,
  type EffectUpdater,
  type EffectUpdateResult,
} from './types.js';
import { emitSingleInstance } from './instanceHelpers.js';

/**
 * Updates fireball effect instances.
 * Fireball is a sphere that transitions from hot to cool colors as it fades.
 */
export const updateFireball: EffectUpdater = (
  ctx: EffectUpdateContext,
  manager,
  eventId: number,
): EffectUpdateResult => {
  const { event, time, dummy, color } = ctx;

  const fireballT = time - event.fireball.delay;
  if (fireballT < 0 || fireballT > event.fireball.duration) {
    return EMPTY_EFFECT_RESULT;
  }

  const firePhase = clamp01(fireballT / event.fireball.duration);
  const scale = event.radius * (0.4 + 0.8 * (1 - firePhase));

  dummy.position.copy(event.position);
  dummy.scale.setScalar(scale);
  dummy.quaternion.identity();
  dummy.updateMatrix();

  color.set(event.palette.fireballHot);
  const { r, g, b } = color;
  color.set(event.palette.smoke);
  const blend = firePhase * 0.65;
  color.setRGB(r + (color.r - r) * blend, g + (color.g - g) * blend, b + (color.b - b) * blend);

  return emitSingleInstance(manager, eventId, dummy, color);
};
