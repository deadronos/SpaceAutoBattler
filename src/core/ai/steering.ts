import type { Vector3, SimBounds, Ship, RNG as _RNG } from '../../types/index.js';
import type { BehaviorConfig } from '../../config/behaviorConfig.js';
import { lookAt, getForwardVector, angleDifference, clampTurn } from '../../utils/vector3.js';
import { PhysicsConfig } from '../../config/physicsConfig.js';
// no-op import removed: steering logic doesn't need DEBUG_AI directly

export type RandomFn = () => number; // [0,1)

// Calculate safety score for an escape position. Higher score = safer.
export function calculateEscapeScore(
  shipPos: Vector3,
  targetPos: Vector3,
  threats: readonly Vector3[],
  friendlies: readonly Vector3[],
  bounds: SimBounds,
  settings: BehaviorConfig['globalSettings']
): number {
  let score = settings.evadeBaseScore;

  // Threat proximity penalty
  for (const t of threats) {
    const dx = targetPos.x - t.x;
    const dy = targetPos.y - t.y;
    const dz = targetPos.z - t.z;
    const dist = Math.hypot(dx, dy, dz);
    const threatPenalty = Math.max(0, 200 - dist) * settings.evadeThreatPenaltyWeight;
    score -= threatPenalty;
  }

  // Boundary penalties
  const m = settings.boundarySafetyMargin;
  if (targetPos.x < m) score -= (m - targetPos.x) * settings.evadeBoundaryPenaltyWeight;
  if (targetPos.x > bounds.width - m) score -= (targetPos.x - (bounds.width - m)) * settings.evadeBoundaryPenaltyWeight;
  if (targetPos.y < m) score -= (m - targetPos.y) * settings.evadeBoundaryPenaltyWeight;
  if (targetPos.y > bounds.height - m) score -= (targetPos.y - (bounds.height - m)) * settings.evadeBoundaryPenaltyWeight;
  if (targetPos.z < m) score -= (m - targetPos.z) * settings.evadeBoundaryPenaltyWeight;
  if (targetPos.z > bounds.depth - m) score -= (targetPos.z - (bounds.depth - m)) * settings.evadeBoundaryPenaltyWeight;

  // Distance improvement bonus relative to nearest threat (assume first is nearest if provided)
  if (threats.length > 0) {
    const t = threats[0];
    const cdx = shipPos.x - t.x;
    const cdy = shipPos.y - t.y;
    const cdz = shipPos.z - t.z;
    const currentDistance = Math.hypot(cdx, cdy, cdz);
    const ndx = targetPos.x - t.x;
    const ndy = targetPos.y - t.y;
    const ndz = targetPos.z - t.z;
    const newDistance = Math.hypot(ndx, ndy, ndz);
    if (newDistance > currentDistance) {
      score += (newDistance - currentDistance) * settings.evadeDistanceImprovementWeight;
    }
  }

  // Friendly collision penalty
  for (const f of friendlies) {
    const dx = targetPos.x - f.x;
    const dy = targetPos.y - f.y;
    const dz = targetPos.z - f.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < settings.friendlyAvoidanceDistance) {
      score -= (settings.friendlyAvoidanceDistance - dist) * settings.evadeFriendlyPenaltyWeight;
    }
  }

  return score;
}

// Pure-ish moveTowards: mutates ship based only on provided inputs. Boundary physics is intentionally excluded.
export function moveTowards(
  ship: Ship,
  targetPos: Vector3,
  dt: number,
  settings: BehaviorConfig['globalSettings'],
  speedOverride?: number
): void {
  const moveSpeed = speedOverride || ship.speed;
  // Desired direction
  const dx = targetPos.x - ship.pos.x;
  const dy = targetPos.y - ship.pos.y;
  const dz = targetPos.z - ship.pos.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance <= settings.movementCloseEnoughThreshold) return;

  // Target orientation
  const targetOrientation = lookAt(ship.pos, targetPos);
  const pitchDiff = angleDifference(ship.orientation.pitch, targetOrientation.pitch);
  const yawDiff = angleDifference(ship.orientation.yaw, targetOrientation.yaw);
  const pitchTurn = clampTurn(pitchDiff, ship.turnRate * dt);
  const yawTurn = clampTurn(yawDiff, ship.turnRate * dt);
  ship.orientation.pitch += pitchTurn;
  ship.orientation.yaw += yawTurn;
  ship.dir = ship.orientation.yaw; // maintain legacy field

  // Advance velocity and position using PhysicsConfig
  const forward = getForwardVector(ship.orientation.pitch, ship.orientation.yaw);
  const accel = moveSpeed * PhysicsConfig.acceleration.forwardMultiplier;
  ship.vel.x += forward.x * accel * dt;
  ship.vel.y += forward.y * accel * dt;
  ship.vel.z += forward.z * accel * dt;

  ship.vel.x *= PhysicsConfig.speed.dampingFactor;
  ship.vel.y *= PhysicsConfig.speed.dampingFactor;
  ship.vel.z *= PhysicsConfig.speed.dampingFactor;

  const maxV = moveSpeed * PhysicsConfig.speed.maxSpeedMultiplier;
  const v = Math.hypot(ship.vel.x, ship.vel.y, ship.vel.z);
  if (v > maxV && v > 0) {
    ship.vel.x = (ship.vel.x / v) * maxV;
    ship.vel.y = (ship.vel.y / v) * maxV;
    ship.vel.z = (ship.vel.z / v) * maxV;
  }

  ship.pos.x += ship.vel.x * dt;
  ship.pos.y += ship.vel.y * dt;
  ship.pos.z += ship.vel.z * dt;
}

// Calculate separation force given neighbor positions. Returns unit vector and neighborCount.
export function calculateSeparationForceWithCount(
  shipPos: Vector3,
  neighbors: readonly Vector3[],
  separationDistance: number,
  magnitudeThreshold: number,
  random: RandomFn
): { force: Vector3; neighborCount: number } {
  // Compute separation vector from nearby neighbors
  const count = neighbors?.length ?? 0;
  if (count === 0) return { force: { x: 0, y: 0, z: 0 }, neighborCount: 0 };

  let sx = 0, sy = 0, sz = 0;
  const sepDistSq = separationDistance * separationDistance;
  for (const n of neighbors) {
    const dx = shipPos.x - n.x;
    const dy = shipPos.y - n.y;
    const dz = shipPos.z - n.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > 0 && distSq < sepDistSq) {
      // accumulate vector pointing away from neighbor, weighted by proximity
      const inv = 1 / Math.sqrt(distSq);
      sx += (dx * inv);
      sy += (dy * inv);
      sz += (dz * inv);
    }
  }

  // Average
  sx /= count; sy /= count; sz /= count;
  const mag = Math.hypot(sx, sy, sz);
  if (mag > magnitudeThreshold) {
    return { force: { x: sx / mag, y: sy / mag, z: sz / mag }, neighborCount: count };
  }

  // Symmetry fallback: compute center and push away
  let cx = 0, cy = 0, cz = 0;
  let centerCount = 0;
  for (const n of neighbors) {
    const dx = shipPos.x - n.x;
    const dy = shipPos.y - n.y;
    const dz = shipPos.z - n.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq > 0 && distSq < sepDistSq) {
      cx += n.x; cy += n.y; cz += n.z; centerCount++;
    }
  }
  if (centerCount > 0) {
    const inv = 1 / centerCount;
    cx *= inv; cy *= inv; cz *= inv;
    const rx = shipPos.x - cx;
    const ry = shipPos.y - cy;
    const rz = shipPos.z - cz;
    const rmag = Math.hypot(rx, ry, rz);
    if (rmag > magnitudeThreshold) {
      return { force: { x: rx / rmag, y: ry / rmag, z: rz / rmag }, neighborCount: count };
    }
  }

  // Last resort: small random vector to break symmetry
  const angle = random() * Math.PI * 2;
  return { force: { x: Math.cos(angle), y: Math.sin(angle), z: 0 }, neighborCount: count };
}
