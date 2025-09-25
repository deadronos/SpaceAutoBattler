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

export interface StarDiskPaletteColorOffsetConfig {
  /** Hue offset applied via `Color.offsetHSL` when generating derived palette colours. */
  hue?: number;
  /** Saturation offset applied to the derived palette colour. */
  saturation?: number;
  /** Lightness offset applied to the derived palette colour. */
  lightness?: number;
}

export interface StarDiskPaletteOffsetsConfig {
  /** Derived colour adjustments for the stellar core tint. */
  core?: StarDiskPaletteColorOffsetConfig;
  /** Derived colour adjustments for the bright rim around the core. */
  primary?: StarDiskPaletteColorOffsetConfig;
  /** Derived colour adjustments for the corona/wisps. */
  secondary?: StarDiskPaletteColorOffsetConfig;
}

export interface StarDiskShaderConfig {
  /** Bloom group label that determines which selective-bloom profile the disk emits into. */
  bloomGroup?: string;
  /** Multiplier applied to elapsed simulation seconds; higher values speed up every animated element. */
  timeMultiplier?: number;
  /** Controls the scale of broad, low-frequency wisps in the corona (set lower for chunky bands, higher for fine streaks). */
  coronaScale1?: number;
  /** Controls the scale of fine-detail filaments in the corona (raises frequency of the secondary noise octave). */
  coronaScale2?: number;
  /** Global multiplier for corona brightness before bloom, useful for dialing overall aggression of the glow. */
  coronaIntensity?: number;
  /** Exponent driving how quickly opacity falls off from the core into space (lower = softer edge, higher = sharper rim). */
  coronaFalloff?: number;
  /** Multiplies the radial noise coordinate, stretching or compressing corona distortions along the star radius. */
  noiseScale?: number;
  /** Adjusts the hue balance for generated palette colours: negative cools, positive warms the corona. */
  colorShift?: number;
  /** Explicit overrides for the core/rim/corona palette; leave undefined to derive from the star light colour. */
  colorCore?: string;
  colorPrimary?: string;
  colorSecondary?: string;
  /** Blend strength applied when sampling the baked organic texture detail (0 = ignore texture, 1 = full filament influence). */
  textureMix?: number;
  /** Flicker amplitude contributed by the RGBA noise texture alpha channel (adds pulsation to the corona). */
  textureFlicker?: number;
  /** Scales the brightness of the luminous star core. */
  coreStrength?: number;
  /** Boosts the bright rim and filament contributions wrapped around the core. */
  rimStrength?: number;
  /** Multiplies the long-form corona wisps imparted by the noise octaves. */
  coronaStrength?: number;
  /** Adjusts the soft halo that extends beyond the corona. */
  outerGlowStrength?: number;
  /** Overall alpha multiplier to make the disk denser or more transparent without changing colour. */
  alphaStrength?: number;
  /** Blend factor between primary and secondary palette colours when tinting the corona (0 = primary, 1 = secondary). */
  coronaColorBlend?: number;
  /** Multiplies angular tiling for the organic texture, increasing or decreasing filament repetition. */
  organicTiling?: number;
  /** Scales scroll speed of the organic texture along the angular axis. */
  organicScrollSpeed?: number;
  /** Multiplies angular and radial tiling for the RGBA noise texture. */
  noiseTiling?: number;
  /** Scales scroll speed of the RGBA noise texture. */
  noiseScrollSpeed?: number;
  /** Scales the secondary drift applied to the noise texture lookup (adds subtle shimmering). */
  noiseDriftSpeed?: number;
  /** Optional palette offsets for derived colours when explicit overrides are omitted. */
  paletteOffsets?: StarDiskPaletteOffsetsConfig;
}

export interface CelestialEnvironmentConfig {
  planets: PlanetBodyConfig[];
  starLight: StarLightConfig;
  /** Optional skysphere configuration for 360-degree background */
  skysphere?: SkysphereConfig;
  /** Optional star disk appearance settings (size in world units, opacity, and distance multiplier) */
  starDisk?: {
    size?: number;
    opacity?: number;
    /** Multiplier applied to starLight.distance to compute disk offset */
    distanceMultiplier?: number;
    shader?: StarDiskShaderConfig;
  };
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
    direction: { x: -0.2516, y: -0.1509, z: -0.956 },
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
    size: 12000, // Billboard radius in world units; higher values make the sun larger on screen.
    opacity: 1.0, // Final alpha multiplier applied after shader calculations.
    distanceMultiplier: 1.0, // Offsets the disk away from the light based on StarLight.distance (keeps parallax consistent).
    shader: {
      bloomGroup: 'star', // Register in the dedicated bloom group for tailored thresholds.
      timeMultiplier: 1.0, // Master speed control for all animated noise and texture scrolling.
      coronaScale1: 15, // Sets size of broad wisps; lower = chunky bands, higher = thinner streaks.
      coronaScale2: 45, // Controls high-frequency detail layered on top of the broad wisps.
      coronaIntensity: 1.52, // Overall brightness of corona energy before bloom post-processing.
      coronaFalloff: 1.85, // Drives how quickly opacity fades from core to rim; higher tightens the edge.
      noiseScale: 0.85, // Stretches corona distortion along the radius for a slightly elongated look.
      colorShift: 0.5, // Warms the palette derived from the star light colour.
      textureMix: 1, // Blend strength for the baked organic texture filaments.
      textureFlicker: 0.92, // Flicker amplitude sourced from noise texture alpha for lively breathing.
      coreStrength: 1.08, // Boost the inner stellar core to remain brighter than the corona.
      rimStrength: 1.1, // Emphasise the bright ring wrapping the core and filament overlays.
      coronaStrength: 1.0, // Leave overall corona brightness near neutral.
      outerGlowStrength: 1.0, // Default halo contribution around the star.
      alphaStrength: 1.0, // Keep transparency at baseline (use <1 for subtler disk, >1 for denser).
      coronaColorBlend: 0.68, // Lean corona tint slightly toward the secondary palette colour.
      organicTiling: 1.0, // Use default filament repetition frequency.
      organicScrollSpeed: 1.0, // Baseline drift speed for organic texture.
      noiseTiling: 1.0, // Leave RGBA noise frequency at authored value.
      noiseScrollSpeed: 1.0, // Baseline drift speed for RGBA noise.
      noiseDriftSpeed: 1.0, // Baseline secondary shimmer for the RGBA noise sample.
      paletteOffsets: {
        core: { hue: 0.01, saturation: 0.22, lightness: 0.06 }, // Core tint skew relative to star light colour.
        primary: { hue: 0.015, saturation: 0.18, lightness: -0.06 }, // Rim tint skew for contrast around the core.
        secondary: { hue: 0.03, saturation: 0.32, lightness: -0.22 }, // Corona tint skew for hotter wisps.
      },
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
