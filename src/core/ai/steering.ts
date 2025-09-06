import type { Vector3, SimBounds, Ship, RNG as _RNG } from '../../types/index.js';
import type { BehaviorConfig } from '../../config/behaviorConfig.js';
import { lookAt, getForwardVector, angleDifference, clampTurn } from '../../utils/vector3.js';
import { PhysicsConfig } from '../../config/physicsConfig.js';
import { DEBUG_AI } from '../../utils/env.js';

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
    const distSq = dx * dx + dy * dy + dz * dz;
    // Only compute actual distance when inside the penalty radius to avoid sqrt
    if (distSq < 200 * 200) {
      const dist = Math.sqrt(distSq);
      const threatPenalty = Math.max(0, 200 - dist) * settings.evadeThreatPenaltyWeight;
      score -= threatPenalty;
    }
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
    const ndx = targetPos.x - t.x;
    const ndy = targetPos.y - t.y;
    const ndz = targetPos.z - t.z;
    const currentDistSq = cdx * cdx + cdy * cdy + cdz * cdz;
    const newDistSq = ndx * ndx + ndy * ndy + ndz * ndz;
    if (newDistSq > currentDistSq) {
      // compute sqrt difference only when beneficial
      const currentDistance = Math.sqrt(currentDistSq);
      const newDistance = Math.sqrt(newDistSq);
      score += (newDistance - currentDistance) * settings.evadeDistanceImprovementWeight;
    }
  }

  // Friendly collision penalty
  for (const f of friendlies) {
    const dx = targetPos.x - f.x;
    const dy = targetPos.y - f.y;
    const dz = targetPos.z - f.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    const thresholdSq = settings.friendlyAvoidanceDistance * settings.friendlyAvoidanceDistance;
    if (distSq < thresholdSq) {
      const dist = Math.sqrt(distSq);
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
  speedOverride?: number,
  // When true, bypass the "close enough" early-return so callers (like evade)
  // can force orientation/acceleration even when the target is within the
  // movementCloseEnoughThreshold. This keeps the function backwards-
  // compatible while allowing special-case behaviors.
  ignoreCloseEnough?: boolean
): void {
  const moveSpeed = speedOverride || ship.speed;
  // Desired direction
  const dx = targetPos.x - ship.pos.x;
  const dy = targetPos.y - ship.pos.y;
  const dz = targetPos.z - ship.pos.z;
  const distanceSq = dx * dx + dy * dy + dz * dz;
  const thresholdSq = settings.movementCloseEnoughThreshold * settings.movementCloseEnoughThreshold;
  if (distanceSq <= thresholdSq && !ignoreCloseEnough) {
    if (DEBUG_AI) {
      const distance = Math.sqrt(distanceSq);
      console.error(`AI-DEBUG moveTowards early-return distance=${distance.toFixed(3)} threshold=${settings.movementCloseEnoughThreshold} ignoreCloseEnough=${!!ignoreCloseEnough}`);
    }
    return;
  }

  // Target orientation
  const targetOrientation = lookAt(ship.pos, targetPos);
  if (ignoreCloseEnough) {
    // For evade and other urgent moves, allow immediate orientation so the
    // ship's forward vector points toward the escape target during this tick.
    ship.orientation.pitch = targetOrientation.pitch;
    ship.orientation.yaw = targetOrientation.yaw;
  } else {
    const pitchDiff = angleDifference(ship.orientation.pitch, targetOrientation.pitch);
    const yawDiff = angleDifference(ship.orientation.yaw, targetOrientation.yaw);
    const pitchTurn = clampTurn(pitchDiff, ship.turnRate * dt);
    const yawTurn = clampTurn(yawDiff, ship.turnRate * dt);
    ship.orientation.pitch += pitchTurn;
    ship.orientation.yaw += yawTurn;
  }
  ship.dir = ship.orientation.yaw; // maintain legacy field

  // Advance velocity and position using PhysicsConfig
  const forward = getForwardVector(ship.orientation.pitch, ship.orientation.yaw);
  const accel = moveSpeed * PhysicsConfig.acceleration.forwardMultiplier;
  if (DEBUG_AI) {
    const distance = Math.sqrt(distanceSq);
    console.error(`AI-DEBUG moveTowards ship=${ship.id} distance=${distance.toFixed(6)} moveSpeed=${moveSpeed} accel=${accel.toFixed(6)} dt=${dt.toFixed(6)} forward=${forward.x.toFixed(6)},${forward.y.toFixed(6)},${forward.z.toFixed(6)}`);
  }
  const deltaX = forward.x * accel * dt;
  const deltaY = forward.y * accel * dt;
  const deltaZ = forward.z * accel * dt;
  if (DEBUG_AI) console.error(`AI-DEBUG moveTowards deltaVel pre=${deltaX.toFixed(9)},${deltaY.toFixed(9)},${deltaZ.toFixed(9)} preVel=${ship.vel.x.toFixed(9)},${ship.vel.y.toFixed(9)},${ship.vel.z.toFixed(9)}`);
  ship.vel.x += deltaX;
  ship.vel.y += deltaY;
  ship.vel.z += deltaZ;

  ship.vel.x *= PhysicsConfig.speed.dampingFactor;
  ship.vel.y *= PhysicsConfig.speed.dampingFactor;
  ship.vel.z *= PhysicsConfig.speed.dampingFactor;

  const maxV = moveSpeed * PhysicsConfig.speed.maxSpeedMultiplier;
  const vSq = ship.vel.x * ship.vel.x + ship.vel.y * ship.vel.y + ship.vel.z * ship.vel.z;
  if (vSq > maxV * maxV && vSq > 0) {
    const v = Math.sqrt(vSq);
    ship.vel.x = (ship.vel.x / v) * maxV;
    ship.vel.y = (ship.vel.y / v) * maxV;
    ship.vel.z = (ship.vel.z / v) * maxV;
  }

  if (DEBUG_AI) {
    try { console.error(`AI-DEBUG moveTowards postDamp preClampVel ship=${ship.vel.x.toFixed(9)},${ship.vel.y.toFixed(9)},${ship.vel.z.toFixed(9)} maxV=${maxV.toFixed(6)}`); } catch { /* best-effort */ }
  }

  ship.pos.x += ship.vel.x * dt;
  ship.pos.y += ship.vel.y * dt;
  ship.pos.z += ship.vel.z * dt;
}

/**
 * Apply a gentle corrective steer away from map edges when within `margin`.
 * This mutates ship.vel directly by applying a small acceleration away from the nearest edge.
 */
export function applyBoundarySteer(ship: Ship, bounds: SimBounds, margin: number, strength: number, dt: number) {
  // Compute steer vector pointing toward map center proportional to closeness to edge
  let sx = 0, sy = 0, sz = 0;
  if (ship.pos.x < margin) sx += 1 - (ship.pos.x / margin);
  else if (ship.pos.x > bounds.width - margin) sx -= 1 - ((bounds.width - ship.pos.x) / margin);
  if (ship.pos.y < margin) sy += 1 - (ship.pos.y / margin);
  else if (ship.pos.y > bounds.height - margin) sy -= 1 - ((bounds.height - ship.pos.y) / margin);
  if (ship.pos.z < margin) sz += 1 - (ship.pos.z / margin);
  else if (ship.pos.z > bounds.depth - margin) sz -= 1 - ((bounds.depth - ship.pos.z) / margin);

  const magSq = sx * sx + sy * sy + sz * sz;
  if (magSq <= 0) return;
  const mag = Math.sqrt(magSq);
  const nx = sx / mag, ny = sy / mag, nz = sz / mag;
  // Apply as small acceleration scaled by ship.speed, configured strength and dt
  const accel = ship.speed * strength;
  ship.vel.x += nx * accel * dt;
  ship.vel.y += ny * accel * dt;
  ship.vel.z += nz * accel * dt;
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
    const rmagSq = rx * rx + ry * ry + rz * rz;
    if (rmagSq > magnitudeThreshold * magnitudeThreshold) {
      const rmag = Math.sqrt(rmagSq);
      return { force: { x: rx / rmag, y: ry / rmag, z: rz / rmag }, neighborCount: count };
    }
  }

  // Last resort: small random vector to break symmetry
  const angle = random() * Math.PI * 2;
  return { force: { x: Math.cos(angle), y: Math.sin(angle), z: 0 }, neighborCount: count };
}
