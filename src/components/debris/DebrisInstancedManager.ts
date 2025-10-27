import { InstancedBufferAttribute, Matrix4, Quaternion, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { DEBRIS_DELAY } from '../explosions/constants.js';
import { clamp01, getCachedColor } from '../explosions/derived.js';
import {
  EMPTY_EFFECT_RESULT,
  type EffectUpdateContext,
  type EffectUpdateResult,
} from '../explosions/effectUpdaters/types.js';
import { HIDDEN_MATRIX } from '../layers/instancedLayer.js';

const TMP_QUAT = new Quaternion();
const TMP_VEC = new Vector3();

function ensureInstanceColor(mesh: InstancedMesh, capacity: number): void {
  if (!mesh.instanceColor) {
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    mesh.instanceColor.needsUpdate = true;
  }
}

export interface DebrisUpdateOptions {
  clampMissing?: boolean;
}

/**
 * Dedicated instanced pool manager for debris fragments.
 * Handles attribute preparation, TTL filtering and saturation tracking.
 */
export class DebrisInstancedManager {
  constructor(private readonly options: DebrisUpdateOptions = {}) {}

  prepare(mesh: InstancedMesh, capacity: number): void {
    mesh.count = 0;
    mesh.visible = false;
    mesh.instanceMatrix.needsUpdate = true;
    ensureInstanceColor(mesh, capacity);
  }

  update(
    ctx: EffectUpdateContext,
    mesh: InstancedMesh,
    startIndex: number,
    capacity: number,
  ): EffectUpdateResult {
    const { event, time, derived, dummy, tmpQuat: _tmpQuat, tmpVec: _tmpVec, color } = ctx;

    ensureInstanceColor(mesh, capacity);

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

      TMP_VEC.copy(shard.direction).multiplyScalar(distance).add(event.position);
      dummy.position.copy(TMP_VEC);

      const shardScale = Math.max(event.radius * 0.05 * shard.scale * (1 - shardProgress), 0.04);
      dummy.scale.setScalar(shardScale);

      TMP_QUAT.setFromAxisAngle(shard.axis, shard.spin * debrisT);
      dummy.quaternion.copy(TMP_QUAT);
      dummy.updateMatrix();

      mesh.setMatrixAt(startIndex + count, dummy.matrix);

      color
        .copy(getCachedColor(event.palette.fireballHot))
        .multiplyScalar(Math.max(0.2, 1 - shardProgress * 0.8));
      mesh.setColorAt(startIndex + count, color);

      count += 1;
    }

    if (this.options.clampMissing && count === 0 && startIndex < capacity) {
      mesh.setMatrixAt(startIndex, HIDDEN_MATRIX);
    }

    return { count, saturated };
  }
}
