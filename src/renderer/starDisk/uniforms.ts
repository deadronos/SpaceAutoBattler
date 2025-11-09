export interface StarDiskHazeUniformInput {
  taperStrength?: number;
  edgeFadeThreshold?: number;
  edgeExponent?: number;
}

export interface StarDiskHazeUniformResult {
  fade: number;
  edgeThreshold: number;
  edgeExponent: number;
}

export interface StarDiskBoundaryUniformInput {
  featherStart?: number;
  featherExponent?: number;
  alphaFloor?: number;
}

export interface StarDiskBoundaryUniformResult {
  start: number;
  exponent: number;
  alphaFloor: number;
  reserved: number;
}

export const DEFAULT_HAZE_SETTINGS: Required<StarDiskHazeUniformInput> = Object.freeze({
  taperStrength: 0.9,
  edgeFadeThreshold: 0.5,
  edgeExponent: 1.25,
});

export const DEFAULT_BOUNDARY_SETTINGS: Required<StarDiskBoundaryUniformInput> = Object.freeze({
  featherStart: 0.875,
  featherExponent: 1.75,
  alphaFloor: 0.05,
});

export const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

export function deriveBoundaryUniform(
  input?: StarDiskBoundaryUniformInput,
): StarDiskBoundaryUniformResult {
  const rawStart = Number.isFinite(input?.featherStart as number)
    ? (input?.featherStart as number)
    : DEFAULT_BOUNDARY_SETTINGS.featherStart;
  const start = Math.min(Math.max(rawStart, 0.6), 0.999);
  const rawExponent = Number.isFinite(input?.featherExponent as number)
    ? (input?.featherExponent as number)
    : DEFAULT_BOUNDARY_SETTINGS.featherExponent;
  const exponent = Math.min(Math.max(rawExponent, 0.5), 6);
  const rawFloor = Number.isFinite(input?.alphaFloor as number)
    ? (input?.alphaFloor as number)
    : DEFAULT_BOUNDARY_SETTINGS.alphaFloor;
  const alphaFloor = Math.min(Math.max(rawFloor, 0), 0.3);

  return {
    start,
    exponent,
    alphaFloor,
    reserved: 0,
  };
}

export function deriveHazeUniform(
  facingCos: number,
  input?: StarDiskHazeUniformInput,
): StarDiskHazeUniformResult {
  const rawStrength = Number.isFinite(input?.taperStrength as number)
    ? (input?.taperStrength as number)
    : DEFAULT_HAZE_SETTINGS.taperStrength;
  const strength = clamp01(rawStrength);
  const rawThreshold = Number.isFinite(input?.edgeFadeThreshold as number)
    ? (input?.edgeFadeThreshold as number)
    : DEFAULT_HAZE_SETTINGS.edgeFadeThreshold;
  const threshold = Math.min(Math.max(rawThreshold, 0), 0.9);
  const rawExponent = Number.isFinite(input?.edgeExponent as number)
    ? (input?.edgeExponent as number)
    : DEFAULT_HAZE_SETTINGS.edgeExponent;
  const exponent = Math.min(Math.max(rawExponent, 0.5), 6);

  const safeFacing = clamp01(Number.isFinite(facingCos) ? facingCos : 1);
  const denom = Math.max(1 - threshold, 1e-3);
  const normalized = Math.pow(clamp01((safeFacing - threshold) / denom), exponent);
  const horizonFloor = clamp01(1 - strength);
  const fade = Math.min(Math.max(horizonFloor + (1 - horizonFloor) * normalized, 0), 1.1);

  return {
    fade,
    edgeThreshold: threshold,
    edgeExponent: exponent,
  };
}
