import type { InstancedMesh } from 'three';
import { DEBRIS_DELAY } from '../constants.js';
import { clamp01, getCachedColor } from '../derived.js';
import { EMPTY_EFFECT_RESULT, type EffectUpdateContext, type EffectUpdater, type EffectUpdateResult } from './types.js';

/**
 * Updates debris effect instances.
 * Debris are rotating shards ejected from the explosion.
 */
export const updateDebris: EffectUpdater = (
  ctx: EffectUpdateContext,
  mesh: InstancedMesh,
  startIndex: number,
  capacity: number,
): EffectUpdateResult => {
  const { event, time, derived, dummy, tmpQuat, tmpVec, color } = ctx;

  const debrisT = time - DEBRIS_DELAY;
  if (debrisT < 0) {
    return EMPTY_EFFECT_RESULT;
  }

  let count = 0;
  let saturated = false;

  for (const shard of derived.debris) {
    if (debrisT > shard.lifetime) {
      continue;
    }

    if (startIndex + count >= capacity) {
      saturated = true;
      break;
    }

    const shardProgress = clamp01(debrisT / shard.lifetime);
    const distance = shard.speed * debrisT;

    tmpVec.copy(shard.direction).multiplyScalar(distance).add(event.position);
    dummy.position.copy(tmpVec);

    const shardScale = Math.max(event.radius * 0.05 * shard.scale * (1 - shardProgress), 0.04);
    dummy.scale.setScalar(shardScale);

    tmpQuat.setFromAxisAngle(shard.axis, shard.spin * debrisT);
    dummy.quaternion.copy(tmpQuat);
    dummy.updateMatrix();

    mesh.setMatrixAt(startIndex + count, dummy.matrix);

    color
      .copy(getCachedColor(event.palette.fireballHot))
      .multiplyScalar(Math.max(0.2, 1 - shardProgress * 0.8));
    mesh.setColorAt(startIndex + count, color);

    count += 1;
  }

  return { count, saturated };
};
