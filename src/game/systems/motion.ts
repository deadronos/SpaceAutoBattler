import { Quaternion, Vector3 } from 'three';
import type { AICommand, GameState, ShipEntity } from '../../types/index.js';
import { clampToWorld } from '../config.js';

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
    
    // Apply velocity to position through physics
    applyVelocityToPhysics(ship, dt);
  }
}

/**
 * Update ship angular velocity and rotation based on desired heading.
 * Uses PD-like control with shortest arc calculation.
 */
function updateAngularMotion(ship: ShipEntity, targetHeading: Vector3, dt: number): void {
  const motion = ship.ship.motion;
  const kp = motion.turnKp ?? 4.0;
  const kd = motion.turnKd ?? 0.6;
  const damping = Math.exp(-motion.angularDamping * dt);
  const angularVelocity = ship.ship.angularVelocity;

  const desiredForward = TEMP_TARGET_DIR.copy(targetHeading);
  if (desiredForward.lengthSq() < 1e-8) {
    angularVelocity.multiplyScalar(damping);
    return;
  }
  desiredForward.normalize();

  const currentForward = TEMP_FORWARD.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
  if (currentForward.lengthSq() < 1e-8) currentForward.set(0, 0, 1);
  currentForward.normalize();

  const dot = Math.max(-1, Math.min(1, currentForward.dot(desiredForward)));
  const angle = Math.acos(dot);
  if (angle < 1e-4) {
    angularVelocity.multiplyScalar(damping);
    const s = motion.smoothing?.rotationSlerp ?? 0;
    if (s > 0) {
      TEMP_ROTATION.setFromUnitVectors(TEMP_RIGHT.set(0, 0, 1), desiredForward);
      ship.transform.rotation.slerp(TEMP_ROTATION, Math.min(1, s));
      ship.transform.rotation.normalize();
    }
    return;
  }

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
  angularVelocity.multiplyScalar(damping);

  const avLen = angularVelocity.length();
  if (avLen > 1e-5) {
    const stepAxis = TEMP_AXIS.copy(angularVelocity).normalize();
    const stepAngle = avLen * dt;
    TEMP_ROTATION.setFromAxisAngle(stepAxis, stepAngle);
    ship.transform.rotation.multiplyQuaternions(TEMP_ROTATION, ship.transform.rotation);
    ship.transform.rotation.normalize();
  }

  const s = motion.smoothing?.rotationSlerp ?? 0;
  if (s > 0) {
    TEMP_ROTATION.setFromUnitVectors(TEMP_RIGHT.set(0, 0, 1), desiredForward);
    ship.transform.rotation.slerp(TEMP_ROTATION, Math.min(1, s));
    ship.transform.rotation.normalize();
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

  // Clamp forward component to max speed / reverse speed limits.
  const forwardSpeed = velocity.dot(TEMP_FORWARD);
  if (forwardSpeed > motion.maxSpeed) {
    const excess = forwardSpeed - motion.maxSpeed;
    velocity.addScaledVector(TEMP_FORWARD, -excess);
  } else if (motion.maxReverseSpeed != null && forwardSpeed < -motion.maxReverseSpeed) {
    const deficit = -motion.maxReverseSpeed - forwardSpeed;
    velocity.addScaledVector(TEMP_FORWARD, deficit);
  }

  // Clamp velocity to maximum speed
  const speed = velocity.length();
  if (speed > motion.maxSpeed) {
    velocity.multiplyScalar(motion.maxSpeed / speed);
  }
}

/**
 * Apply the computed velocity to the physics rigid body.
 * This updates the kinematic rigid body's next position.
 */
function applyVelocityToPhysics(ship: ShipEntity, dt: number): void {
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
  
  // Update kinematic rigid body
  ship.rigidBody.setNextKinematicTranslation(nextPos);
  ship.rigidBody.setNextKinematicRotation({
    x: ship.transform.rotation.x,
    y: ship.transform.rotation.y,
    z: ship.transform.rotation.z,
    w: ship.transform.rotation.w,
  });
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


