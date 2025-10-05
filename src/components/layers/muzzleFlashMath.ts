export interface MuzzleFlashVisualParams {
  baseScale: number;
  amplitude: number;
  lifetime: number;
  elapsed: number;
}

const EPSILON = 1e-6;

export function computeMuzzleFlashVisuals({
  baseScale,
  amplitude,
  lifetime,
  elapsed,
}: MuzzleFlashVisualParams): { scale: number; fade: number; intensity: number } {
  const safeLifetime = Math.max(lifetime, EPSILON);
  const clampedElapsed = Math.max(0, elapsed);
  const normalized = Math.min(clampedElapsed / safeLifetime, 1);
  const fade = 1 - normalized;
  const scale = baseScale * Math.max(amplitude, 0) * (0.6 + 0.4 * fade);
  const intensity = 0.7 + 0.3 * fade;
  return { scale, fade, intensity };
}
