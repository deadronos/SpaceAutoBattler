export function shortestAngle(from: number, to: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

export function dampingFactor(damping: number, dt: number): number {
  return Math.exp(-damping * dt);
}
