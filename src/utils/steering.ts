import { Quaternion, Vector3 } from 'three';

export const FORWARD = new Vector3(0, 0, 1);
const DEFAULT_FALLBACK = new Vector3(0, 0, 1);
const TEMP_DIR = new Vector3();
const TEMP_LEAD = new Vector3();

export function safeNormalize(
  dst: Vector3,
  src: Vector3,
  fallback: Vector3 = DEFAULT_FALLBACK,
): Vector3 {
  if (src.lengthSq() > 1e-12) {
    if (dst !== src) {
      dst.copy(src);
    }
    return dst.normalize();
  }
  if (fallback.lengthSq() > 1e-12) {
    dst.copy(fallback);
    return dst.normalize();
  }
  dst.set(0, 0, 1);
  return dst;
}

export function orientQuaternionFromDirection(
  direction: Vector3,
  fallbackDirection: Vector3 = DEFAULT_FALLBACK,
  target = new Quaternion(),
): Quaternion {
  const normalised = safeNormalize(TEMP_DIR, direction, fallbackDirection);
  target.setFromUnitVectors(FORWARD, normalised);
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || !Number.isFinite(target.z)) {
    return target.identity();
  }
  return target;
}

export function computeLeadDirection(
  targetPos: Vector3,
  sourcePos: Vector3,
  targetVelocity: Vector3,
  leadFactor = 0.5,
  out: Vector3 = new Vector3(),
): Vector3 {
  TEMP_DIR.copy(targetPos).sub(sourcePos);
  safeNormalize(out, TEMP_DIR, FORWARD);

  if (leadFactor !== 0 && targetVelocity.lengthSq() > 1e-10) {
    safeNormalize(TEMP_LEAD, targetVelocity, FORWARD).multiplyScalar(leadFactor);
    out.add(TEMP_LEAD);
    safeNormalize(out, out, FORWARD);
  }

  return out;
}

export function steerDirection(
  currentDir: Vector3,
  desiredDir: Vector3,
  turnRate: number,
  delta: number,
  out: Vector3 = new Vector3(),
): { newDir: Vector3; angle: number } {
  const angle = currentDir.angleTo(desiredDir);
  if (!Number.isFinite(angle) || angle < 1e-6) {
    safeNormalize(out, currentDir, desiredDir);
    return { newDir: out, angle: Math.max(angle, 0) };
  }

  const maxTurn = Math.max(0, turnRate) * Math.max(delta, 0);
  if (maxTurn <= 0) {
    safeNormalize(out, currentDir, desiredDir);
    return { newDir: out, angle };
  }

  const t = Math.min(1, maxTurn / angle);
  out.copy(currentDir).lerp(desiredDir, t);
  safeNormalize(out, out, desiredDir);
  return { newDir: out, angle };
}

export function clampAngle(angle: number, min: number, max: number): number {
  if (!Number.isFinite(angle)) {
    return Math.min(Math.max(0, Math.min(min, max)), Math.max(min, max));
  }
  const twoPi = Math.PI * 2;
  let normalised = angle % twoPi;
  if (normalised < -Math.PI) normalised += twoPi;
  if (normalised > Math.PI) normalised -= twoPi;

  const minBound = Math.min(min, max);
  const maxBound = Math.max(min, max);
  if (normalised < minBound) return minBound;
  if (normalised > maxBound) return maxBound;
  return normalised;
}
