// Ballistic intercept helper - exported so it can be unit-tested
export type Vector3 = { x: number; y: number; z: number };

export const DEFAULT_MAX_LOOKAHEAD = 5.0; // seconds - clamp to avoid extremely long intercept times
export const EPS = 1e-6;

export function computeInterceptPoint(shooterPos: Vector3, projectileSpeed: number, targetPos: Vector3, targetVel: Vector3, maxLookahead = DEFAULT_MAX_LOOKAHEAD): Vector3 | null {
  // Guard: non-positive projectile speed cannot intercept
  if (!isFinite(projectileSpeed) || projectileSpeed <= EPS) return null;

  const rx = targetPos.x - shooterPos.x;
  const ry = targetPos.y - shooterPos.y;
  const rz = targetPos.z - shooterPos.z;

  const vx = targetVel.x;
  const vy = targetVel.y;
  const vz = targetVel.z;

  const s = projectileSpeed;
  const vv = vx*vx + vy*vy + vz*vz;
  const rv = rx*vx + ry*vy + rz*vz;
  const rr = rx*rx + ry*ry + rz*rz;

  const a = vv - s*s;
  const b = 2 * rv;
  const c = rr;

  let t: number | null = null;

  if (Math.abs(a) < EPS) {
    // Linear case: b * t + c = 0 => t = -c / b
    if (Math.abs(b) < EPS) return null;
    const t0 = -c / b;
    if (t0 > EPS) t = t0;
  } else {
    const disc = b*b - 4*a*c;
    if (disc < -EPS) return null; // negative discriminant -> no real roots
    const safeDisc = Math.max(0, disc);
    const sqrtD = Math.sqrt(safeDisc);
    const t1 = (-b - sqrtD) / (2*a);
    const t2 = (-b + sqrtD) / (2*a);
    const candidates = [t1, t2].filter(v => isFinite(v) && v > EPS).sort((x,y) => x - y);
    if (candidates.length > 0) t = candidates[0];
  }

  if (t === null || !isFinite(t) || t <= EPS) return null;

  // Clamp lookahead to avoid aiming at absurd far-future positions
  if (maxLookahead > 0 && t > maxLookahead) {
    // No valid intercept within lookahead window - return null to allow fallback
    return null;
  }

  return {
    x: targetPos.x + vx * t,
    y: targetPos.y + vy * t,
    z: targetPos.z + vz * t
  };
}
