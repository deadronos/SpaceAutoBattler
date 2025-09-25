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
import type { StarDiskShaderConfig, StarLightConfig } from '../config/environment.js';

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
  textureMix: number;
  textureFlicker: number;
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

const DEFAULTS = {
  bloomGroup: 'star',
  timeMultiplier: 1,
  coronaScale1: 15,
  coronaScale2: 45,
  coronaIntensity: 1.28,
  coronaFalloff: 2,
  noiseScale: 1,
  colorShift: 0.45,
  textureMix: 0.98,
  textureFlicker: 0.88,
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
  if (!hex) {
    return fallback.clone();
  }
  try {
    return new Color(hex);
  } catch {
    return fallback.clone();
  }
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

  if (!shader?.colorCore) {
    core.offsetHSL(0.01 * shift, 0.22 * shift, 0.06 * shift);
  }
  if (!shader?.colorPrimary) {
    primary.offsetHSL(0.015 * shift, 0.18 * shift, -0.06 * shift);
  }
  if (!shader?.colorSecondary) {
    secondary.offsetHSL(0.03 * shift, 0.32 * shift, -0.22 * shift);
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
  const textureMix = clamp(shader?.textureMix ?? DEFAULTS.textureMix, 0, 1);
  const textureFlicker = clamp(shader?.textureFlicker ?? DEFAULTS.textureFlicker, 0, 2);
  const brightness = clamp((light.intensity ?? 1) / 1.6, 0, 3);
  const baseColor = new Color(light.color ?? '#ffffff');
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
      textureMix,
      textureFlicker,
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
      uTextureMix: { value: values.textureMix },
      uTextureFlicker: { value: values.textureFlicker },
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
  uniforms.uTextureMix.value = values.textureMix;
  uniforms.uTextureFlicker.value = values.textureFlicker;
  (uniforms.uColorCore.value as Color).copy(values.colorCore);
  (uniforms.uColorPrimary.value as Color).copy(values.colorPrimary);
  (uniforms.uColorSecondary.value as Color).copy(values.colorSecondary);
  if (textures) {
    uniforms.uTextureOrganic.value = resolveTexture(textures.organic, FALLBACK_ORGANIC);
    uniforms.uTextureNoise.value = resolveTexture(textures.noise, FALLBACK_NOISE);
  }
}
