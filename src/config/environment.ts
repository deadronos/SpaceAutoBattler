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
  /** Exponent applied to radial texture sampling; lower than 1 pushes organic detail toward the outer disc. */
  textureRadialPower?: number;
  /** Exponent shaping how gently corona energy fades toward the rim (lower keeps the rim energised). */
  coronaEdgeSoftness?: number;
  /** Blends a tinted base fill tying the core and rim energy together across the disc. */
  baseFillStrength?: number;
  /** Radius below which the stellar core remains at full intensity (0–0.6). */
  coreRadiusInner?: number;
  /** Radius at which the stellar core fades out completely (must be > coreRadiusInner, ≤ 1). */
  coreRadiusOuter?: number;
  /** Exponent applied to the core intensity to create a white-hot hotspot (0.5–4). */
  coreTightness?: number;
  /** Exponent controlling the outer halo falloff shaping the surrounding glow (0.2–4). */
  haloFalloff?: number;
  /** Blend factor that pushes the hotspot toward pure white; lower values keep the core saturated (0–1). */
  coreHotspotMix?: number;
  /** Strength applied to organic texture detail inside the core (0–2). */
  coreDetailStrength?: number;
  /** Additional procedural noise gain layered over the core detail (0–2). */
  coreDetailNoise?: number;
  /** Multiplier applied to high-frequency corona filaments to emphasize swirling wisps (0–2.5). */
  coronaFilamentStrength?: number;
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
  /** Rotational swirl rate applied to organic/noise texture sampling for flame-like motion (0–2). */
  swirlRate?: number;
  /** Strength of low-frequency sector darkening to create flame-like patterns (0–2). */
  sectorDarkeningStrength?: number;
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
    size: 12000, // Billboard radius in world units; higher values make the sun larger on screen.
    opacity: 1.0, // Final alpha multiplier applied after shader calculations.
    distanceMultiplier: 1.0, // Offsets the disk away from the light based on StarLight.distance (keeps parallax consistent).
    shader: {
      bloomGroup: 'star', // Register in the dedicated bloom group for tailored thresholds.
      // Enhanced parameters for fiery star disk effect to meet acceptance criteria
      timeMultiplier: 1.0, // Master speed control for all animated noise and texture scrolling.
      coronaScale1: 20, // Increased for finer filament detail
      coronaScale2: 56, // Enhanced high-frequency detail
      coronaIntensity: 2.1, // Boosted overall corona brightness
      coronaFalloff: 0.95, // Slightly tighter opacity fade
      textureRadialPower: 0.48, // Enhanced outward bias for organic sampling
      coronaEdgeSoftness: 0.5, // Sharper corona edge for better contrast
      baseFillStrength: 0.15, // Reduced mid-disc fill for better core contrast
      coreRadiusInner: 0.16, // Tighter core for concentrated hotspot
      coreRadiusOuter: 0.48, // Sharper core falloff for luminance ratio
      coreTightness: 2.0, // More concentrated white-hot center
      haloFalloff: 1.1, // Tighter halo falloff to meet 35% criteria
      coreHotspotMix: 0.28, // Enhanced white-hot center for bloom
      coreDetailStrength: 0.95, // Enhanced organic texture detail in core
      coreDetailNoise: 0.75, // Increased procedural noise for variance
      coronaFilamentStrength: 1.1, // Boosted filament detail for variance
      noiseScale: 0.85, // Slightly compressed for better filament definition
      colorShift: 0.72, // Warmer palette for fiery effect
      textureMix: 0.95, // Near-full texture blend for maximum detail
      textureFlicker: 1.35, // Enhanced flicker for lively effect
      coreStrength: 2.2, // Boosted core brightness for luminance ratio
      rimStrength: 1.6, // Balanced rim brightness
      coronaStrength: 1.55, // Enhanced corona visibility
      outerGlowStrength: 1.9, // Controlled outer glow for halo criteria
      alphaStrength: 1.25, // Enhanced alpha for bloom pickup
      coronaColorBlend: 0.65, // Warmer corona tint
      organicTiling: 3.6, // Higher frequency filament detail
      organicScrollSpeed: 1.3, // Enhanced organic texture animation
      noiseTiling: 3.0, // Increased noise frequency for variance
      noiseScrollSpeed: 1.4, // Faster noise animation
      noiseDriftSpeed: 1.5, // Enhanced shimmer effect
      swirlRate: 0.4, // Moderate rotational swirl for flame-like motion  
      sectorDarkeningStrength: 0.2, // Subtle flame-like sector patterns
      paletteOffsets: {
        core: { hue: 0.018, saturation: 0.32, lightness: 0.18 }, // Core tint skew relative to star light colour.
        primary: { hue: 0.028, saturation: 0.3, lightness: -0.04 }, // Rim tint skew for contrast around the core.
        secondary: { hue: 0.052, saturation: 0.42, lightness: -0.28 }, // Corona tint skew for hotter wisps.
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
