import type { ShipHull } from '../types/index.js';

export type ShieldMaterialKind = 'hex' | 'meshtransmission';

export interface ShieldVisualSettings {
  /** Multiplier applied to the model bounding-sphere radius. */
  margin?: number;
  /** Hex grid density used by the shield shader. */
  hexScale?: number;
  /** Edge width used by the shield shader. */
  edgeWidth?: number;
  /** Maximum final alpha for shield material (0..1). */
  maxAlpha?: number;
  /** Number of segments for the shield sphere geometry (width and height). Default 128. */
  geometrySegments?: number;
  /**
   * Per-axis non-uniform scale applied to the shield mesh. This enables
   * ellipsoidal shields where Y (height) is often smaller than X/Z.
   * Values are multipliers applied on top of the base radius.
   * Example: { x: 1, y: 0.65, z: 1 }
   */
  shieldScale?: { x: number; y: number; z: number };
  /** What material to use for the shield: custom hex shader or drei MeshTransmissionMaterial */
  materialKind?: ShieldMaterialKind;
  /** Optional params for MeshTransmissionMaterial when materialKind==='transmission' */
  meshtransmission?: {
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

// Tunable per-hull shield visuals; values are conservative defaults.
export const SHIELD_VISUALS: Record<ShipHull, ShieldVisualSettings> = {
  // Default hulls inherit shieldScale from SHIELD_VISUAL_DEFAULTS; override per hull if desired
  fighter: { margin: 1.1, hexScale: 80, edgeWidth: 0.26, maxAlpha: 0.6, materialKind: 'hex' },
  corvette: { margin: 1.1, hexScale: 80, edgeWidth: 0.26, maxAlpha: 0.6, materialKind: 'hex' },
  frigate: { margin: 1.12, hexScale: 80, edgeWidth: 0.26, maxAlpha: 0.6, materialKind: 'hex' },
  destroyer: { margin: 1.12, hexScale: 80, edgeWidth: 0.26, maxAlpha: 0.6, materialKind: 'hex' },
  carrier: { margin: 1.12, hexScale: 80, edgeWidth: 0.26, maxAlpha: 0.6, materialKind: 'hex' },
};

export const SHIELD_VISUAL_DEFAULTS: Required<ShieldVisualSettings> = {
  margin: 1.12,
  hexScale: 12,
  edgeWidth: 0.1,
  maxAlpha: 0.5,
  geometrySegments: 128,
  shieldScale: { x: 1, y: 0.65, z: 1 },
  materialKind: 'hex',
  meshtransmission: {
    thickness: 0.6,
    chromaticAberration: 0.02,
    anisotropicBlur: 0.1,
    distortion: 0.1,
    distortionScale: 0.3,
    temporalDistortion: 0.1,
    attenuationDistance: 0.6,
    roughness: 0.1,
    clearcoat: 0.5,
    ior: 1.2,
  },
};

/**
 * Resolves the visual settings for a ship's shield based on its hull type.
 * Applies defaults where specific configuration is missing.
 *
 * @param {ShipHull} hull - The hull type of the ship.
 * @returns {Required<ShieldVisualSettings>} The fully resolved shield configuration.
 */
export function getShieldVisuals(hull: ShipHull): Required<ShieldVisualSettings> {
  const cfg = SHIELD_VISUALS[hull] ?? {};
  const defaults = SHIELD_VISUAL_DEFAULTS;
  return {
    margin: cfg.margin ?? defaults.margin,
    hexScale: cfg.hexScale ?? defaults.hexScale,
    edgeWidth: cfg.edgeWidth ?? defaults.edgeWidth,
    maxAlpha: cfg.maxAlpha ?? defaults.maxAlpha,
    geometrySegments: cfg.geometrySegments ?? defaults.geometrySegments,
    shieldScale: cfg.shieldScale ?? defaults.shieldScale,
    materialKind: cfg.materialKind ?? defaults.materialKind,
    meshtransmission: {
      thickness: cfg.meshtransmission?.thickness ?? defaults.meshtransmission.thickness,
      chromaticAberration:
        cfg.meshtransmission?.chromaticAberration ?? defaults.meshtransmission.chromaticAberration,
      anisotropicBlur:
        cfg.meshtransmission?.anisotropicBlur ?? defaults.meshtransmission.anisotropicBlur,
      distortion: cfg.meshtransmission?.distortion ?? defaults.meshtransmission.distortion,
      distortionScale:
        cfg.meshtransmission?.distortionScale ?? defaults.meshtransmission.distortionScale,
      temporalDistortion:
        cfg.meshtransmission?.temporalDistortion ?? defaults.meshtransmission.temporalDistortion,
      attenuationDistance:
        cfg.meshtransmission?.attenuationDistance ?? defaults.meshtransmission.attenuationDistance,
      roughness: cfg.meshtransmission?.roughness ?? defaults.meshtransmission.roughness,
      clearcoat: cfg.meshtransmission?.clearcoat ?? defaults.meshtransmission.clearcoat,
      ior: cfg.meshtransmission?.ior ?? defaults.meshtransmission.ior,
    },
  };
}

/**
 * Sets the global material type for all shields.
 * Useful for debugging or performance tuning.
 *
 * @param {ShieldMaterialKind} kind - The material kind to use ('hex' or 'meshtransmission').
 */
export function setGlobalShieldMaterial(kind: ShieldMaterialKind): void {
  (Object.keys(SHIELD_VISUALS) as ShipHull[]).forEach((hull) => {
    SHIELD_VISUALS[hull] = { ...SHIELD_VISUALS[hull], materialKind: kind };
  });
}

// Tunable global shield appearance parameters (not per-hull).
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
  redTint: '#ba2b2b',
  edgeAlphaMul: 0.9,
  fillAlphaMul: 0.2,
  minAlphaFloor: 0.1,
  fillTintMul: 1.05,
};

// Global shield ripple tuning (tweakable).
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
  /** Approximate seconds a ripple occupies a shader slot before considered expired. */
  rippleLife?: number;
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
  /** Scale of vertex displacement for ripples. */
  displacementScale: number;
  /** Mix factor for ripple color (0=white, 1=team color). */
  tintMix: number;
}

export const SHIELD_RIPPLE_TUNING: ShieldRippleTuning = {
  maxRipples: 8,
  defaultSpeed: 3.1,
  baseWidth: 0.1,
  ampScale: 3.9,
  coalesceWindow: 0.03,
  rippleLife: 0.9,
  blendMode: 1,
  ignoreMaxAlpha: false,
  colorMul: 1.5,
  strength: 1.7,
  minRenderAmp: 0.001,
  displacementScale: 0.15,
  tintMix: 0.65,
};
