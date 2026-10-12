import type { Color, Object3D } from 'three';
import type { InstancedLayerManager } from '../../layers/types.js';
import type { EffectUpdateResult } from './types.js';

/**
 * Allocates and writes a single instanced effect from an already-configured
 * dummy transform and color, returning the standard effect result. Shared by
 * the single-instance updaters (flash, fireball, shockwave).
 *
 * Each single-instance effect has its own manager, so the event id is already
 * unique within that manager and can be used directly as the numeric key.
 *
 * @param {InstancedLayerManager<number>} manager - The effect's instanced layer manager.
 * @param {number} eventId - Numeric per-event identity used as the allocation key.
 * @param {Object3D} dummy - Configured transform (matrix already updated).
 * @param {Color} color - Configured instance color.
 * @returns {EffectUpdateResult} Count/saturation result.
 */
export function emitSingleInstance(
  manager: InstancedLayerManager<number>,
  eventId: number,
  dummy: Object3D,
  color: Color,
): EffectUpdateResult {
  const idx = manager.allocate(eventId);
  if (idx == null) return { count: 0, saturated: true };
  manager.setMatrixAt(idx, dummy.matrix);
  manager.setColorAt(idx, color);
  return { count: 1, saturated: false };
}
