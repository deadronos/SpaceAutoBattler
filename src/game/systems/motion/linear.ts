import type { AICommand, ShipEntity } from '../../../types/index.js';
import { getEffectiveStats } from '../../progression.js';
import { TEMP_FORWARD, TEMP_RIGHT, TEMP_VELOCITY_CHANGE } from './sharedTemps.js';

export function updateLinearMotion(ship: ShipEntity, command: AICommand, dt: number): void {
  const motion = ship.ship.motion;
  const velocity = ship.ship.velocity;

  TEMP_FORWARD.set(0, 0, 1).applyQuaternion(ship.transform.rotation);

  const clampedThrust = Math.max(-1, Math.min(1, command.thrust));
  const forwardAccel = clampedThrust * motion.linearAcceleration;
  TEMP_VELOCITY_CHANGE.copy(TEMP_FORWARD).multiplyScalar(forwardAccel * dt);
  velocity.add(TEMP_VELOCITY_CHANGE);

  let lateralAccel = 0;
  const maxStrafe = motion.maxLateralAcceleration ?? 0;
  if (maxStrafe > 0) {
    const strafeInput = Math.max(-1, Math.min(1, command.strafe ?? 0));
    if (Math.abs(strafeInput) > 1e-4) {
      lateralAccel = strafeInput * maxStrafe;
      TEMP_RIGHT.set(1, 0, 0).applyQuaternion(ship.transform.rotation);
      TEMP_VELOCITY_CHANGE.copy(TEMP_RIGHT).multiplyScalar(lateralAccel * dt);
      velocity.add(TEMP_VELOCITY_CHANGE);
    }
  }
  ship.ship.lateralAcceleration = lateralAccel;

  const dampingFactor = Math.exp(-motion.linearDamping * dt);
  velocity.multiplyScalar(dampingFactor);

  const effectiveStats = getEffectiveStats(ship.ship);
  const effectiveMaxSpeed = motion.maxSpeed * effectiveStats.speedMultiplier;
  const effectiveMaxReverseSpeed = motion.maxReverseSpeed
    ? motion.maxReverseSpeed * effectiveStats.speedMultiplier
    : undefined;

  const forwardSpeed = velocity.dot(TEMP_FORWARD);
  if (forwardSpeed > effectiveMaxSpeed) {
    const excess = forwardSpeed - effectiveMaxSpeed;
    velocity.addScaledVector(TEMP_FORWARD, -excess);
  } else if (effectiveMaxReverseSpeed != null && forwardSpeed < -effectiveMaxReverseSpeed) {
    const deficit = -effectiveMaxReverseSpeed - forwardSpeed;
    velocity.addScaledVector(TEMP_FORWARD, deficit);
  }

  const speed = velocity.length();
  if (speed > effectiveMaxSpeed) {
    velocity.multiplyScalar(effectiveMaxSpeed / speed);
  }
}
