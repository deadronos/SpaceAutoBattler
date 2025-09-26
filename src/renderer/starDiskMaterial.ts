import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  LinearFilter,
  NearestFilter,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
} from 'three';
import fragmentShader from './shaders/starDisk.fragment.glsl';
import vertexShader from './shaders/starDisk.vertex.glsl';
import type {
  StarDiskShaderConfig,
  StarLightConfig,
  StarDiskPaletteOffsetsConfig,
  StarDiskPaletteColorOffsetConfig,
} from '../config/environment.js';
import { colorFromConfig } from '../utils/color.js';

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export interface StarDiskUniformValues {
  timeScale: number;
  brightness: number;
  radius: number;
  opacity: number;
  coronaScale1: number;
  coronaScale2: number;
  coronaIntensity: number;
  coronaFalloff: number;
  noiseScale: number;
  textureRadialPower: number;
  coronaEdgeSoftness: number;
  baseFillStrength: number;
  coreRadiusInner: number;
  coreRadiusOuter: number;
  coreTightness: number;
  haloFalloff: number;
  coreHotspotMix: number;
  coreDetailStrength: number;
  coreDetailNoise: number;
  coronaFilamentStrength: number;
  textureMix: number;
  textureFlicker: number;
  coreStrength: number;
  rimStrength: number;
  coronaStrength: number;
  outerGlowStrength: number;
  alphaStrength: number;
  coronaColorBlend: number;
  organicTiling: number;
  organicScrollSpeed: number;
  noiseTiling: number;
  noiseScrollSpeed: number;
  noiseDriftSpeed: number;
  swirlRate: number;
  sectorDarkeningStrength: number;
  colorCore: Color;
  colorPrimary: Color;
  colorSecondary: Color;
}

export interface StarDiskMaterialConfig {
  bloomGroup: string;
  uniforms: StarDiskUniformValues;
  textures: StarDiskTextures;
}

export interface BuildStarDiskMaterialOptions {
  light: StarLightConfig;
  opacity: number;
  shader?: StarDiskShaderConfig;
  textures?: Partial<StarDiskTextures>;
}

export interface StarDiskTextures {
  organic: Texture | null;
  noise: Texture | null;
}

type PaletteOffsets = {
  hue: number;
  saturation: number;
  lightness: number;
};

const DEFAULT_PALETTE_OFFSETS: Record<'core' | 'primary' | 'secondary', PaletteOffsets> = {
  core: { hue: 0.01, saturation: 0.22, lightness: 0.06 },
  primary: { hue: 0.015, saturation: 0.18, lightness: -0.06 },
  secondary: { hue: 0.03, saturation: 0.32, lightness: -0.22 },
};

const DEFAULTS = {
  bloomGroup: 'star',
  timeMultiplier: 1,
  coronaScale1: 18,
  coronaScale2: 52,
  coronaIntensity: 1.88,
  coronaFalloff: 0.92,
  noiseScale: 0.9,
  colorShift: 0.64,
  textureRadialPower: 0.52,
  coronaEdgeSoftness: 0.6,
  baseFillStrength: 0.18,
  coreRadiusInner: 0.18,
  coreRadiusOuter: 0.54,
  coreTightness: 1.6,
  haloFalloff: 0.92,
  coreHotspotMix: 0.24,
  coreDetailStrength: 0.82,
  coreDetailNoise: 0.66,
  coronaFilamentStrength: 0.92,
  textureMix: 0.9,
  textureFlicker: 1.24,
  coreStrength: 1.88,
  rimStrength: 1.72,
  coronaStrength: 1.46,
  outerGlowStrength: 2.18,
  alphaStrength: 1.18,
  coronaColorBlend: 0.6,
  organicTiling: 3.4,
  organicScrollSpeed: 1.24,
  noiseTiling: 2.8,
  noiseScrollSpeed: 1.32,
  noiseDriftSpeed: 1.42,
  swirlRate: 0.3,
  sectorDarkeningStrength: 0.15,
  paletteOffsets: DEFAULT_PALETTE_OFFSETS,
};

const FALLBACK_ORGANIC = (() => {
  const data = new Uint8Array([
    208, 142, 88, 255,
    104, 62, 36, 255,
    72, 44, 28, 255,
    248, 214, 162, 255,
  ]);
  const texture = new DataTexture(data, 2, 2, RGBAFormat, UnsignedByteType);
  texture.name = 'StarDiskOrganicFallback';
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
})();

const FALLBACK_NOISE = (() => {
  const data = new Uint8Array([
    64, 180, 220, 255,
    220, 120, 80, 255,
    160, 200, 96, 255,
    32, 80, 200, 255,
  ]);
  const texture = new DataTexture(data, 2, 2, RGBAFormat, UnsignedByteType);
  texture.name = 'StarDiskNoiseFallback';
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
})();

const resolveTexture = (texture: Texture | null | undefined, fallback: Texture): Texture => texture ?? fallback;

function resolveColor(hex: string | undefined, fallback: Color): Color {
  // Use colorFromConfig to produce a linear Color for shader math
  if (!hex) {
    return fallback.clone();
  }
  try {
    return colorFromConfig(hex);
  } catch {
    return fallback.clone();
  }
}

const clampPaletteOffset = (value: number | undefined, fallback: number): number => clamp(value ?? fallback, -1, 1);

function resolvePaletteOffsets(
  palette: StarDiskPaletteOffsetsConfig | undefined,
  key: 'core' | 'primary' | 'secondary',
  fallback: PaletteOffsets,
): PaletteOffsets {
  const target = (palette?.[key] ?? undefined) as StarDiskPaletteColorOffsetConfig | undefined;
  return {
    hue: clampPaletteOffset(target?.hue, fallback.hue),
    saturation: clampPaletteOffset(target?.saturation, fallback.saturation),
    lightness: clampPaletteOffset(target?.lightness, fallback.lightness),
  };
}

function buildColorPalette(base: Color, shader?: StarDiskShaderConfig): {
  core: Color;
  primary: Color;
  secondary: Color;
} {
  const shift = clamp(shader?.colorShift ?? DEFAULTS.colorShift, -1, 1);
  const baseClone = base.clone();

  const core = resolveColor(shader?.colorCore, baseClone);
  const primary = resolveColor(shader?.colorPrimary, baseClone);
  const secondary = resolveColor(shader?.colorSecondary, baseClone);
  const offsets = shader?.paletteOffsets;
  const coreOffsets = resolvePaletteOffsets(offsets, 'core', DEFAULT_PALETTE_OFFSETS.core);
  const primaryOffsets = resolvePaletteOffsets(offsets, 'primary', DEFAULT_PALETTE_OFFSETS.primary);
  const secondaryOffsets = resolvePaletteOffsets(offsets, 'secondary', DEFAULT_PALETTE_OFFSETS.secondary);

  if (!shader?.colorCore) {
    core.offsetHSL(coreOffsets.hue * shift, coreOffsets.saturation * shift, coreOffsets.lightness * shift);
  }
  if (!shader?.colorPrimary) {
    primary.offsetHSL(primaryOffsets.hue * shift, primaryOffsets.saturation * shift, primaryOffsets.lightness * shift);
  }
  if (!shader?.colorSecondary) {
    secondary.offsetHSL(secondaryOffsets.hue * shift, secondaryOffsets.saturation * shift, secondaryOffsets.lightness * shift);
  }

  return { core, primary, secondary };
}

export function buildStarDiskMaterialConfig(options: BuildStarDiskMaterialOptions): StarDiskMaterialConfig {
  const { light, opacity, shader } = options;
  const bloomGroupRaw = shader?.bloomGroup ?? DEFAULTS.bloomGroup;
  const bloomGroup = bloomGroupRaw.trim().length ? bloomGroupRaw.trim() : DEFAULTS.bloomGroup;
  const timeScale = clamp(shader?.timeMultiplier ?? DEFAULTS.timeMultiplier, 0, 64);
  const coronaScale1 = clamp(shader?.coronaScale1 ?? DEFAULTS.coronaScale1, 1, 256);
  const coronaScale2 = clamp(shader?.coronaScale2 ?? DEFAULTS.coronaScale2, 1, 512);
  const coronaIntensity = clamp(shader?.coronaIntensity ?? DEFAULTS.coronaIntensity, 0, 10);
  const coronaFalloff = clamp(shader?.coronaFalloff ?? DEFAULTS.coronaFalloff, 0.1, 8);
  const noiseScale = clamp(shader?.noiseScale ?? DEFAULTS.noiseScale, 0.1, 10);
  const textureRadialPower = clamp(shader?.textureRadialPower ?? DEFAULTS.textureRadialPower, 0.2, 2);
  const coronaEdgeSoftness = clamp(shader?.coronaEdgeSoftness ?? DEFAULTS.coronaEdgeSoftness, 0.2, 3);
  const baseFillStrength = clamp(shader?.baseFillStrength ?? DEFAULTS.baseFillStrength, 0, 1);
  const coreRadiusInner = clamp(shader?.coreRadiusInner ?? DEFAULTS.coreRadiusInner, 0, 0.6);
  const coreRadiusOuterRaw = clamp(shader?.coreRadiusOuter ?? DEFAULTS.coreRadiusOuter, 0.05, 1);
  const coreRadiusOuter = Math.max(coreRadiusOuterRaw, coreRadiusInner + 0.05);
  const coreTightness = clamp(shader?.coreTightness ?? DEFAULTS.coreTightness, 0.5, 4);
  const haloFalloff = clamp(shader?.haloFalloff ?? DEFAULTS.haloFalloff, 0.2, 4);
  const coreHotspotMix = clamp(shader?.coreHotspotMix ?? DEFAULTS.coreHotspotMix, 0, 1);
  const coreDetailStrength = clamp(shader?.coreDetailStrength ?? DEFAULTS.coreDetailStrength, 0, 2);
  const coreDetailNoise = clamp(shader?.coreDetailNoise ?? DEFAULTS.coreDetailNoise, 0, 2);
  const coronaFilamentStrength = clamp(shader?.coronaFilamentStrength ?? DEFAULTS.coronaFilamentStrength, 0, 2.5);
  const textureMix = clamp(shader?.textureMix ?? DEFAULTS.textureMix, 0, 1);
  const textureFlicker = clamp(shader?.textureFlicker ?? DEFAULTS.textureFlicker, 0, 2);
  const coreStrength = clamp(shader?.coreStrength ?? DEFAULTS.coreStrength, 0, 4);
  const rimStrength = clamp(shader?.rimStrength ?? DEFAULTS.rimStrength, 0, 4);
  const coronaStrength = clamp(shader?.coronaStrength ?? DEFAULTS.coronaStrength, 0, 4);
  const outerGlowStrength = clamp(shader?.outerGlowStrength ?? DEFAULTS.outerGlowStrength, 0, 4);
  const alphaStrength = clamp(shader?.alphaStrength ?? DEFAULTS.alphaStrength, 0, 3);
  const coronaColorBlend = clamp(shader?.coronaColorBlend ?? DEFAULTS.coronaColorBlend, 0, 1);
  const organicTiling = clamp(shader?.organicTiling ?? DEFAULTS.organicTiling, 0.25, 4);
  const organicScrollSpeed = clamp(shader?.organicScrollSpeed ?? DEFAULTS.organicScrollSpeed, 0, 5);
  const noiseTiling = clamp(shader?.noiseTiling ?? DEFAULTS.noiseTiling, 0.25, 4);
  const noiseScrollSpeed = clamp(shader?.noiseScrollSpeed ?? DEFAULTS.noiseScrollSpeed, 0, 5);
  const noiseDriftSpeed = clamp(shader?.noiseDriftSpeed ?? DEFAULTS.noiseDriftSpeed, 0, 5);
  const swirlRate = clamp(shader?.swirlRate ?? DEFAULTS.swirlRate, 0, 2);
  const sectorDarkeningStrength = clamp(shader?.sectorDarkeningStrength ?? DEFAULTS.sectorDarkeningStrength, 0, 2);
  const brightness = clamp((light.intensity ?? 1) / 1.6, 0, 3);
  // Use the central helper so base color is produced in linear space for shader math
  const baseColor = colorFromConfig(light.color ?? '#ffffff');
  const { core, primary, secondary } = buildColorPalette(baseColor, shader);

  return {
    bloomGroup,
    uniforms: {
      timeScale,
      brightness,
      radius: 1,
      opacity: clamp(opacity, 0, 1),
      coronaScale1,
      coronaScale2,
      coronaIntensity,
      coronaFalloff,
      noiseScale,
      textureRadialPower,
      coronaEdgeSoftness,
      baseFillStrength,
      coreRadiusInner,
      coreRadiusOuter,
      coreTightness,
      haloFalloff,
  coreHotspotMix,
  coreDetailStrength,
  coreDetailNoise,
  coronaFilamentStrength,
      textureMix,
      textureFlicker,
      coreStrength,
      rimStrength,
      coronaStrength,
      outerGlowStrength,
      alphaStrength,
      coronaColorBlend,
      organicTiling,
      organicScrollSpeed,
      noiseTiling,
      noiseScrollSpeed,
      noiseDriftSpeed,
      swirlRate,
      sectorDarkeningStrength,
      colorCore: core,
      colorPrimary: primary,
      colorSecondary: secondary,
    },
    textures: {
      organic: options.textures?.organic ?? null,
      noise: options.textures?.noise ?? null,
    },
  };
}

export interface CreateStarDiskMaterialResult {
  material: ShaderMaterial;
}

export function createStarDiskMaterial(values: StarDiskUniformValues, textures: StarDiskTextures): ShaderMaterial {
  const organicTexture = resolveTexture(textures.organic, FALLBACK_ORGANIC);
  const noiseTexture = resolveTexture(textures.noise, FALLBACK_NOISE);
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uTimeScale: { value: values.timeScale },
      uBrightness: { value: values.brightness },
      uRadius: { value: values.radius },
      uAspectInv: { value: 1 },
      uOpacity: { value: values.opacity },
      uCoronaScale1: { value: values.coronaScale1 },
      uCoronaScale2: { value: values.coronaScale2 },
      uCoronaIntensity: { value: values.coronaIntensity },
      uCoronaFalloff: { value: values.coronaFalloff },
      uNoiseScale: { value: values.noiseScale },
      uTextureRadialPower: { value: values.textureRadialPower },
      uCoronaEdgeSoftness: { value: values.coronaEdgeSoftness },
      uBaseFillStrength: { value: values.baseFillStrength },
      uCoreRadiusInner: { value: values.coreRadiusInner },
      uCoreRadiusOuter: { value: values.coreRadiusOuter },
      uCoreTightness: { value: values.coreTightness },
      uHaloFalloff: { value: values.haloFalloff },
  uCoreHotspotMix: { value: values.coreHotspotMix },
  uCoreDetailStrength: { value: values.coreDetailStrength },
  uCoreDetailNoise: { value: values.coreDetailNoise },
  uCoronaFilamentStrength: { value: values.coronaFilamentStrength },
      uTextureMix: { value: values.textureMix },
      uTextureFlicker: { value: values.textureFlicker },
      uCoreStrength: { value: values.coreStrength },
      uRimStrength: { value: values.rimStrength },
      uCoronaStrength: { value: values.coronaStrength },
      uOuterGlowStrength: { value: values.outerGlowStrength },
      uAlphaStrength: { value: values.alphaStrength },
      uCoronaColorBlend: { value: values.coronaColorBlend },
      uOrganicTiling: { value: values.organicTiling },
      uOrganicScrollSpeed: { value: values.organicScrollSpeed },
      uNoiseTiling: { value: values.noiseTiling },
      uNoiseScrollSpeed: { value: values.noiseScrollSpeed },
      uNoiseDriftSpeed: { value: values.noiseDriftSpeed },
      uSwirlRate: { value: values.swirlRate },
      uSectorDarkeningStrength: { value: values.sectorDarkeningStrength },
      uColorCore: { value: values.colorCore.clone() },
      uColorPrimary: { value: values.colorPrimary.clone() },
      uColorSecondary: { value: values.colorSecondary.clone() },
      uTextureOrganic: { value: organicTexture },
      uTextureNoise: { value: noiseTexture },
    },
  });
  return material;
}

export function tryCreateStarDiskMaterial(
  values: StarDiskUniformValues,
  textures: StarDiskTextures,
  factory: (uniforms: StarDiskUniformValues, textures: StarDiskTextures) => ShaderMaterial = createStarDiskMaterial,
): ShaderMaterial | null {
  try {
    return factory(values, textures);
  } catch (error) {
    console.warn('[StarDisk] Failed to create shader material, falling back to basic material.', error);
    return null;
  }
}

export function updateStarDiskUniforms(
  material: ShaderMaterial,
  values: StarDiskUniformValues,
  textures?: StarDiskTextures,
): void {
  const uniforms = material.uniforms as Record<string, { value: unknown }>;
  uniforms.uTimeScale.value = values.timeScale;
  uniforms.uBrightness.value = values.brightness;
  uniforms.uRadius.value = values.radius;
  uniforms.uOpacity.value = values.opacity;
  uniforms.uCoronaScale1.value = values.coronaScale1;
  uniforms.uCoronaScale2.value = values.coronaScale2;
  uniforms.uCoronaIntensity.value = values.coronaIntensity;
  uniforms.uCoronaFalloff.value = values.coronaFalloff;
  uniforms.uNoiseScale.value = values.noiseScale;
  uniforms.uTextureRadialPower.value = values.textureRadialPower;
  uniforms.uCoronaEdgeSoftness.value = values.coronaEdgeSoftness;
  uniforms.uBaseFillStrength.value = values.baseFillStrength;
  uniforms.uCoreRadiusInner.value = values.coreRadiusInner;
  uniforms.uCoreRadiusOuter.value = values.coreRadiusOuter;
  uniforms.uCoreTightness.value = values.coreTightness;
  uniforms.uHaloFalloff.value = values.haloFalloff;
  uniforms.uCoreHotspotMix.value = values.coreHotspotMix;
  uniforms.uCoreDetailStrength.value = values.coreDetailStrength;
  uniforms.uCoreDetailNoise.value = values.coreDetailNoise;
  uniforms.uCoronaFilamentStrength.value = values.coronaFilamentStrength;
  uniforms.uTextureMix.value = values.textureMix;
  uniforms.uTextureFlicker.value = values.textureFlicker;
  uniforms.uCoreStrength.value = values.coreStrength;
  uniforms.uRimStrength.value = values.rimStrength;
  uniforms.uCoronaStrength.value = values.coronaStrength;
  uniforms.uOuterGlowStrength.value = values.outerGlowStrength;
  uniforms.uAlphaStrength.value = values.alphaStrength;
  uniforms.uCoronaColorBlend.value = values.coronaColorBlend;
  uniforms.uOrganicTiling.value = values.organicTiling;
  uniforms.uOrganicScrollSpeed.value = values.organicScrollSpeed;
  uniforms.uNoiseTiling.value = values.noiseTiling;
  uniforms.uNoiseScrollSpeed.value = values.noiseScrollSpeed;
  uniforms.uNoiseDriftSpeed.value = values.noiseDriftSpeed;
  uniforms.uSwirlRate.value = values.swirlRate;
  uniforms.uSectorDarkeningStrength.value = values.sectorDarkeningStrength;
  (uniforms.uColorCore.value as Color).copy(values.colorCore);
  (uniforms.uColorPrimary.value as Color).copy(values.colorPrimary);
  (uniforms.uColorSecondary.value as Color).copy(values.colorSecondary);
  if (textures) {
    uniforms.uTextureOrganic.value = resolveTexture(textures.organic, FALLBACK_ORGANIC);
    uniforms.uTextureNoise.value = resolveTexture(textures.noise, FALLBACK_NOISE);
  }
}
