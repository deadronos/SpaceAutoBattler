import { Quaternion, Vector3 } from 'three';
import type { AICommand, GameState, ShipEntity } from '../../types/index.js';
import { clampToWorld } from '../config.js';

// Reusable temporary objects to avoid per-frame allocations
const TEMP_FORWARD = new Vector3();
const TEMP_TARGET_DIR = new Vector3();
const TEMP_VELOCITY_CHANGE = new Vector3();
const TEMP_ROTATION = new Quaternion();
const TEMP_RIGHT = new Vector3();

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

  // Compute current yaw and target yaw from headings projected to XZ plane
  TEMP_FORWARD.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
  const cf = TEMP_FORWARD.set(TEMP_FORWARD.x, 0, TEMP_FORWARD.z);
  const th = TEMP_TARGET_DIR.copy(targetHeading);
  if (cf.lengthSq() < 1e-8 || th.lengthSq() < 1e-8) {
    // Nothing meaningful to do; just apply damping
    ship.ship.angularVelocity *= Math.exp(-motion.angularDamping * dt);
    return;
  }
  cf.normalize();
  th.set(th.x, 0, th.z).normalize();

  const currentYaw = Math.atan2(cf.x, cf.z);
  const targetYaw = Math.atan2(th.x, th.z);
  let dyaw = targetYaw - currentYaw;
  while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
  while (dyaw < -Math.PI) dyaw += 2 * Math.PI;

  // Deadzone to avoid twitch (about 2 degrees)
  const deadzone = 2 * Math.PI / 180;
  if (Math.abs(dyaw) < deadzone) {
    ship.ship.angularVelocity *= Math.exp(-motion.angularDamping * dt);
    // Optional: small slerp toward target for visual smoothness
    const s = motion.smoothing?.rotationSlerp ?? 0;
    if (s > 0) {
      const qTarget = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), targetYaw);
      ship.transform.rotation.slerp(qTarget, Math.min(1, s));
      ship.transform.rotation.normalize();
    }
    return;
  }

  // PD control targeting angular velocity
  const desiredAngularVel = kp * dyaw - kd * ship.ship.angularVelocity;
  const clampedTarget = Math.max(-motion.maxTurnRate, Math.min(motion.maxTurnRate, desiredAngularVel));
  const err = clampedTarget - ship.ship.angularVelocity;
  const maxDv = motion.angularAcceleration * dt;
  const dv = Math.max(-maxDv, Math.min(maxDv, err));
  ship.ship.angularVelocity += dv;
  ship.ship.angularVelocity *= Math.exp(-motion.angularDamping * dt);

  // Integrate angular velocity to rotation
  const w = ship.ship.angularVelocity;
  if (Math.abs(w) > 0.0005) {
    const rot = w * dt;
    TEMP_ROTATION.setFromAxisAngle(new Vector3(0, 1, 0), rot);
    ship.transform.rotation.multiplyQuaternions(TEMP_ROTATION, ship.transform.rotation);
    ship.transform.rotation.normalize();
  }

  // When close, optionally slerp a bit toward target to finish smooth
  const smallAngle = 0.2; // ~11 degrees
  if (Math.abs(dyaw) < smallAngle) {
    const s = motion.smoothing?.rotationSlerp ?? 0;
    if (s > 0) {
      const qTarget = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), targetYaw);
      ship.transform.rotation.slerp(qTarget, Math.min(1, s));
      ship.transform.rotation.normalize();
    }
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