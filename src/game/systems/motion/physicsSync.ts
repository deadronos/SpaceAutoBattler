import type { GameState, ShipEntity } from '../../../types/index.js';
import { clampToWorld } from '../../config.js';
import type { KinematicBody } from '../../physics/safeKinematics.js';
import {
  deferSetNextKinematicRotation,
  deferSetNextKinematicTranslation,
} from '../../physics/safeKinematics.js';

export function applyVelocityToPhysics(state: GameState, ship: ShipEntity, dt: number): void {
  const velocity = ship.ship.velocity;
  const currentPos = ship.transform.position;

  const nextPos = {
    x: currentPos.x + velocity.x * dt,
    y: currentPos.y + velocity.y * dt,
    z: currentPos.z + velocity.z * dt,
  };

  clampToWorld(nextPos);

  deferSetNextKinematicTranslation(
    state,
    ship.rigidBody as unknown as KinematicBody,
    nextPos.x,
    nextPos.y,
    nextPos.z,
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
