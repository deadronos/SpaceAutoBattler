import { Color, ShaderMaterial } from 'three';
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
  colorCore: Color;
  colorPrimary: Color;
  colorSecondary: Color;
}

export interface StarDiskMaterialConfig {
  bloomGroup: string;
  uniforms: StarDiskUniformValues;
}

export interface BuildStarDiskMaterialOptions {
  light: StarLightConfig;
  opacity: number;
  shader?: StarDiskShaderConfig;
}

const DEFAULTS = {
  bloomGroup: 'star',
  timeMultiplier: 1,
  coronaScale1: 15,
  coronaScale2: 45,
  coronaIntensity: 1,
  coronaFalloff: 2.2,
  noiseScale: 1,
  colorShift: 0,
};

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
    core.offsetHSL(0, 0.15 * shift, 0.12 * shift);
  }
  if (!shader?.colorPrimary) {
    primary.offsetHSL(0, 0.07 * shift, -0.05 * shift);
  }
  if (!shader?.colorSecondary) {
    secondary.offsetHSL(0, -0.04 * shift, 0.18 * shift);
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
  const brightness = clamp((light.intensity ?? 1) / 1.4, 0, 4);
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
      colorCore: core,
      colorPrimary: primary,
      colorSecondary: secondary,
    },
  };
}

export interface CreateStarDiskMaterialResult {
  material: ShaderMaterial;
}

export function createStarDiskMaterial(values: StarDiskUniformValues): ShaderMaterial {
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
      uAspect: { value: 1 },
      uOpacity: { value: values.opacity },
      uCoronaScale1: { value: values.coronaScale1 },
      uCoronaScale2: { value: values.coronaScale2 },
      uCoronaIntensity: { value: values.coronaIntensity },
      uCoronaFalloff: { value: values.coronaFalloff },
      uNoiseScale: { value: values.noiseScale },
      uColorCore: { value: values.colorCore.clone() },
      uColorPrimary: { value: values.colorPrimary.clone() },
      uColorSecondary: { value: values.colorSecondary.clone() },
    },
  });
  return material;
}

export function tryCreateStarDiskMaterial(
  values: StarDiskUniformValues,
  factory: (uniforms: StarDiskUniformValues) => ShaderMaterial = createStarDiskMaterial,
): ShaderMaterial | null {
  try {
    return factory(values);
  } catch (error) {
    console.warn('[StarDisk] Failed to create shader material, falling back to basic material.', error);
    return null;
  }
}

export function updateStarDiskUniforms(material: ShaderMaterial, values: StarDiskUniformValues): void {
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
  (uniforms.uColorCore.value as Color).copy(values.colorCore);
  (uniforms.uColorPrimary.value as Color).copy(values.colorPrimary);
  (uniforms.uColorSecondary.value as Color).copy(values.colorSecondary);
}
