import type { GameState, ShipEntity } from '../../../types/index.js';
import { clampToWorld } from '../../config.js';
import type { KinematicBody } from '../../physics/safeKinematics.js';
import {
  deferSetNextKinematicRotation,
  deferSetNextKinematicTranslation,
} from '../../physics/safeKinematics.js';
import { TEMP_NEXT_POS } from './sharedTemps.js';

/**
 * Applies the calculated velocity changes to the physics engine (Rapier).
 * Updates kinematic translation and rotation for the next step.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship entity.
 * @param {number} dt - The time step.
 */
export function applyVelocityToPhysics(state: GameState, ship: ShipEntity, dt: number): void {
  const velocity = ship.ship.velocity;
  const currentPos = ship.transform.position;

  TEMP_NEXT_POS.set(
    currentPos.x + velocity.x * dt,
    currentPos.y + velocity.y * dt,
    currentPos.z + velocity.z * dt,
  );

  clampToWorld(TEMP_NEXT_POS);

  deferSetNextKinematicTranslation(
    state,
    ship.rigidBody as unknown as KinematicBody,
    TEMP_NEXT_POS.x,
    TEMP_NEXT_POS.y,
    TEMP_NEXT_POS.z,
  );
  deferSetNextKinematicRotation(
    state,
    ship.rigidBody as unknown as KinematicBody,
    ship.transform.rotation.x,
    ship.transform.rotation.y,
    ship.transform.rotation.z,
    ship.transform.rotation.w,
  );
}
