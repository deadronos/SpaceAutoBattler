import type { InstancedMesh } from 'three';
import { SMOKE_DELAY } from '../constants.js';
import { clamp01, getCachedColor } from '../derived.js';
import type { EffectUpdateContext, EffectUpdater } from './types.js';

/**
 * Updates smoke effect instances.
 * Smoke wisps are camera-facing particles that drift upward and fade slowly.
 */
export const updateSmoke: EffectUpdater = (
  ctx: EffectUpdateContext,
  mesh: InstancedMesh,
  startIndex: number,
  capacity: number
): number => {
  const { event, time, camera, derived, dummy, tmpVec, color } = ctx;

  const smokeT = time - SMOKE_DELAY;
  if (smokeT < 0) {
    return 0;
  }

  let count = 0;

  for (const wisp of derived.smoke) {
    if (smokeT > wisp.lifetime || startIndex + count >= capacity) {
      continue;
    }

    const wispProgress = clamp01(smokeT / wisp.lifetime);

    tmpVec.copy(wisp.offset).add(event.position).addScaledVector(wisp.drift, smokeT);
    dummy.position.copy(tmpVec);

    const scale = event.radius * 0.6 * wisp.scale * (1 - wispProgress * 0.4);
    dummy.scale.setScalar(scale);

    dummy.quaternion.copy(camera.quaternion);
    dummy.updateMatrix();

    mesh.setMatrixAt(startIndex + count, dummy.matrix);

    color
      .copy(getCachedColor(event.palette.smoke))
      .multiplyScalar(Math.max(0.2, 0.7 - wispProgress * 0.5));
    mesh.setColorAt(startIndex + count, color);

    count += 1;
  }

  return count;
};
