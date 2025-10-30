export function kToAlpha(k: number | undefined, dt: number): number {
  if (!k || k <= 0 || dt <= 0) {
    return 0;
  }
  return 1 - Math.exp(-k * dt);
}
