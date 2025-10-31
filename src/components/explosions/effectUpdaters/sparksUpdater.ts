import { SPARKS_DELAY } from '../constants.js';
import { getCachedColor } from '../derived.js';
import { clamp01 } from '../../../utils/math.js';
import {
  EMPTY_EFFECT_RESULT,
  type EffectUpdateContext,
  type EffectUpdater,
  type EffectUpdateResult,
} from './types.js';

/**
 * Updates sparks effect instances.
 * Sparks are small, fast-moving camera-facing particles.
 */
export const updateSparks: EffectUpdater = (
  ctx: EffectUpdateContext,
  manager,
  keyBase: string,
): EffectUpdateResult => {
  const { event, time, camera, derived, dummy, tmpVec, color } = ctx;

  const sparksT = time - SPARKS_DELAY;
  if (sparksT < 0) {
    return EMPTY_EFFECT_RESULT;
  }

  let count = 0;
  let saturated = false;

  let i = 0;
  for (const spark of derived.sparks) {
    if (sparksT > spark.lifetime) {
      i += 1;
      continue;
    }

    const key = `${keyBase}:spark:${i}`;
    const idx = manager.allocate(key);
    if (idx == null) {
      saturated = true;
      break;
    }

    const sparkProgress = clamp01(sparksT / spark.lifetime);
    const distance = spark.speed * sparksT;

    tmpVec.copy(spark.direction).multiplyScalar(distance).add(event.position);
    dummy.position.copy(tmpVec);

    const scale = Math.max(event.radius * 0.035 * spark.scale * (1 - sparkProgress), 0.01);
    dummy.scale.setScalar(scale);

    dummy.quaternion.copy(camera.quaternion);
    dummy.updateMatrix();

    manager.setMatrixAt(idx, dummy.matrix);

    color
      .copy(getCachedColor(event.palette.flash))
      .multiplyScalar(Math.max(0.25, 1 - sparkProgress * 0.9));
    manager.setColorAt(idx, color);

    count += 1;
    i += 1;
  }

  return { count, saturated };
};
