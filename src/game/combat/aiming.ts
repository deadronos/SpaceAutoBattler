import { Vector3 } from 'three';
import type { ShipEntity } from '../../types/index.js';
import { clamp } from '../../utils/math.js';
import { getForwardFromQuaternion } from '../../utils/vector.js';

const TEMP_REL_POS = new Vector3();
const TEMP_TARGET_VEL = new Vector3();
const TEMP_SHIP_VEL = new Vector3();
const TEMP_REL_VEL = new Vector3();

/**
 * Extracts the velocity of a ship safely.
 *
 * @param {ShipEntity} ship - The ship entity.
 * @param {Vector3} out - The vector to store the result.
 * @returns {Vector3} The velocity vector.
 */
export function getShipVelocity(ship: ShipEntity, out: Vector3): Vector3 {
  const component = ship.ship;
  const velocity = component?.velocity;
  if (!velocity) {
    out.set(0, 0, 0);
    return out;
  }
  const x = Number.isFinite(velocity.x) ? velocity.x : 0;
  const y = Number.isFinite(velocity.y) ? velocity.y : 0;
  const z = Number.isFinite(velocity.z) ? velocity.z : 0;
  out.set(x, y, z);
  return out;
}

/**
 * Computes the heading vector required to intercept a target.
 *
 * @param {ShipEntity} ship - The source ship.
 * @param {ShipEntity} target - The target ship.
 * @param {Vector3} out - The vector to store the result.
 * @returns {Vector3} The intercept heading vector.
 */
export function computeInterceptHeadingVector(
  ship: ShipEntity,
  target: ShipEntity,
  out: Vector3,
): Vector3 {
  const projectileSpeed = Math.max(1, Math.max(ship.ship.projectileSpeed, ship.ship.speed * 0.75));
  const relativePos = TEMP_REL_POS.copy(target.transform.position).sub(ship.transform.position);
  const targetVel = getShipVelocity(target, TEMP_TARGET_VEL);
  const shipVel = getShipVelocity(ship, TEMP_SHIP_VEL);
  const relativeVel = TEMP_REL_VEL.copy(targetVel).sub(shipVel);

  const a = relativeVel.lengthSq() - projectileSpeed * projectileSpeed;
  const b = 2 * relativeVel.dot(relativePos);
  const c = relativePos.lengthSq();

  let t = Math.max(0, -b / (2 * a));
  if (Math.abs(a) < 1e-5) {
    t = b !== 0 ? Math.max(0, -c / b) : 0;
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const sqrt = Math.sqrt(discriminant);
      const t1 = (-b - sqrt) / (2 * a);
      const t2 = (-b + sqrt) / (2 * a);
      t = Math.min(t1, t2);
      if (t < 0) t = Math.max(t1, t2);
      if (t < 0) t = 0;
    }
  }

  t = clamp(t, 0, 2.5);
  const future = out.copy(target.transform.position).addScaledVector(targetVel, t);
  future.sub(ship.transform.position);
  if (future.lengthSq() < 1e-5) {
    out.copy(relativePos);
  } else {
    out.copy(future);
  }
  if (out.lengthSq() < 1e-5) {
    getForwardFromQuaternion(ship.transform.rotation, out);
  } else {
    out.normalize();
  }
  return out;
}
