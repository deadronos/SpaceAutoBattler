import type { Vector3 } from '../types/index.js';

/**
 * 3D Vector and orientation utility functions
 */

/**
 * Calculate 3D direction vector from Euler angles
 */
export function getForwardVector(pitch: number, yaw: number): Vector3 {
  // Forward vector in 3D space (nose direction)
  const cosPitch = Math.cos(pitch);
  return {
    x: Math.cos(yaw) * cosPitch,
    y: Math.sin(yaw) * cosPitch,
    z: Math.sin(pitch)
  };
}

/**
 * Calculate right vector from pitch, yaw, and roll.
 *
 * Previous implementation ignored the pitch component which caused the
 * resulting vector to be incorrect when an object was looking straight up or
 * down (pitch ±90°). This version builds an orthonormal basis from the forward
 * vector and applies roll around it to obtain the right vector.
 */
export function getRightVector(pitch: number, yaw: number, roll: number): Vector3 {
  const forward = getForwardVector(pitch, yaw);
  // World up vector for initial basis
  const worldUp: Vector3 = { x: 0, y: 0, z: 1 };
  // Compute an initial right vector perpendicular to forward and world up
  let right = cross(worldUp, forward);
  // Use squared-magnitude to avoid an unnecessary sqrt in the common case
  const rightMagSq = magnitudeSq(right);
  if (rightMagSq < 1e-12) {
    // Forward is parallel (or very close) to worldUp; choose arbitrary right vector
    right = { x: 1, y: 0, z: 0 };
  } else {
    const inv = 1 / Math.sqrt(rightMagSq);
    right = scale(right, inv);
  }
  // Up vector prior to roll
  const up = cross(forward, right);
  const cosR = Math.cos(roll);
  const sinR = Math.sin(roll);
  // Rotate right/up around forward axis by roll
  return {
    x: right.x * cosR + up.x * sinR,
    y: right.y * cosR + up.y * sinR,
    z: right.z * cosR + up.z * sinR
  };
}

/**
 * Calculate up vector from pitch, yaw, and roll
 */
export function getUpVector(pitch: number, yaw: number, roll: number): Vector3 {
  const forward = getForwardVector(pitch, yaw);
  const right = getRightVector(pitch, yaw, roll);
  
  // Up = forward × right (cross product)
  return {
    x: forward.y * right.z - forward.z * right.y,
    y: forward.z * right.x - forward.x * right.z,
    z: forward.x * right.y - forward.y * right.x
  };
}

/**
 * Calculate target orientation (pitch, yaw) to look at a target position
 * Note: Using right-handed coordinate system where +Z is up
 */
export function lookAt(fromPos: Vector3, targetPos: Vector3): { pitch: number; yaw: number } {
  const dx = targetPos.x - fromPos.x;
  const dy = targetPos.y - fromPos.y;
  const dz = targetPos.z - fromPos.z;
  
  // Calculate horizontal distance for pitch calculation
  const sqrt = Math.sqrt;
  const horizontalDistance = sqrt(dx * dx + dy * dy);
  
  return {
    yaw: Math.atan2(dy, dx),
    // Pitch is the angle above/below the horizontal plane
    pitch: Math.atan2(dz, horizontalDistance)
  };
}

/**
 * Normalize an angle to [-PI, PI] range
 */
export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/**
 * Calculate shortest angular difference between two angles
 */
export function angleDifference(from: number, to: number): number {
  return normalizeAngle(to - from);
}

/**
 * Lerp between two angles taking the shortest path
 */
export function lerpAngle(from: number, to: number, t: number): number {
  const diff = angleDifference(from, to);
  return from + diff * t;
}

/**
 * Clamp angular turn rate
 */
export function clampTurn(angleDiff: number, maxTurnRate: number): number {
  return Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxTurnRate);
}

/**
 * Vector magnitude
 */
export function magnitude(v: Vector3): number {
  const sqrt = Math.sqrt;
  return sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Squared magnitude (length squared) — useful for threshold comparisons
 */
export function magnitudeSq(v: Vector3): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

/**
 * Normalize vector
 */
export function normalize(v: Vector3): Vector3 {
  // Use squared magnitude to avoid an unnecessary sqrt when vector is zero
  const magSq = magnitudeSq(v);
  if (magSq === 0) return { x: 0, y: 0, z: 0 };
  const sqrt = Math.sqrt;
  const inv = 1 / sqrt(magSq);
  return {
    x: v.x * inv,
    y: v.y * inv,
    z: v.z * inv
  };
}

/**
 * Vector dot product
 */
export function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Vector cross product
 */
export function cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

/**
 * Scale vector by scalar
 */
export function scale(v: Vector3, s: number): Vector3 {
  return {
    x: v.x * s,
    y: v.y * s,
    z: v.z * s
  };
}

/**
 * Add vectors
 */
export function add(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z
  };
}

/**
 * Subtract vectors
 */
export function subtract(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z
  };
}