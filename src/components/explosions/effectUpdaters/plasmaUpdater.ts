import { PLASMA_DELAY } from '../constants.js';
import { getCachedColor } from '../derived.js';
import { clamp01 } from '../../../utils/math.js';
import { type EffectUpdateContext, type EffectUpdater, type EffectUpdateResult } from './types.js';
import { processParticleArray } from './particleLoopHelper.js';

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

  return processParticleArray(
    derived.plasma,
    plasmaT,
    manager,
    keyBase,
    'plume',
    (plume) => plume.lifetime,
    (plume, idx, plasmaTime) => {
      const plumeProgress = clamp01(plasmaTime / plume.lifetime);
      const distance = plume.speed * plasmaTime;

      tmpVec.copy(plume.direction).multiplyScalar(distance).add(event.position);
      dummy.position.copy(tmpVec);

      const scale = event.radius * 0.45 * plume.scale * (1 - plumeProgress * 0.7);
      dummy.scale.set(scale, scale * 0.9, scale);

      tmpQuat.setFromAxisAngle(plume.axis, plume.spin * plasmaTime);
      dummy.quaternion.copy(tmpQuat);
      dummy.updateMatrix();

      manager.setMatrixAt(idx, dummy.matrix);

      color
        .copy(getCachedColor(event.palette.shockwave))
        .multiplyScalar(Math.max(0.15, 1 - plumeProgress));
      manager.setColorAt(idx, color);

      return true;
    },
  );
};
