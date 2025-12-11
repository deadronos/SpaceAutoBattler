import { SPARKS_DELAY } from '../constants.js';
import { getCachedColor } from '../derived.js';
import { clamp01 } from '../../../utils/math.js';
import { type EffectUpdateContext, type EffectUpdater, type EffectUpdateResult } from './types.js';
import { processParticleArray } from './particleLoopHelper.js';

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

  return processParticleArray(
    derived.sparks,
    sparksT,
    manager,
    keyBase,
    'spark',
    (spark) => spark.lifetime,
    (spark, idx, sparksTime) => {
      const sparkProgress = clamp01(sparksTime / spark.lifetime);
      const distance = spark.speed * sparksTime;

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

      return true;
    },
  );
};
