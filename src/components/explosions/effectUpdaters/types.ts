import type { Camera, Color, InstancedMesh, Object3D, Quaternion, Vector3 } from 'three';
import type { ExplosionEvent } from '../../../types/index.js';
import type { DerivedExplosionData } from '../derived.js';

/**
 * Common parameters passed to all effect updaters.
 */
export interface EffectUpdateContext {
  event: ExplosionEvent;
  time: number;
  camera: Camera;
  derived: DerivedExplosionData;
  dummy: Object3D;
  tmpQuat: Quaternion;
  tmpVec: Vector3;
  color: Color;
}

export interface EffectUpdateResult {
  count: number;
  saturated: boolean;
}

/**
 * Effect updater function signature.
 * Returns the number of instances used for this effect and whether capacity was saturated.
 */
export type EffectUpdater = (
  ctx: EffectUpdateContext,
  mesh: InstancedMesh,
  startIndex: number,
  capacity: number
) => EffectUpdateResult;

export const EMPTY_EFFECT_RESULT: EffectUpdateResult = Object.freeze({
  count: 0,
  saturated: false,
});
