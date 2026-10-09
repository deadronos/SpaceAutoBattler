import type { RigidBody } from '../../types/index.js';
import type { KinematicBody } from './types.js';

/**
 * Bridges a Rapier `RigidBody` to the structural `KinematicBody` surface the
 * safe-kinematics wrappers accept (their nominal method types differ), so the
 * cast lives in one place instead of at every call site.
 *
 * @param {RigidBody | null | undefined} rb - The Rapier body (or nullish).
 * @returns {KinematicBody | null} The body as a kinematic surface, or null.
 */
export function asKinematicBody(rb: RigidBody | null | undefined): KinematicBody | null {
  return (rb as unknown as KinematicBody | null | undefined) ?? null;
}

export type { KinematicBody, Collider } from './types.js';
export {
  deferSetNextKinematicTranslation,
  deferSetNextKinematicRotation,
  deferSetLinvel,
  deferSetAngvel,
  deferSetMass,
  deferSetLinearDamping,
  deferSetAngularDamping,
  deferSetColliderFriction,
  deferSetColliderRestitution,
} from './wrappers.js';
export {
  postSetNextKinematicTranslation,
  postSetNextKinematicRotation,
  postSetLinvel,
  postSetAngvel,
  postSetMass,
  postSetLinearDamping,
  postSetAngularDamping,
  postSetColliderFriction,
  postSetColliderRestitution,
} from './wrappers.js';
