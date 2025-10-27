import type { ShipHull } from '../types/index.js';

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

// Team color constants used across renderer and placeholder models.
export const TEAM_COLORS = {
  blue: '#8fc4ff',
  red: '#ff8193',
} as const;

// Hull tinting when shields are gone: designers can tune how strong the tint is and at what shield fraction it should appear.
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
  tintThreshold: 0.02,
  tintStrength: 0.35,
};

// Particle trails (engine exhaust) — renderer-only visual configuration.
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
