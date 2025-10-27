import type { EffectUpdateContext, EffectUpdater, EffectUpdateResult } from './types.js';
import { DEBRIS_DELAY } from '../constants.js';
import { clamp01, getCachedColor } from '../derived.js';
import { EMPTY_EFFECT_RESULT } from './types.js';

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
  const { event, time, derived, dummy, tmpQuat: _tmpQuat, tmpVec: _tmpVec, color } = ctx;

  const debrisT = time - DEBRIS_DELAY;
  if (debrisT < 0) return EMPTY_EFFECT_RESULT;

  let count = 0;
  let saturated = false;

  let i = 0;
  for (const shard of derived.debris) {
    if (debrisT > shard.lifetime) {
      i += 1;
      continue;
    }

    const key = `${keyBase}:shard:${i}`;
    const idx = manager.allocate(key);
    if (idx == null) {
      saturated = true;
      break;
    }

    const shardProgress = clamp01(debrisT / shard.lifetime);
    const distance = shard.speed * debrisT;

    _tmpVec.copy(shard.direction).multiplyScalar(distance).add(event.position);
    dummy.position.copy(_tmpVec);

    const shardScale = Math.max(event.radius * 0.05 * shard.scale * (1 - shardProgress), 0.04);
    dummy.scale.setScalar(shardScale);

    _tmpQuat.setFromAxisAngle(shard.axis, shard.spin * debrisT);
    dummy.quaternion.copy(_tmpQuat);
    dummy.updateMatrix();

    manager.setMatrixAt(idx, dummy.matrix);

    color
      .copy(getCachedColor(event.palette.fireballHot))
      .multiplyScalar(Math.max(0.2, 1 - shardProgress * 0.8));
    manager.setColorAt(idx, color);

    count += 1;
    i += 1;
  }

  return { count, saturated };
};
