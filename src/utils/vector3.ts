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
 * Calculate right vector from yaw and roll (for banking/rolling movements)
 */
export function getRightVector(yaw: number, roll: number): Vector3 {
  return {
    x: -Math.sin(yaw) * Math.cos(roll),
    y: Math.cos(yaw) * Math.cos(roll),
    z: Math.sin(roll)
  };
}

/**
 * Calculate up vector from pitch, yaw, and roll
 */
export function getUpVector(pitch: number, yaw: number, roll: number): Vector3 {
  const forward = getForwardVector(pitch, yaw);
  const right = getRightVector(yaw, roll);
  
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
  const horizontalDistance = Math.sqrt(dx * dx + dy * dy);
  
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
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Normalize vector
 */
export function normalize(v: Vector3): Vector3 {
  const mag = magnitude(v);
  if (mag === 0) return { x: 0, y: 0, z: 0 };
  return {
    x: v.x / mag,
    y: v.y / mag,
    z: v.z / mag
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