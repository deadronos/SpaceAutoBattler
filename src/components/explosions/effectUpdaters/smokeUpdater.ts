import { SMOKE_DELAY } from '../constants.js';
import { clamp01, getCachedColor } from '../derived.js';
import {
  EMPTY_EFFECT_RESULT,
  type EffectUpdateContext,
  type EffectUpdater,
  type EffectUpdateResult,
} from './types.js';

/**
 * Updates smoke effect instances.
 * Smoke wisps are camera-facing particles that drift upward and fade slowly.
 */
export const updateSmoke: EffectUpdater = (
  ctx: EffectUpdateContext,
  manager,
  keyBase: string,
): EffectUpdateResult => {
  const { event, time, camera, derived, dummy, tmpVec, color } = ctx;

  const smokeT = time - SMOKE_DELAY;
  if (smokeT < 0) {
    return EMPTY_EFFECT_RESULT;
  }

  let count = 0;
  let saturated = false;

  let i = 0;
  for (const wisp of derived.smoke) {
    if (smokeT > wisp.lifetime) {
      i += 1;
      continue;
    }

    const key = `${keyBase}:wisp:${i}`;
    const idx = manager.allocate(key);
    if (idx == null) {
      saturated = true;
      break;
    }

    const wispProgress = clamp01(smokeT / wisp.lifetime);

    tmpVec.copy(wisp.offset).add(event.position).addScaledVector(wisp.drift, smokeT);
    dummy.position.copy(tmpVec);

    const scale = event.radius * 0.6 * wisp.scale * (1 - wispProgress * 0.4);
    dummy.scale.setScalar(scale);

    dummy.quaternion.copy(camera.quaternion);
    dummy.updateMatrix();

    manager.setMatrixAt(idx, dummy.matrix);

    color
      .copy(getCachedColor(event.palette.smoke))
      .multiplyScalar(Math.max(0.2, 0.7 - wispProgress * 0.5));
    manager.setColorAt(idx, color);

    count += 1;
    i += 1;
  }

  return { count, saturated };
};
