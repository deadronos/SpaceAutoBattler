import { getCachedColor } from '../derived.js';
import { clamp01 } from '../../../utils/math.js';
import {
  EMPTY_EFFECT_RESULT,
  type EffectUpdateContext,
  type EffectUpdater,
  type EffectUpdateResult,
} from './types.js';

/**
 * Updates fireball effect instances.
 * Fireball is a sphere that transitions from hot to cool colors as it fades.
 */
export const updateFireball: EffectUpdater = (
  ctx: EffectUpdateContext,
  manager,
  keyBase: string,
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

  const key = `${keyBase}:fireball`;
  const idx = manager.allocate(key);
  if (idx == null) return { count: 0, saturated: true };

  manager.setMatrixAt(idx, dummy.matrix);

  const hotColor = getCachedColor(event.palette.fireballHot);
  const coolColor = getCachedColor(event.palette.smoke);
  color.copy(hotColor).lerp(coolColor, firePhase * 0.65);
  manager.setColorAt(idx, color);

  return { count: 1, saturated: false };
};
