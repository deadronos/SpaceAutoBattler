import { Vector3, Quaternion } from 'three';

/**
 * Get the forward direction vector from a quaternion.
 * Modifies the output vector in-place for performance.
 * 
 * @param rotation - The quaternion representing the rotation
 * @param out - The output vector to store the result (defaults to new Vector3)
 * @returns The forward direction vector (0, 0, 1 rotated by the quaternion)
 */
export function getForwardFromQuaternion(
  rotation: Quaternion | { x: number; y: number; z: number; w: number },
  out: Vector3 = new Vector3()
): Vector3 {
  return out.set(0, 0, 1).applyQuaternion(rotation);
}

/**
 * Get the up direction vector from a quaternion.
 * Modifies the output vector in-place for performance.
 * 
 * @param rotation - The quaternion representing the rotation
 * @param out - The output vector to store the result (defaults to new Vector3)
 * @returns The up direction vector (0, 1, 0 rotated by the quaternion)
 */
export function getUpFromQuaternion(
  rotation: Quaternion | { x: number; y: number; z: number; w: number },
  out: Vector3 = new Vector3()
): Vector3 {
  return out.set(0, 1, 0).applyQuaternion(rotation);
}

/**
 * Get the right direction vector from a quaternion.
 * Modifies the output vector in-place for performance.
 * 
 * @param rotation - The quaternion representing the rotation
 * @param out - The output vector to store the result (defaults to new Vector3)
 * @returns The right direction vector (1, 0, 0 rotated by the quaternion)
 */
export function getRightFromQuaternion(
  rotation: Quaternion | { x: number; y: number; z: number; w: number },
  out: Vector3 = new Vector3()
): Vector3 {
  return out.set(1, 0, 0).applyQuaternion(rotation);
}
