import { SMOKE_DELAY } from '../constants.js';
import { getCachedColor } from '../derived.js';
import { clamp01 } from '../../../utils/math.js';
import {
  type EffectUpdateContext,
  type EffectUpdater,
  type EffectUpdateResult,
} from './types.js';
import { processParticleArray } from './particleLoopHelper.js';

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

  return processParticleArray(
    derived.smoke,
    smokeT,
    manager,
    keyBase,
    'wisp',
    (wisp) => wisp.lifetime,
    (wisp, idx, smokeTime) => {
      const wispProgress = clamp01(smokeTime / wisp.lifetime);

      tmpVec.copy(wisp.offset).add(event.position).addScaledVector(wisp.drift, smokeTime);
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

      return true;
    },
  );
};
