import type { GameState, ShipEntity } from '../../../types/index.js';
import { updateAngularMotion } from './angular.js';
import { updateLinearMotion } from './linear.js';
import { applyVelocityToPhysics } from './physicsSync.js';
import { MOTION_IDLE_THRESHOLDS } from './config.js';
import { getForwardFromQuaternion } from '../../../utils/vector.js';
import { TEMP_FORWARD, TEMP_HEADING } from './sharedTemps.js';
export { shortestAngle, dampingFactor } from './math.js';

function isIdleCommand(ship: ShipEntity): boolean {
  const command = ship.ai?.command;
  if (!command) return true;

  const thrustIdle = Math.abs(command.thrust) < MOTION_IDLE_THRESHOLDS.thrustEpsilon;
  const strafeIdle = Math.abs(command.strafe ?? 0) < MOTION_IDLE_THRESHOLDS.strafeEpsilon;

  const heading = command.heading;
  const headingLenSq = heading.lengthSq();
  if (headingLenSq < 1e-10) return false;

  TEMP_HEADING.copy(heading).multiplyScalar(1 / Math.max(Math.sqrt(headingLenSq), 1e-8));
  getForwardFromQuaternion(ship.transform.rotation, TEMP_FORWARD);
  const headingAligned =
    TEMP_FORWARD.lengthSq() > 1e-10 &&
    TEMP_FORWARD.normalize().dot(TEMP_HEADING) >= MOTION_IDLE_THRESHOLDS.headingAlignmentDot;

  const linearIdle = ship.ship.velocity.length() < MOTION_IDLE_THRESHOLDS.linearSpeedEpsilon;
  const angularIdle =
    ship.ship.angularVelocity.length() < MOTION_IDLE_THRESHOLDS.angularSpeedEpsilon;

  // Skip heavy math when command is no-op AND motion is already effectively settled.
  return thrustIdle && strafeIdle && headingAligned && linearIdle && angularIdle;
}

export function updateMotionSystem(state: GameState, dt: number): void {
  const ships =
    (state.queries.shipsWithCommands?.entities as ShipEntity[] | undefined) ??
    (state.queries.ships.entities as ShipEntity[]);

  for (const ship of ships) {
    const command = ship.ai?.command;
    if (!command) continue;

    if (isIdleCommand(ship)) continue;

    updateAngularMotion(ship, command.heading, dt);
    updateLinearMotion(ship, command, dt);
    applyVelocityToPhysics(state, ship, dt);
  }
}
