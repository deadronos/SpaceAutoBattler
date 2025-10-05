import type { InstancedMesh } from 'three';
import { DebrisInstancedManager } from '../../debris/DebrisInstancedManager.js';
import type { EffectUpdateContext, EffectUpdater, EffectUpdateResult } from './types.js';

const debrisManager = new DebrisInstancedManager();

/**
 * Updates debris effect instances.
 * Debris are rotating shards ejected from the explosion.
 */
export const updateDebris: EffectUpdater = (
  ctx: EffectUpdateContext,
  mesh: InstancedMesh,
  startIndex: number,
  capacity: number,
): EffectUpdateResult => debrisManager.update(ctx, mesh, startIndex, capacity);
