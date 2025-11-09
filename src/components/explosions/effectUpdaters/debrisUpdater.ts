import type { EffectUpdateContext, EffectUpdater, EffectUpdateResult } from './types.js';
import { DEBRIS_DELAY } from '../constants.js';
import { getCachedColor } from '../derived.js';
import { clamp01 } from '../../../utils/math.js';
import { processParticleArray } from './particleLoopHelper.js';

/**
 * Updates debris effect instances using the allocator model.
 * This mirrors the previous DebrisInstancedManager.update logic but
 * allocates indices per-shard via the supplied InstancedLayerManager.
 */
export const updateDebris: EffectUpdater = (
  ctx: EffectUpdateContext,
  manager,
  keyBase: string,
): EffectUpdateResult => {
  const { event, time, derived, dummy, tmpQuat, tmpVec, color } = ctx;

  const debrisT = time - DEBRIS_DELAY;

  return processParticleArray(
    derived.debris,
    debrisT,
    manager,
    keyBase,
    'shard',
    (shard) => shard.lifetime,
    (shard, idx, debrisTime) => {
      const shardProgress = clamp01(debrisTime / shard.lifetime);
      const distance = shard.speed * debrisTime;

      tmpVec.copy(shard.direction).multiplyScalar(distance).add(event.position);
      dummy.position.copy(tmpVec);

      const shardScale = Math.max(event.radius * 0.05 * shard.scale * (1 - shardProgress), 0.04);
      dummy.scale.setScalar(shardScale);

      tmpQuat.setFromAxisAngle(shard.axis, shard.spin * debrisTime);
      dummy.quaternion.copy(tmpQuat);
      dummy.updateMatrix();

      manager.setMatrixAt(idx, dummy.matrix);

      color
        .copy(getCachedColor(event.palette.fireballHot))
        .multiplyScalar(Math.max(0.2, 1 - shardProgress * 0.8));
      manager.setColorAt(idx, color);

      return true;
    },
  );
};
