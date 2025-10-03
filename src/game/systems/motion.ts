import { MathUtils, Quaternion, Vector3 } from 'three';
import type { AICommand, GameState, ShipEntity } from '../../types/index.js';
import type { KinematicBody } from '../physics/safeKinematics.js';
import { clampToWorld } from '../config.js';
import { getEffectiveStats } from '../progression.js';
import { deferSetNextKinematicTranslation, deferSetNextKinematicRotation } from '../physics/safeKinematics.js';

// Reusable temporary objects to avoid per-frame allocations
const TEMP_FORWARD = new Vector3();
const TEMP_TARGET_DIR = new Vector3();
const TEMP_VELOCITY_CHANGE = new Vector3();
const TEMP_ROTATION = new Quaternion();
const TEMP_RIGHT = new Vector3();
const TEMP_AXIS = new Vector3();
const TEMP_DESIRED_AV = new Vector3();
const TEMP_AV_DELTA = new Vector3();
const TEMP_UP = new Vector3(0, 1, 0);
const DEFAULT_TURN_KP = 4.0;
const DEFAULT_TURN_KD = 0.6;
const DEFAULT_SETTLE_RATE = 0.2;
const DEFAULT_SETTLE_TOLERANCE_DEG = 5;
const ANGULAR_SPEED_EPSILON = 1e-5;


/**
 * Update physics-based motion for all ships using acceleration limits and damping.
 * This replaces the old kinematic positioning with proper physics integration.
 * 
 * @param state GameState containing ships and physics world
 * @param dt Delta time in seconds
 */
export function updateMotionSystem(state: GameState, dt: number): void {
  const ships = state.queries.ships.entities as ShipEntity[];
  
  for (const ship of ships) {
    // Skip ships without AI commands (passive/destroyed ships)
    if (!ship.ai?.command) continue;
    
    const command = ship.ai.command;
    
    // Update angular motion (turning toward desired heading)
    updateAngularMotion(ship, command.heading, dt);
    
    // Update linear motion (thrust and velocity)
    updateLinearMotion(ship, command, dt);
    
    // Apply velocity to position through physics using safe helpers
    applyVelocityToPhysics(state, ship, dt);
  }
}

/**
 * Update ship angular velocity and rotation based on desired heading.
 * Uses PD-like control with shortest arc calculation.
 */
function updateAngularMotion(ship: ShipEntity, targetHeading: Vector3, dt: number): void {
  const motion = ship.ship.motion;
  const kp = motion.turnKp ?? DEFAULT_TURN_KP;
  const kd = motion.turnKd ?? DEFAULT_TURN_KD;
  const settleRate = Math.max(0, motion.angularSettlingRate ?? DEFAULT_SETTLE_RATE);
  const settleTolerance = MathUtils.degToRad(motion.angularSettleToleranceDeg ?? DEFAULT_SETTLE_TOLERANCE_DEG);
  const damping = Math.exp(-motion.angularDamping * Math.max(dt, 0));
  const angularVelocity = ship.ship.angularVelocity;

  const desiredForward = TEMP_TARGET_DIR.copy(targetHeading);
  if (desiredForward.lengthSq() < 1e-8) {
    angularVelocity.multiplyScalar(damping);
    return;
  }
  desiredForward.normalize();

  const currentRotation = ship.transform.rotation;
  const currentForward = TEMP_FORWARD.set(0, 0, 1).applyQuaternion(currentRotation);
  if (currentForward.lengthSq() < 1e-8) currentForward.set(0, 0, 1);
  currentForward.normalize();

  const dot = Math.max(-1, Math.min(1, currentForward.dot(desiredForward)));
  const angle = Math.acos(dot);
  const angularSpeed = angularVelocity.length();
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
    const updatedForward = TEMP_FORWARD.set(0, 0, 1).applyQuaternion(currentRotation);
    if (updatedForward.lengthSq() < 1e-8) updatedForward.set(0, 0, 1);
    updatedForward.normalize();
    const correction = TEMP_ROTATION.setFromUnitVectors(updatedForward, desiredForward);
    currentRotation.multiplyQuaternions(correction, currentRotation);
    currentRotation.normalize();
  }

  const s = motion.smoothing?.rotationSlerp ?? 0;
  if (s > 0 && !withinSettleBand) {
    TEMP_ROTATION.setFromUnitVectors(TEMP_RIGHT.set(0, 0, 1), desiredForward);
    currentRotation.slerp(TEMP_ROTATION, Math.min(1, s));
    currentRotation.normalize();
  }
}
/**
 * Update ship linear velocity based on thrust command.
 * Applies forward acceleration and lateral strafe if supported.
 */
function updateLinearMotion(ship: ShipEntity, command: AICommand, dt: number): void {
  const motion = ship.ship.motion;
  const velocity = ship.ship.velocity;

  // Get forward direction for thrust
  TEMP_FORWARD.set(0, 0, 1).applyQuaternion(ship.transform.rotation);

  // Apply forward thrust acceleration
  const clampedThrust = Math.max(-1, Math.min(1, command.thrust));
  const forwardAccel = clampedThrust * motion.linearAcceleration;
  TEMP_VELOCITY_CHANGE.copy(TEMP_FORWARD).multiplyScalar(forwardAccel * dt);
  velocity.add(TEMP_VELOCITY_CHANGE);

  // Apply lateral acceleration when supported by motion stats and command input.
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

  // Apply linear damping (velocity decay)
  const dampingFactor = Math.exp(-motion.linearDamping * dt);
  velocity.multiplyScalar(dampingFactor);

  // Apply subsystem effects to speed
  const effectiveStats = getEffectiveStats(ship.ship);
  const effectiveMaxSpeed = motion.maxSpeed * effectiveStats.speedMultiplier;
  const effectiveMaxReverseSpeed = motion.maxReverseSpeed ? motion.maxReverseSpeed * effectiveStats.speedMultiplier : undefined;

  // Clamp forward component to max speed / reverse speed limits.
  const forwardSpeed = velocity.dot(TEMP_FORWARD);
  if (forwardSpeed > effectiveMaxSpeed) {
    const excess = forwardSpeed - effectiveMaxSpeed;
    velocity.addScaledVector(TEMP_FORWARD, -excess);
  } else if (effectiveMaxReverseSpeed != null && forwardSpeed < -effectiveMaxReverseSpeed) {
    const deficit = -effectiveMaxReverseSpeed - forwardSpeed;
    velocity.addScaledVector(TEMP_FORWARD, deficit);
  }

  // Clamp velocity to maximum speed
  const speed = velocity.length();
  if (speed > effectiveMaxSpeed) {
    velocity.multiplyScalar(effectiveMaxSpeed / speed);
  }
}

/**
 * Apply the computed velocity to the physics rigid body.
 * This updates the kinematic rigid body's next position.
 */
function applyVelocityToPhysics(state: GameState, ship: ShipEntity, dt: number): void {
  const velocity = ship.ship.velocity;
  const currentPos = ship.transform.position;
  
  // Calculate next position using actual delta time
  const nextPos = {
    x: currentPos.x + velocity.x * dt,
    y: currentPos.y + velocity.y * dt,
    z: currentPos.z + velocity.z * dt,
  };
  
  // Clamp to world bounds
  clampToWorld(nextPos);
  
  // Update kinematic rigid body safely (guard against Rapier borrow errors)
  deferSetNextKinematicTranslation(state, ship.rigidBody as unknown as KinematicBody, nextPos.x, nextPos.y, nextPos.z);
  deferSetNextKinematicRotation(
    state,
    ship.rigidBody as unknown as KinematicBody,
    ship.transform.rotation.x,
    ship.transform.rotation.y,
    ship.transform.rotation.z,
    ship.transform.rotation.w,
  );
}

/**
 * Math utility: Calculate shortest angle between two angles in radians.
 * Result is in range [-π, π].
 */
export function shortestAngle(from: number, to: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

/**
 * Math utility: Continuous damping function.
 * Returns multiplier for exponential decay: 1 - exp(-damping * dt)
 */
export function dampingFactor(damping: number, dt: number): number {
  return Math.exp(-damping * dt);
}
