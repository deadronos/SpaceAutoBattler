import { MathUtils } from 'three';
import type { Vector3 } from 'three';
import type { ShipEntity } from '../../../types/index.js';
import { FORWARD, orientQuaternionFromDirection } from '../../../utils/steering.js';
import {
  ANGULAR_SPEED_EPSILON,
  DEFAULT_SETTLE_RATE,
  DEFAULT_SETTLE_TOLERANCE_DEG,
  DEFAULT_TURN_KD,
  DEFAULT_TURN_KP,
  TEMP_AXIS,
  TEMP_AV_DELTA,
  TEMP_DESIRED_AV,
  TEMP_FORWARD,
  TEMP_ROTATION,
  TEMP_TARGET_DIR,
  TEMP_UP,
} from './sharedTemps.js';
import { getForwardFromQuaternion } from '../../../utils/vector.js';

/**
 * Updates the angular velocity and rotation of a ship to align with a target heading.
 * Uses a PD controller for smooth turning.
 *
 * @param {ShipEntity} ship - The ship entity.
 * @param {Vector3} targetHeading - The desired forward vector.
 * @param {number} dt - The time step.
 */
export function updateAngularMotion(ship: ShipEntity, targetHeading: Vector3, dt: number): void {
  const motion = ship.ship.motion;
  const kp = motion.turnKp ?? DEFAULT_TURN_KP;
  const kd = motion.turnKd ?? DEFAULT_TURN_KD;
  const settleRate = Math.max(0, motion.angularSettlingRate ?? DEFAULT_SETTLE_RATE);
  const settleTolerance = MathUtils.degToRad(
    motion.angularSettleToleranceDeg ?? DEFAULT_SETTLE_TOLERANCE_DEG,
  );
  const damping = Math.exp(-motion.angularDamping * Math.max(dt, 0));
  const angularVelocity = ship.ship.angularVelocity;

  const desiredForward = TEMP_TARGET_DIR.copy(targetHeading);
  if (desiredForward.lengthSq() < 1e-8) {
    angularVelocity.multiplyScalar(damping);
    return;
  }
  desiredForward.normalize();

  const currentRotation = ship.transform.rotation;
  const currentForward = getForwardFromQuaternion(currentRotation, TEMP_FORWARD);
  if (currentForward.lengthSq() < 1e-8) currentForward.set(0, 0, 1);
  currentForward.normalize();

  const dot = Math.max(-1, Math.min(1, currentForward.dot(desiredForward)));
  const angle = Math.acos(dot);
  const withinSettleBand = angle <= settleTolerance;

  if (!withinSettleBand) {
    const axis = TEMP_AXIS.crossVectors(currentForward, desiredForward);
    if (axis.lengthSq() < 1e-10) {
      axis.copy(currentForward).cross(TEMP_UP);
      if (axis.lengthSq() < 1e-10) axis.set(1, 0, 0);
    }
    axis.normalize();

    const desiredAngularVel = TEMP_DESIRED_AV.copy(axis).multiplyScalar(angle * kp);
    desiredAngularVel.sub(TEMP_AV_DELTA.copy(angularVelocity).multiplyScalar(kd));

    const maxTurnRate = Math.max(1e-6, motion.maxTurnRate);
    const desiredLen = desiredAngularVel.length();
    if (desiredLen > maxTurnRate) {
      desiredAngularVel.multiplyScalar(maxTurnRate / desiredLen);
    }

    TEMP_AV_DELTA.copy(desiredAngularVel).sub(angularVelocity);

    const maxDelta = Math.max(0, motion.angularAcceleration) * dt;
    const deltaLen = TEMP_AV_DELTA.length();
    if (maxDelta > 0 && deltaLen > maxDelta && deltaLen > 1e-8) {
      TEMP_AV_DELTA.multiplyScalar(maxDelta / deltaLen);
    }

    angularVelocity.add(TEMP_AV_DELTA);
  }

  angularVelocity.multiplyScalar(damping);

  if (withinSettleBand) {
    const postDampedSpeed = angularVelocity.length();
    if (postDampedSpeed > settleRate + ANGULAR_SPEED_EPSILON) {
      if (settleRate <= ANGULAR_SPEED_EPSILON) {
        angularVelocity.set(0, 0, 0);
      } else if (postDampedSpeed > ANGULAR_SPEED_EPSILON) {
        angularVelocity.multiplyScalar(settleRate / postDampedSpeed);
      }
    } else if (postDampedSpeed < settleRate * 0.5 || postDampedSpeed < ANGULAR_SPEED_EPSILON) {
      angularVelocity.set(0, 0, 0);
    }
  }

  const avLen = angularVelocity.length();
  if (avLen > ANGULAR_SPEED_EPSILON) {
    const stepAxis = TEMP_AXIS.copy(angularVelocity).normalize();
    const stepAngle = avLen * dt;
    TEMP_ROTATION.setFromAxisAngle(stepAxis, stepAngle);
    currentRotation.multiplyQuaternions(TEMP_ROTATION, currentRotation);
    currentRotation.normalize();
  } else if (withinSettleBand && angle > 1e-4) {
    const updatedForward = getForwardFromQuaternion(currentRotation, TEMP_FORWARD);
    if (updatedForward.lengthSq() < 1e-8) updatedForward.set(0, 0, 1);
    updatedForward.normalize();
    const correction = TEMP_ROTATION.setFromUnitVectors(updatedForward, desiredForward);
    currentRotation.multiplyQuaternions(correction, currentRotation);
    currentRotation.normalize();
  }

  const s = motion.smoothing?.rotationSlerp ?? 0;
  if (s > 0 && !withinSettleBand) {
    orientQuaternionFromDirection(desiredForward, FORWARD, TEMP_ROTATION);
    currentRotation.slerp(TEMP_ROTATION, Math.min(1, s));
    currentRotation.normalize();
  }
}
