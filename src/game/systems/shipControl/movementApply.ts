import type { GameState, ShipEntity } from '../../../types/index.js';
import type { ShipDecision } from './aiExecutor.js';
import { clampToWorld } from '../../config.js';
import type { KinematicBody } from '../../physics/safeKinematics.js';
import { deferSetNextKinematicTranslation } from '../../physics/safeKinematics.js';
import { TEMP_POS } from './sharedTemps.js';

/**
 * Applies the calculated movement decision to the ship's physics body.
 * NOTE: This is a legacy movement applicator. Newer systems use `systems/motion`.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship entity.
 * @param {ShipDecision} decision - The movement decision.
 * @param {number} delta - The time step.
 */
export function applyShipMovement(
  state: GameState,
  ship: ShipEntity,
  decision: ShipDecision,
  delta: number,
): void {
  if (decision.thrust > 0) {
    const moveDistance = ship.ship.speed * decision.thrust * delta;
    const nextPosition = TEMP_POS.copy(ship.transform.position).addScaledVector(
      decision.heading,
      moveDistance,
    );
    clampToWorld(nextPosition);
    deferSetNextKinematicTranslation(
      state,
      ship.rigidBody as unknown as KinematicBody,
      nextPosition.x,
      nextPosition.y,
      nextPosition.z,
    );
  } else {
    const p = ship.transform.position;
    deferSetNextKinematicTranslation(
      state,
      ship.rigidBody as unknown as KinematicBody,
      p.x,
      p.y,
      p.z,
    );
  }
}
