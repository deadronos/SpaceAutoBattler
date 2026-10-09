import type { Color, Object3D } from 'three';
import type { InstancedLayerManager } from '../../layers/types.js';
import type { EffectUpdateResult } from './types.js';

/**
 * Allocates and writes a single instanced effect from an already-configured
 * dummy transform and color, returning the standard effect result. Shared by
 * the single-instance updaters (flash, fireball, shockwave).
 *
 * @param {InstancedLayerManager<string>} manager - The effect's instanced layer manager.
 * @param {string} keyBase - Per-event key base (usually the event id).
 * @param {string} suffix - Effect name, used to namespace the allocation key.
 * @param {Object3D} dummy - Configured transform (matrix already updated).
 * @param {Color} color - Configured instance color.
 * @returns {EffectUpdateResult} Count/saturation result.
 */
export function emitSingleInstance(
  manager: InstancedLayerManager<string>,
  keyBase: string,
  suffix: string,
  dummy: Object3D,
  color: Color,
): EffectUpdateResult {
  const idx = manager.allocate(`${keyBase}:${suffix}`);
  if (idx == null) return { count: 0, saturated: true };
  manager.setMatrixAt(idx, dummy.matrix);
  manager.setColorAt(idx, color);
  return { count: 1, saturated: false };
}
