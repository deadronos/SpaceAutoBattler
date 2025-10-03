import type { PlanetTextureKey } from '../assets/planets.js';
import type { SkyspherTextureKey } from '../assets/skysphere.js';

export interface PlanetBodyConfig {
  id: string;
  textureKey: PlanetTextureKey;
  /** Sphere radius in world units. */
  radius: number;
  /** Planet position in world coordinates. */
  position: { x: number; y: number; z: number };
  /** Optional axial tilt (Euler radians) applied before rotation. */
  tilt?: { x: number; y: number; z: number };
  /** Optional self-rotation definition; time-driven for determinism. */
  rotation?: {
    /** Normalized axis to rotate around. */
    axis: { x: number; y: number; z: number };
    /** Angular speed in radians per simulated second. */
    speed: number;
    /** Initial offset angle in radians (applied at t=0). */
    offset?: number;
  };
  /** Optional emissive boost multiplier derived from texture average. */
  emissiveBoost?: number;
  /** Optional rim-light strength scalar when shader enhancement is enabled. */
  rimStrength?: number;
  /** Optional rim glow color for fresnel effect. */
  rimColor?: string;
  /** Optional ring system configuration. */
  rings?: {
    innerRadius: number;
    outerRadius: number;
    color?: string;
    opacity?: number;
    rotationSpeed?: number;
    /** Brightness multiplier applied to the ring base color (artist tweak). */
    brightness?: number;
    /** Fresnel highlight strength to control view-dependent rim brightness. */
    fresnelStrength?: number;
    /** Optional tint color to bias the ring toward a specific hue (e.g., blue-white). */
    tintColor?: string;
    /** Optional tint mix factor (0..1). If unspecified, the renderer will pick a conservative default when postprocessing is off. */
    tintMix?: number;
    /** If true, this ring should be rendered only via bloom (artist opt-in). When set the renderer/bloom manager will be allowed to use bloom-only routing for the material. */
    bloomOnly?: boolean;
    /** Procedural banding frequency (controls number of visible narrow bands). Higher = more bands. */
    bandFrequency?: number;
    /** Strength of banding contrast (0..1). */
    bandStrength?: number;
    /** Scale used for subtle positional jitter/irregularity of bands. */
    bandNoiseScale?: number;
    /** How much darker bands are compared to base (0..1). */
    bandDarkness?: number;
    /** Strength of planet shadowing on the ring (0=no shadow, 1=full shadow). */
    shadowStrength?: number;
    /** Soft penumbra size as a fraction of planet radius (0..1). Controls how wide the soft shadow edge is. */
    penumbra?: number;
  };
}

export interface StarLightConfig {
  /** Hex color string applied to the key directional light. */
  color: string;
  /** Light intensity (Three.js units). */
  intensity: number;
  /** Normalized direction vector pointing from origin toward the light. */
  direction: { x: number; y: number; z: number };
  /** Distance multiplier for placing the light from origin along -direction. */
  distance: number;
  /** Optional ambient fill color for low-frequency sky lighting. */
  ambientColor?: string;
  /** Optional ambient intensity multiplier. */
  ambientIntensity?: number;
}

export interface SkysphereConfig {
  /** Texture key for the skysphere background */
  textureKey: SkyspherTextureKey;
  /** Radius of the skysphere in world units */
  radius?: number;
  /** Overall opacity of the skysphere */
  opacity?: number;
}

export interface StarDiskHazeConfig {
  /** Strength of the haze taper (0 disables taper, 1 removes rim haze entirely). */
  taperStrength?: number;
  /** Facing cosine threshold below which the haze begins to fade out. */
  edgeFadeThreshold?: number;
  /** Exponent applied to the smoothstep controlling how aggressively the haze collapses. */
  edgeExponent?: number;
}

export interface StarDiskBoundaryConfig {
  /** Normalized radius (0-1) where boundary feathering begins. */
  featherStart?: number;
  /** Exponent controlling falloff steepness near the rim. */
  featherExponent?: number;
  /** Minimum alpha multiplier preserved at the rim. */
  alphaFloor?: number;
}

export interface StarDiskConfig {
  /** Billboard radius in world units; higher values make the sun larger on screen. */
  size?: number;
  /** Final alpha multiplier applied after shader calculations. */
  opacity?: number;
  /** Offsets the disk away from the light based on StarLight.distance (keeps parallax consistent). */
  distanceMultiplier?: number;
  /** Optional haze taper controls for rim falloff. */
  haze?: StarDiskHazeConfig;
  /** Optional boundary feather configuration for alpha roll-off. */
  boundary?: StarDiskBoundaryConfig;
  /** Normalized (0..1) radius to define an opaque core for depth pre-pass. */
  depthCoreRadius?: number;
}

export interface CelestialEnvironmentConfig {
  planets: PlanetBodyConfig[];
  starLight: StarLightConfig;
  /** Optional skysphere configuration for 360-degree background */
  skysphere?: SkysphereConfig;
  /** Optional star disk appearance settings (size in world units, opacity, and distance multiplier) */
  starDisk?: StarDiskConfig;
  /** Optional parallax billboards for distant objects */
  parallaxBillboards?: Array<{
    id: string;
    position: [number, number, number];
    size: number;
    color?: string;
    opacity?: number;
    parallaxFactor?: number;
  }>;
  /** Feature toggles for safe enable/disable */
  features?: {
    skysphere?: boolean;
    starDisk?: boolean;
    planetRims?: boolean;
    planetRings?: boolean;
    parallaxBillboards?: boolean;
  };
}

export const CELESTIAL_ENVIRONMENT: CelestialEnvironmentConfig = {
  starLight: {
    color: '#ffd27a',
    intensity: 1.2,
    direction: { x: 0.2516, y: 0.1509, z: 0.956 },
    distance: 30000,
    ambientColor: '#1b2240',
    ambientIntensity: 0.55,
  },
  skysphere: {
    textureKey: 'richBlueNebulae',
    radius: 45000, // Larger than star light distance to ensure it's behind everything
    opacity: 1.0,
  },
  planets: [
    {
      id: 'gasGiantPrime',
      textureKey: 'gasGiant12',
      radius: 1800,
      position: { x: -3200, y: 380, z: -5600 },
      tilt: { x: 0.1, y: 0.35, z: 0 },
      rotation: {
        axis: { x: 0, y: 1, z: 0 },
        speed: 0.012,
        offset: 0.6,
      },
      emissiveBoost: 0.005,
      rimStrength: 0.3,
      rimColor: '#ffaa44',
      rings: {
        innerRadius: 2200,
        outerRadius: 3800,
        color: '#ccaa88',
        opacity: 0.4,
        rotationSpeed: 0.001,
        // Artist-tweakable appearance values for icy, reflective-looking rings
        brightness: 1.8,
        fresnelStrength: 1.6,
        // Tuned tint so rings remain visible when postprocessing is off
        tintColor: '#d9efff',
        tintMix: 0.9,
        // By default keep rings visible (not bloom-only); artists can opt-in to bloomOnly.
        bloomOnly: false,
        // Procedural banding and shadowing defaults tuned for an icy gas-giant look
        bandFrequency: 220.0,
        bandStrength: 0.65,
        bandNoiseScale: 0.7,
        bandDarkness: 0.6,
        shadowStrength: 0.7,
        // Penumbra size as fraction of planet radius (e.g., 0.03 => ~3% of radius)
        penumbra: 0.04,
      },
    },
    {
      id: 'iceCompanion',
      textureKey: 'icePlanet1',
      radius: 620,
      position: { x: 4200, y: -540, z: -4300 },
      tilt: { x: 0.22, y: -0.15, z: 0 },
      rotation: {
        axis: { x: 0, y: 1, z: 0 },
        speed: 0.008,
        offset: -0.4,
      },
      emissiveBoost: 0.0005,
      rimStrength: 0.2,
      rimColor: '#aaccff',
    },
  ],
  parallaxBillboards: [
    {
      id: 'distantStar1',
      position: [8000, 2000, -12000],
      size: 600,
      color: '#ffddaa', 
      opacity: 0.3,
      parallaxFactor: 0.05,
    },
    {
      id: 'distantNebula',
      position: [-6000, -1000, -15000],
      size: 1200,
      color: '#6688dd',
      opacity: 0.2,
      parallaxFactor: 0.03,
    },
  ],
  // Default star disk settings — tune here to change size/opacity/position globally
  starDisk: {
    size: 30000,
    opacity: 0.9,
    distanceMultiplier: 1.0,
    haze: {
      taperStrength: 0.85,
      edgeFadeThreshold: 0.3,
      edgeExponent: 2.0,
    },
    boundary: {
      featherStart: 0.88,
      featherExponent: 2.4,
      alphaFloor: 0.02,
    },
    // Normalized radius for the opaque core used for depth occlusion. A
    // conservative default derived from boundary.featherStart ensures the
    // depth pass hides the star's interior while preserving the halo.
    depthCoreRadius: 0.76,
  },
  features: {
    skysphere: true,
    starDisk: true,
    planetRims: true,
    planetRings: true,
    parallaxBillboards: false,
  },
};

export const PLANET_GEOMETRY_SEGMENTS = {
  width: 64,
  height: 32,
} as const;
