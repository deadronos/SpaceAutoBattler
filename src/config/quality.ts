import type { N8AOQualityMode } from 'n8ao';

/**
 * Renderer-only graphics-quality presets.
 *
 * This module is intentionally pure and side-effect free (see `src/config/AGENTS.md`):
 * it maps a user-facing preset to concrete renderer knobs. It never touches
 * simulation state or `GameState`; consumers apply the resolved knobs in the
 * renderer/UI layer only.
 */

/** User-selectable quality preset. `auto` resolves from a detected tier. */
export type QualityPreset = 'low' | 'medium' | 'high' | 'auto';

/** Concrete quality tier used to look up renderer knobs. */
export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  /** Concrete tier these settings belong to. */
  tier: QualityTier;
  /** Device-pixel-ratio clamp and the scaler's starting value. */
  dpr: { min: number; max: number; initial: number };
  /** Whether the key directional light casts shadows. */
  shadows: boolean;
  /** Shadow map edge size in texels (ignored when `shadows` is false). */
  shadowMapSize: number;
  /** Ambient-occlusion knobs consumed by the N8AO pass. */
  ao: { enabled: boolean; halfRes: boolean; quality: N8AOQualityMode };
  /** Bloom ceiling: postprocessing may be further reduced by UI toggles. */
  bloom: boolean;
  /** Engine-exhaust particle budget. */
  particles: { maxParticles: number; spawnRatePerAnchor: number };
  /**
   * Star shader noise octave count. Binary knob — the shader only distinguishes
   * the `low` tier (2 octaves) from everything else (7 octaves); applied only
   * for `low`. `medium` therefore matches `high` here.
   */
  starShaderOctaves: number;
  /**
   * Whether shield materials enable chromatic aberration. Binary knob — applied
   * only for the `low` tier (chromatic collapsed to 1 evaluation); `medium`
   * therefore matches `high` (3 evaluations).
   */
  shieldChromatic: boolean;
  /**
   * Widest skysphere texture to upgrade to after the 2048px low-res one, further capped by
   * the GPU's `maxTextureSize`. 2048 means no upgrade.
   */
  skysphereMaxSize: number;
}

/**
 * Concrete renderer knobs per tier.
 *
 * `high` reproduces the shipped values exactly (DPR 0.5/2/0.5 — matching the
 * `<DynamicResScaler>` default `initialDpr`, shadows on, map 2048, AO
 * Medium/half-res, bloom on, 5000 particles at 12/s per anchor, 7 star octaves,
 * shield chromatic aberration on) so selecting `high` is a no-op relative to the
 * previous build.
 */
export const QUALITY_PRESETS: Record<QualityTier, QualitySettings> = {
  high: {
    tier: 'high',
    dpr: { min: 0.5, max: 2, initial: 0.5 },
    shadows: true,
    shadowMapSize: 2048,
    ao: { enabled: true, halfRes: true, quality: 'Medium' },
    bloom: true,
    particles: { maxParticles: 5000, spawnRatePerAnchor: 12 },
    starShaderOctaves: 7,
    shieldChromatic: true,
    skysphereMaxSize: 8192,
  },
  medium: {
    tier: 'medium',
    dpr: { min: 0.5, max: 1.5, initial: 0.75 },
    shadows: true,
    shadowMapSize: 1024,
    ao: { enabled: true, halfRes: true, quality: 'Low' },
    bloom: true,
    particles: { maxParticles: 3000, spawnRatePerAnchor: 8 },
    // Binary shader knobs: `medium` matches `high` (only `low` differs). Medium
    // is distinguished from high via DPR/shadow/AO/particle knobs instead.
    starShaderOctaves: 7,
    shieldChromatic: true,
    skysphereMaxSize: 4096,
  },
  low: {
    tier: 'low',
    dpr: { min: 0.5, max: 1.0, initial: 0.5 },
    shadows: false,
    shadowMapSize: 512,
    ao: { enabled: false, halfRes: true, quality: 'Low' },
    bloom: false,
    particles: { maxParticles: 1200, spawnRatePerAnchor: 4 },
    starShaderOctaves: 2,
    shieldChromatic: false,
    skysphereMaxSize: 2048,
  },
};

/**
 * Resolve the concrete tier for a preset. `auto` delegates to the detected
 * tier; any other preset maps directly. Unknown presets fall back to `high`
 * so partial store mocks / stale persisted state stay safe.
 */
export function resolveQualityTier(
  preset: QualityPreset | undefined,
  autoTier: QualityTier | undefined,
): QualityTier {
  if (preset === 'auto') {
    return autoTier === 'low' || autoTier === 'medium' || autoTier === 'high' ? autoTier : 'high';
  }
  if (preset === 'low' || preset === 'medium' || preset === 'high') {
    return preset;
  }
  return 'high';
}

/** Resolve the full renderer knob set for a preset. */
export function resolveQualitySettings(
  preset: QualityPreset | undefined,
  autoTier: QualityTier | undefined,
): QualitySettings {
  return QUALITY_PRESETS[resolveQualityTier(preset, autoTier)] ?? QUALITY_PRESETS.high;
}

export interface QualityDetectionInput {
  /** `WebGLRenderer.capabilities.maxTextureSize` when available. */
  maxTextureSize?: number;
  /** `navigator.hardwareConcurrency` when available. */
  hardwareConcurrency?: number;
  /** `navigator.deviceMemory` (GB) when available. */
  deviceMemory?: number;
}

/**
 * Pure, headless-safe heuristic that picks an initial tier from coarse device
 * capabilities. Never reads `window`/`navigator` itself — callers pass the
 * values in. With no inputs (vitest/happy-dom/headless) it conservatively
 * defaults to `'high'` so the default preset preserves current output.
 */
export function detectInitialQualityTier(input: QualityDetectionInput = {}): QualityTier {
  const { maxTextureSize, hardwareConcurrency, deviceMemory } = input;

  if (
    maxTextureSize === undefined &&
    hardwareConcurrency === undefined &&
    deviceMemory === undefined
  ) {
    return 'high';
  }

  let score = 0;
  if (maxTextureSize !== undefined) {
    score += maxTextureSize >= 8192 ? 2 : maxTextureSize >= 4096 ? 1 : 0;
  }
  if (hardwareConcurrency !== undefined) {
    score += hardwareConcurrency >= 8 ? 2 : hardwareConcurrency >= 4 ? 1 : 0;
  }
  if (deviceMemory !== undefined) {
    score += deviceMemory >= 8 ? 2 : deviceMemory >= 4 ? 1 : 0;
  }

  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}
