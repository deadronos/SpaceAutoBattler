import type { ShipHull } from '../types/index.js';

export type ShieldMaterialKind = 'hex' | 'transmission';

export interface ShieldVisualSettings {
  /** Multiplier applied to the model bounding-sphere radius. */
  margin?: number;
  /** Hex grid density used by the shield shader. */
  hexScale?: number;
  /** Edge width used by the shield shader. */
  edgeWidth?: number;
  /** Maximum final alpha for shield material (0..1). */
  maxAlpha?: number;
  /** What material to use for the shield: custom hex shader or drei MeshTransmissionMaterial */
  materialKind?: ShieldMaterialKind;
  /** Optional params for MeshTransmissionMaterial when materialKind==='transmission' */
  transmission?: {
    thickness?: number; // 0..1 typical
    chromaticAberration?: number;
    anisotropicBlur?: number;
    distortion?: number;
    distortionScale?: number;
    temporalDistortion?: number;
    attenuationDistance?: number;
    roughness?: number;
    clearcoat?: number;
    ior?: number; // index of refraction, e.g., 1.2
  };
}

export interface DebugVisualFlags {
  showTurretGizmos?: boolean;
  showMuzzleFlashes?: boolean;
}

export const DEBUG_VISUALS: DebugVisualFlags = {
  showTurretGizmos: false,
  showMuzzleFlashes: true,
};

// Tunable per-hull shield visuals; values are conservative defaults.
export const SHIELD_VISUALS: Record<ShipHull, ShieldVisualSettings> = {
  fighter: { margin: 1.01, hexScale: 60, edgeWidth: 0.03, maxAlpha: 0.3, materialKind: 'hex' },
  corvette: { margin: 1.01, hexScale: 60, edgeWidth: 0.03, maxAlpha: 0.3, materialKind: 'hex' },
  frigate: { margin: 1.01, hexScale: 60, edgeWidth: 0.03, maxAlpha: 0.3, materialKind: 'hex' },
  destroyer: { margin: 1.01, hexScale: 60, edgeWidth: 0.03, maxAlpha: 0.3, materialKind: 'hex' },
  carrier: { margin: 1.01, hexScale: 60, edgeWidth: 0.03, maxAlpha: 0.3, materialKind: 'hex' },
};

const DEFAULTS: Required<ShieldVisualSettings> = {
  margin: 1.12,
  hexScale: 12,
  edgeWidth: 0.1,
  maxAlpha: 0.5,
  materialKind: 'hex',
  transmission: {
    thickness: 0.6,
    chromaticAberration: 0.02,
    anisotropicBlur: 0.1,
    distortion: 0.1,
    distortionScale: 0.4,
    temporalDistortion: 0.1,
    attenuationDistance: 0.6,
    roughness: 0.1,
    clearcoat: 0.0,
    ior: 1.2,
  },
};

export function getShieldVisuals(hull: ShipHull): Required<ShieldVisualSettings> {
  const cfg = SHIELD_VISUALS[hull] ?? {};
  return {
    margin: cfg.margin ?? DEFAULTS.margin,
    hexScale: cfg.hexScale ?? DEFAULTS.hexScale,
    edgeWidth: cfg.edgeWidth ?? DEFAULTS.edgeWidth,
    maxAlpha: cfg.maxAlpha ?? DEFAULTS.maxAlpha,
    materialKind: cfg.materialKind ?? DEFAULTS.materialKind,
    transmission: {
      thickness: cfg.transmission?.thickness ?? DEFAULTS.transmission.thickness,
      chromaticAberration:
        cfg.transmission?.chromaticAberration ?? DEFAULTS.transmission.chromaticAberration,
      anisotropicBlur: cfg.transmission?.anisotropicBlur ?? DEFAULTS.transmission.anisotropicBlur,
      distortion: cfg.transmission?.distortion ?? DEFAULTS.transmission.distortion,
      distortionScale: cfg.transmission?.distortionScale ?? DEFAULTS.transmission.distortionScale,
      temporalDistortion:
        cfg.transmission?.temporalDistortion ?? DEFAULTS.transmission.temporalDistortion,
      attenuationDistance:
        cfg.transmission?.attenuationDistance ?? DEFAULTS.transmission.attenuationDistance,
      roughness: cfg.transmission?.roughness ?? DEFAULTS.transmission.roughness,
      clearcoat: cfg.transmission?.clearcoat ?? DEFAULTS.transmission.clearcoat,
      ior: cfg.transmission?.ior ?? DEFAULTS.transmission.ior,
    },
  };
}

// Convenience helper to globally override all hulls if needed in the future
export function setGlobalShieldMaterial(kind: ShieldMaterialKind): void {
  (Object.keys(SHIELD_VISUALS) as ShipHull[]).forEach((h) => {
    SHIELD_VISUALS[h] = { ...(SHIELD_VISUALS[h] ?? {}), materialKind: kind };
  });
}

// Tunable global shield appearance parameters (not per-hull). These are
// intended to be safe, small adjustments for visual clarity (e.g., red-team
// boost) and can be tweaked during development.
export interface ShieldTuning {
  enableRedBoost: boolean;
  redBoostPower: number;
  redBoostMultiplier: number;
  redTint: string; // hex color used for red team tint
  /** Multiplier for base alpha along hex edges (0..1+). */
  edgeAlphaMul: number;
  /** Multiplier for base alpha inside hex fill (0..1). */
  fillAlphaMul: number;
  /** Minimal fraction of uOpacity*uMaxAlpha to ensure the shield remains visible. */
  minAlphaFloor: number;
  /** Interior color tint multiplier so fill isn't pitch black. */
  fillTintMul: number;
}

export const SHIELD_TUNING: ShieldTuning = {
  enableRedBoost: true,
  redBoostPower: 1.32,
  redBoostMultiplier: 1.45,
  redTint: '#b22222',
  edgeAlphaMul: 1.2,
  fillAlphaMul: 0.35,
  minAlphaFloor: 0.22,
  fillTintMul: 0.8,
};

// Team color constants used across renderer and placeholder models.
// Designers can change these to alter the visual identity of teams.
export const TEAM_COLORS = {
  blue: '#77aaff',
  red: '#ff7788',
} as const;

// Hull tinting when shields are gone: designers can tune how strong the
// tint is and at what shield fraction it should appear.
export interface HullTintConfig {
  /** Fraction (0..1) under which the hull gets a subtle team-tint. */
  tintThreshold: number;
  /** How strongly to blend original hull color toward team color (0..1). */
  tintStrength: number;
}

/**
 * HULL_TINT — Designer guidance
 *
 * - tintThreshold: fraction in [0..1] under which the hull will receive a
 *   subtle team tint. Values near 0.0 mean tint only when shields are fully
 *   depleted; values like 0.1 will tint when shields are low but not empty.
 *
 * - tintStrength: blend amount in [0..1]. 0.0 = no tint; 1.0 = completely
 *   replace hull color with team color. Recommended range: 0.08..0.25. Typical
 *   defaults used here (0.02 threshold, 0.15 strength) produce a light, readable
 *   tint that keeps artist colors intact while making team affiliation clear.
 *
 * Examples:
 * - (threshold=0.02, strength=0.10) => very subtle tint only when shield is gone
 * - (threshold=0.10, strength=0.20) => noticeable tint when shields are low
 * - (threshold=0.0, strength=0.30)  => tint only at exact zero but stronger
 */
export const HULL_TINT: HullTintConfig = {
  tintThreshold: 1.00,
  tintStrength: 0.15,
};

// Global shield ripple tuning (tweakable). These affect the shader and how many
// ripples the renderer will blend simultaneously. Kept separate from per-hull
// visuals so designers can experiment without changing hull presets.
export interface ShieldRippleTuning {
  /** Maximum number of simultaneous ripples the shader will render. */
  maxRipples: number;
  /** Default ripple propagation speed (radians per second). */
  defaultSpeed: number;
  /** Base width used when computing per-impact ripple width. */
  baseWidth: number;
  /** Multiplier applied to impact amp when computing final shader amplitude. */
  ampScale: number;
  /** Time window in seconds to coalesce tiny rapid ripples into one (visual) event. */
  coalesceWindow?: number;
  /** Minimum scaled amplitude under which ripples are ignored for rendering. */
  minRenderAmp?: number;
  /** Blend mode for overlapping ripples: 0 = additive, 1 = perceptual (soft-clamp). */
  blendMode: 0 | 1;
  /** If true, ripple contribution can exceed per-hull maxAlpha for visibility. */
  ignoreMaxAlpha: boolean;
  /** Color multiplier for ripple tint when blending into base color. */
  colorMul: number;
  /** Strength scalar applied to ripple contribution when affecting alpha. */
  strength: number;
}

export const SHIELD_RIPPLE_TUNING: ShieldRippleTuning = {
  maxRipples: 6,
  defaultSpeed: 3.1,
  baseWidth: 0.14,
  ampScale: 4.9,
  coalesceWindow: 0.03,
  blendMode: 1,
  ignoreMaxAlpha: false,
  colorMul: 1.0,
  strength: 0.7,
  minRenderAmp: 0.008,
};
