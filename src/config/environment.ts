import type { PlanetTextureKey } from '../assets/planets.js';

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

export interface CelestialEnvironmentConfig {
  planets: PlanetBodyConfig[];
  starLight: StarLightConfig;
}

export const CELESTIAL_ENVIRONMENT: CelestialEnvironmentConfig = {
  starLight: {
    color: '#ffd8b0',
    intensity: 1.2,
    direction: { x: -0.2516, y: -0.1509, z: -0.956 },
    distance: 5000,
    ambientColor: '#1b2240',
    ambientIntensity: 0.55,
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
      emissiveBoost: 0.075,
      rimStrength: 0.3,
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
      emissiveBoost: 0.03,
      rimStrength: 0.2,
    },
  ],
};

export const PLANET_GEOMETRY_SEGMENTS = {
  width: 64,
  height: 32,
} as const;
