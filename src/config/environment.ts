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

export interface StarDiskConfig {
  /** Billboard radius in world units; higher values make the sun larger on screen. */
  size?: number;
  /** Final alpha multiplier applied after shader calculations. */
  opacity?: number;
  /** Offsets the disk away from the light based on StarLight.distance (keeps parallax consistent). */
  distanceMultiplier?: number;
  /** Optional haze taper controls for rim falloff. */
  haze?: StarDiskHazeConfig;
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
    size: 12000,
    opacity: 1.0,
    distanceMultiplier: 1.0,
    haze: {
      taperStrength: 0.85,
      edgeFadeThreshold: 0.3,
      edgeExponent: 2.0,
    },
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
