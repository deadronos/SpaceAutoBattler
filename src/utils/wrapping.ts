export type Vec3 = { x: number; y: number; z: number };
export type Bounds3 = { min: Vec3; max: Vec3; wrap: { x: boolean; y: boolean; z: boolean } };

export function normalizePosition(pos: Vec3, bounds: Bounds3): Vec3 {
  const res = { x: pos.x, y: pos.y, z: pos.z };
  (['x', 'y', 'z'] as Array<'x' | 'y' | 'z'>).forEach((axis) => {
    const min = (bounds.min as any)[axis];
    const max = (bounds.max as any)[axis];
    const wrap = (bounds.wrap as any)[axis];
    if (!wrap) return;
    const width = max - min;
    let v = (res as any)[axis];
    // safe modulo for negatives
    v = ((v - min) % width + width) % width + min;
    (res as any)[axis] = v;
  });
  return res;
}

export function shortestDelta(a: number, b: number, min: number, max: number, wrap: boolean): number {
  const width = max - min;
  let d = a - b;
  if (!wrap) return d;
  d = ((d + width / 2) % width) - width / 2;
  return d;
}

export function wrappedDistance(a: Vec3, b: Vec3, bounds: Bounds3): number {
  const dx = shortestDelta(a.x, b.x, bounds.min.x, bounds.max.x, bounds.wrap.x);
  const dy = shortestDelta(a.y, b.y, bounds.min.y, bounds.max.y, bounds.wrap.y);
  const dz = shortestDelta(a.z, b.z, bounds.min.z, bounds.max.z, bounds.wrap.z);
  return Math.hypot(dx, dy, dz);
}
