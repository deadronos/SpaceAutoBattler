import type { MotionStats, ShipHull } from '../types/index.js';

export interface RendererMotionConfig {
  /** Linear interpolation factor applied every render frame (0..1). */
  positionLerp: number;
  /** Spherical interpolation factor for rotation (0..1). */
  rotationSlerp: number;
  /** Low-pass filter factor for banking (0..1). */
  bankLerp: number;
  /** Maximum bank angle allowed for visuals (degrees). */
  maxBankDeg: number;
  /** Conversion factor from yaw rate (rad/s) to bank degrees. */
  bankFactor: number;
  /** Distance threshold (units) that resets interpolation to avoid trails. */
  teleportDistance: number;
  /** Thruster emissive intensity range scaled by throttle input. */
  thrusterIntensity: { base: number; range: number };
}

export const RENDERER_MOTION_DEFAULTS: RendererMotionConfig = {
  positionLerp: 0.18,
  rotationSlerp: 0.25,
  bankLerp: 0.15,
  maxBankDeg: 32,
  bankFactor: 18,
  teleportDistance: 30,
  thrusterIntensity: { base: 0.4, range: 1.2 },
};

export function resolveRendererMotionConfig(motion?: MotionStats): RendererMotionConfig {
  const smoothing = motion?.smoothing;
  return {
    positionLerp: smoothing?.positionLerp ?? RENDERER_MOTION_DEFAULTS.positionLerp,
    rotationSlerp: smoothing?.rotationSlerp ?? RENDERER_MOTION_DEFAULTS.rotationSlerp,
    bankLerp: smoothing?.bankLerp ?? RENDERER_MOTION_DEFAULTS.bankLerp,
    maxBankDeg: motion?.maxBankDeg ?? RENDERER_MOTION_DEFAULTS.maxBankDeg,
    bankFactor: motion?.visualBankFactor ?? RENDERER_MOTION_DEFAULTS.bankFactor,
    teleportDistance: smoothing?.teleportDistance ?? RENDERER_MOTION_DEFAULTS.teleportDistance,
    thrusterIntensity: RENDERER_MOTION_DEFAULTS.thrusterIntensity,
  };
}

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

// Debug visuals flag removed — use explicit runtime toggles or config if needed

// Tunable per-hull shield visuals; values are conservative defaults.
export const SHIELD_VISUALS: Record<ShipHull, ShieldVisualSettings> = {
  // Default hulls inherit shieldScale from DEFAULTS; override per hull if desired
  fighter: { margin: 1.01, hexScale: 60, edgeWidth: 0.3, maxAlpha: 0.7, materialKind: 'hex' },
  corvette: { margin: 1.01, hexScale: 60, edgeWidth: 0.3, maxAlpha: 0.7, materialKind: 'hex' },
  frigate: { margin: 1.01, hexScale: 60, edgeWidth: 0.3, maxAlpha: 0.7, materialKind: 'hex' },
  destroyer: { margin: 1.01, hexScale: 60, edgeWidth: 0.3, maxAlpha: 0.7, materialKind: 'hex' },
  carrier: { margin: 1.01, hexScale: 60, edgeWidth: 0.3, maxAlpha: 0.7, materialKind: 'hex' },
};

const DEFAULTS: Required<ShieldVisualSettings> = {
  margin: 1.12,
  hexScale: 12,
  edgeWidth: 0.1,
  maxAlpha: 0.5,
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

export function getShieldVisuals(hull: ShipHull): Required<ShieldVisualSettings> {
  const cfg = SHIELD_VISUALS[hull] ?? {};
  return {
    margin: cfg.margin ?? DEFAULTS.margin,
    hexScale: cfg.hexScale ?? DEFAULTS.hexScale,
    edgeWidth: cfg.edgeWidth ?? DEFAULTS.edgeWidth,
    maxAlpha: cfg.maxAlpha ?? DEFAULTS.maxAlpha,
    shieldScale: cfg.shieldScale ?? DEFAULTS.shieldScale,
    materialKind: cfg.materialKind ?? DEFAULTS.materialKind,
    meshtransmission: {
      thickness: cfg.meshtransmission?.thickness ?? DEFAULTS.meshtransmission.thickness,
      chromaticAberration:
        cfg.meshtransmission?.chromaticAberration ?? DEFAULTS.meshtransmission.chromaticAberration,
      anisotropicBlur: cfg.meshtransmission?.anisotropicBlur ?? DEFAULTS.meshtransmission.anisotropicBlur,
      distortion: cfg.meshtransmission?.distortion ?? DEFAULTS.meshtransmission.distortion,
      distortionScale: cfg.meshtransmission?.distortionScale ?? DEFAULTS.meshtransmission.distortionScale,
      temporalDistortion:
        cfg.meshtransmission?.temporalDistortion ?? DEFAULTS.meshtransmission.temporalDistortion,
      attenuationDistance:
        cfg.meshtransmission?.attenuationDistance ?? DEFAULTS.meshtransmission.attenuationDistance,
      roughness: cfg.meshtransmission?.roughness ?? DEFAULTS.meshtransmission.roughness,
      clearcoat: cfg.meshtransmission?.clearcoat ?? DEFAULTS.meshtransmission.clearcoat,
      ior: cfg.meshtransmission?.ior ?? DEFAULTS.meshtransmission.ior,
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
  fillTintMul: 0.9,
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
  tintStrength: 0.35,
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
}

export const SHIELD_RIPPLE_TUNING: ShieldRippleTuning = {
  maxRipples: 8,
  defaultSpeed: 3.1,
  baseWidth: 0.10,
  ampScale: 3.9,
  coalesceWindow: 0.03,
  rippleLife: 0.9,
  blendMode: 1,
  ignoreMaxAlpha: false,
  colorMul: 0.5,
  strength: 0.7,
  minRenderAmp: 0.001,
};

// Thruster glow configuration for fallback anchors and default materials
export interface ThrusterGlowConfig {
  /** Default emissive color when material emissive is black or very dark */
  defaultEmissiveColor: string;
  /** Minimum emissive luminance threshold below which we use default color */
  darkEmissiveThreshold: number;
  /** Size of fallback glow meshes relative to model bounding box */
  glowMeshSize: number;
  /** Offset distance behind tail plane for glow mesh placement */
  tailOffset: number;
  /** Anchor count per hull type for fallback positioning */
  anchorsByHull: Record<ShipHull, number>;
}

export const THRUSTER_GLOW_CONFIG: ThrusterGlowConfig = {
  defaultEmissiveColor: '#5fb6ff',
  darkEmissiveThreshold: 0.9,
  glowMeshSize: 0.02,
  tailOffset: 0.01,
  anchorsByHull: {
    fighter: 1,
    corvette: 2,
    frigate: 2,
    destroyer: 4,
    carrier: 6,
  },
};

// Particle trails (engine exhaust) — renderer-only visual configuration.
// These settings do not affect simulation determinism and only control
// how the trail particles look and spawn on the client.
export interface ParticleTrailsConfig {
  /** Master enable for ParticleTrails component. If false, the component returns null. */
  enabled: boolean;
  /** Maximum number of particles kept in the pool (across all ships). */
  maxParticles: number;
  /** Base lifetime in seconds for a newly spawned particle. */
  lifetime: number;
  /** Base particle size in world units (before per-particle scale/jitter and life fading). */
  size: number;
  /** Base opacity for the particle material (actual opacity fades with life). */
  opacity: number;
  /** If true, use additive blending for brighter exhaust; if false, normal blending. */
  additiveBlending: boolean;
  /** Whether particle fragments participate in depth testing. Disable to ensure visibility. */
  depthTest: boolean;
  /** Whether particles write to depth buffer. Usually false for transparent effects. */
  depthWrite: boolean;
  /** Min throttle under which no particles are spawned. */
  minThrottle: number;
  /** Particles-per-second per anchor when throttle = 1.0. (Probabilistic spawner) */
  spawnRatePerAnchor: number;
  /** Engine exhaust base color (commonly matches thruster glow color). */
  color: string;
  /** Relative tail offset used by the trails' fallback anchors (heuristic length factor). */
  tailZFactor: number;
  /** Backward velocity along local -Z, as a scalar speed range (units/s). */
  backwardSpeed: { min: number; max: number };
  /** Lateral velocity jitter magnitude (units/s) applied in X and Y. */
  lateralJitter: number;
  /** Longitudinal jitter magnitude (units/s) applied along Z. */
  longitudinalJitter: number;
  /** Per-particle scale range multiplier around 1.0, e.g., 0.8..1.2 => ±20%. */
  scaleJitter: number;
}

export const PARTICLE_TRAILS_CONFIG: ParticleTrailsConfig = {
  enabled: true,
  maxParticles: 5000,
  lifetime: 0.9,
  size: 0.72,
  opacity: 0.75,
  additiveBlending: false,
  depthTest: true,
  depthWrite: false,
  minThrottle: 0.1,
  spawnRatePerAnchor: 12, // particles/sec at full throttle per anchor
  color: '#5fb6ff',
  tailZFactor: 0.45, // behind ship origin relative to heuristic length
  backwardSpeed: { min: 0.8, max: 1.6 },
  lateralJitter: 0.45,
  longitudinalJitter: 0.15,
  scaleJitter: 0.25,
};

// Postprocessing / bloom configuration exposed to the renderer.
export interface BloomGroupConfig {
  /** Optional override for bloom intensity for this group. */
  intensity?: number;
  /** Optional override for luminance threshold. */
  threshold?: number;
  /** Optional override for smoothing around the threshold. */
  smoothing?: number;
}

export interface PostprocessingConfig {
  /** Luminance threshold for bloom (higher = fewer pixels bloom) */
  bloomThreshold: number;
  /** Smoothing applied around the threshold (0..1) */
  bloomSmoothing: number;
  /** Global intensity multiplier for bloom effect */
  bloomIntensity: number;
  /** Whether the selective bloom pass should ignore the scene background color. */
  bloomIgnoreBackground: boolean;
  /** Default bloom group name used when components opt-in without explicit configuration. */
  bloomDefaultGroup: string;
  /** Starting render layer used when allocating `Selection` layers for bloom groups. */
  bloomLayerStart: number;
  /** Per-group configuration overrides for selective bloom. */
  bloomGroups: Record<string, BloomGroupConfig>;
}

export const POSTPROCESSING_CONFIG: PostprocessingConfig = {
  bloomThreshold: 0.1,
  bloomSmoothing: 0.001,
  bloomIntensity: 0.1,
  bloomIgnoreBackground: true,
  bloomDefaultGroup: 'default',
  bloomLayerStart: 11,
  bloomGroups: {
    default: {
      threshold: 1.0,
      intensity: 0.5,
    },
    engines: {
      intensity: 10.35,
      smoothing: 0.008,
      threshold: 0.9,
    },
    shields: {
      intensity: 0.7,
      smoothing: 0.02,
      threshold: 0.9,
    },
    projectiles: {
      intensity: 5.25,
      smoothing: 0.006,
      threshold: 0.9,
    },
    explosions: {
      intensity: 1.6,
      smoothing: 0.035,
      threshold: 1.0,
    },
    muzzleFlashes: {
      intensity: 10.4,
      smoothing: 0.01,
      threshold: 1.0,
    },
    star: {
      intensity: 1.6,
      smoothing: 0.01,
      threshold: 1.0,
    },
  },
};

