import type { InstancedMesh } from 'three';
import { SPARKS_DELAY } from '../constants.js';
import { clamp01, getCachedColor } from '../derived.js';
import type { EffectUpdateContext, EffectUpdater } from './types.js';

/**
 * Updates sparks effect instances.
 * Sparks are small, fast-moving camera-facing particles.
 */
export const updateSparks: EffectUpdater = (
  ctx: EffectUpdateContext,
  mesh: InstancedMesh,
  startIndex: number,
  capacity: number
): number => {
  const { event, time, camera, derived, dummy, tmpVec, color } = ctx;

  const sparksT = time - SPARKS_DELAY;
  if (sparksT < 0) {
    return 0;
  }

  let count = 0;

  for (const spark of derived.sparks) {
    if (sparksT > spark.lifetime || startIndex + count >= capacity) {
      continue;
    }

    const sparkProgress = clamp01(sparksT / spark.lifetime);
    const distance = spark.speed * sparksT;

    tmpVec.copy(spark.direction).multiplyScalar(distance).add(event.position);
    dummy.position.copy(tmpVec);

    const scale = Math.max(event.radius * 0.035 * spark.scale * (1 - sparkProgress), 0.01);
    dummy.scale.setScalar(scale);

    dummy.quaternion.copy(camera.quaternion);
    dummy.updateMatrix();

    mesh.setMatrixAt(startIndex + count, dummy.matrix);

    color
      .copy(getCachedColor(event.palette.flash))
      .multiplyScalar(Math.max(0.25, 1 - sparkProgress * 0.9));
    mesh.setColorAt(startIndex + count, color);

    count += 1;
  }

  return count;
};
