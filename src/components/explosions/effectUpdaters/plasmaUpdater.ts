import { PLASMA_DELAY } from '../constants.js';
import { clamp01, getCachedColor } from '../derived.js';
import {
  EMPTY_EFFECT_RESULT,
  type EffectUpdateContext,
  type EffectUpdater,
  type EffectUpdateResult,
} from './types.js';

/**
 * Updates plasma effect instances.
 * Plasma plumes are rotating billboards that drift outward.
 */
export const updatePlasma: EffectUpdater = (
  ctx: EffectUpdateContext,
  manager,
  keyBase: string,
): EffectUpdateResult => {
  const { event, time, derived, dummy, tmpQuat, tmpVec, color } = ctx;

  const plasmaT = time - PLASMA_DELAY;
  if (plasmaT < 0) {
    return EMPTY_EFFECT_RESULT;
  }

  let count = 0;
  let saturated = false;

  let i = 0;
  for (const plume of derived.plasma) {
    if (plasmaT > plume.lifetime) {
      i += 1;
      continue;
    }

    const key = `${keyBase}:plume:${i}`;
    const idx = manager.allocate(key);
    if (idx == null) {
      saturated = true;
      break;
    }

    const plumeProgress = clamp01(plasmaT / plume.lifetime);
    const distance = plume.speed * plasmaT;

    tmpVec.copy(plume.direction).multiplyScalar(distance).add(event.position);
    dummy.position.copy(tmpVec);

    const scale = event.radius * 0.45 * plume.scale * (1 - plumeProgress * 0.7);
    dummy.scale.set(scale, scale * 0.9, scale);

    tmpQuat.setFromAxisAngle(plume.axis, plume.spin * plasmaT);
    dummy.quaternion.copy(tmpQuat);
    dummy.updateMatrix();

    manager.setMatrixAt(idx, dummy.matrix);

    color
      .copy(getCachedColor(event.palette.shockwave))
      .multiplyScalar(Math.max(0.15, 1 - plumeProgress));
    manager.setColorAt(idx, color);

    count += 1;
    i += 1;
  }

  return { count, saturated };
};
