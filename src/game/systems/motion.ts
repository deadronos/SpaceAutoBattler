import { Quaternion, Vector3 } from 'three';
import type { AICommand, GameState, ShipEntity } from '../../types/index.js';
import { clampToWorld } from '../config.js';

// Reusable temporary objects to avoid per-frame allocations
const TEMP_FORWARD = new Vector3();
const TEMP_TARGET_DIR = new Vector3();
const TEMP_VELOCITY_CHANGE = new Vector3();
const TEMP_ANGULAR_AXIS = new Vector3();
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
    
    const motion = ship.ship.motion;
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
  
  // Get current forward direction from ship rotation
  TEMP_FORWARD.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
  
  // Normalize target heading
  TEMP_TARGET_DIR.copy(targetHeading).normalize();
  
  // Calculate shortest arc to target
  const dot = TEMP_FORWARD.dot(TEMP_TARGET_DIR);
  
  // Skip if already aligned (avoid numerical instability)
  if (dot > 0.9999) {
    // Apply angular damping when aligned
    ship.ship.angularVelocity *= Math.exp(-motion.angularDamping * dt);
    return;
  }
  
  // Calculate cross product to get rotation axis
  TEMP_ANGULAR_AXIS.crossVectors(TEMP_FORWARD, TEMP_TARGET_DIR);
  const crossLength = TEMP_ANGULAR_AXIS.length();
  
  if (crossLength < 0.0001) {
    // Vectors are opposite, choose any perpendicular axis
    TEMP_ANGULAR_AXIS.set(0, 1, 0);
  } else {
    TEMP_ANGULAR_AXIS.divideScalar(crossLength);
  }
  
  // Calculate angular error (unsigned angle)
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  
  // Determine rotation direction (sign)
  const sign = TEMP_ANGULAR_AXIS.y >= 0 ? 1 : -1;
  const signedAngle = angle * sign;
  
  // PD control: proportional to angle error
  const targetAngularVelocity = signedAngle * 4.0; // Proportional gain
  
  // Clamp target angular velocity to maximum turn rate
  const clampedTarget = Math.max(-motion.maxTurnRate, Math.min(motion.maxTurnRate, targetAngularVelocity));
  
  // Calculate change in angular velocity (derivative control)
  const angularVelocityError = clampedTarget - ship.ship.angularVelocity;
  const maxChange = motion.angularAcceleration * dt;
  const velocityChange = Math.max(-maxChange, Math.min(maxChange, angularVelocityError));
  
  // Apply angular acceleration
  ship.ship.angularVelocity += velocityChange;
  
  // Apply angular damping
  ship.ship.angularVelocity *= Math.exp(-motion.angularDamping * dt);
  
  // Integrate angular velocity to rotation
  if (Math.abs(ship.ship.angularVelocity) > 0.001) {
    const rotationAmount = ship.ship.angularVelocity * dt;
    TEMP_ROTATION.setFromAxisAngle(new Vector3(0, 1, 0), rotationAmount);
    ship.transform.rotation.multiplyQuaternions(TEMP_ROTATION, ship.transform.rotation);
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