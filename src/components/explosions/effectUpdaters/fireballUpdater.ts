import type { InstancedMesh } from 'three';
import { clamp01, getCachedColor } from '../derived.js';
import type { EffectUpdateContext, EffectUpdater } from './types.js';

/**
 * Updates fireball effect instances.
 * Fireball is a sphere that transitions from hot to cool colors as it fades.
 */
export const updateFireball: EffectUpdater = (
  ctx: EffectUpdateContext,
  mesh: InstancedMesh,
  startIndex: number,
  _capacity: number
): number => {
  const { event, time, dummy, color } = ctx;

  const fireballT = time - event.fireball.delay;
  if (fireballT < 0 || fireballT > event.fireball.duration) {
    return 0;
  }

  const firePhase = clamp01(fireballT / event.fireball.duration);
  const scale = event.radius * (0.4 + 0.8 * (1 - firePhase));

  dummy.position.copy(event.position);
  dummy.scale.setScalar(scale);
  dummy.quaternion.identity();
  dummy.updateMatrix();

  mesh.setMatrixAt(startIndex, dummy.matrix);

  const hotColor = getCachedColor(event.palette.fireballHot);
  const coolColor = getCachedColor(event.palette.smoke);
  color.copy(hotColor).lerp(coolColor, firePhase * 0.65);
  mesh.setColorAt(startIndex, color);

  return 1;
};
