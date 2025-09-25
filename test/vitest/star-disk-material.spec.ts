import { describe, expect, it } from 'vitest';
import { Color, DataTexture, RGBAFormat, ShaderMaterial, Texture, UnsignedByteType } from 'three';
import type { StarLightConfig } from '../../src/config/environment.js';
import {
  buildStarDiskMaterialConfig,
  createStarDiskMaterial,
  tryCreateStarDiskMaterial,
  updateStarDiskUniforms,
  type StarDiskTextures,
} from '../../src/renderer/starDiskMaterial.js';

const BASE_LIGHT: StarLightConfig = {
  color: '#ffd8b0',
  intensity: 1.2,
  direction: { x: -0.25, y: -0.15, z: -0.95 },
  distance: 30000,
};

describe('star disk material config', () => {
  it('normalises overrides and clamps to safe ranges', () => {
    const config = buildStarDiskMaterialConfig({
      light: BASE_LIGHT,
      opacity: 1.5,
      shader: {
        bloomGroup: '  corona ',
        timeMultiplier: 128,
        coronaScale1: 0.5,
        coronaScale2: 800,
        coronaIntensity: 25,
        coronaFalloff: 0.05,
        noiseScale: 0.05,
        colorCore: '#ff0000',
        textureMix: 1.5,
        textureFlicker: 3,
        coreStrength: 6,
        rimStrength: -2,
        coronaStrength: 12,
        outerGlowStrength: 6,
        alphaStrength: 4,
        coronaColorBlend: 1.5,
        organicTiling: 0.1,
        organicScrollSpeed: 8,
        noiseTiling: 5,
        noiseScrollSpeed: 9,
        paletteOffsets: {
          core: { hue: 2, saturation: -2, lightness: 2 },
          primary: { hue: -5, saturation: 5, lightness: -5 },
          secondary: { hue: 1.5, saturation: 1.5, lightness: -1.5 },
        },
        noiseDriftSpeed: 12,
      },
    });

    expect(config.bloomGroup).toBe('corona');
    expect(config.uniforms.opacity).toBe(1);
    expect(config.uniforms.timeScale).toBe(64);
    expect(config.uniforms.coronaScale1).toBe(1);
    expect(config.uniforms.coronaScale2).toBe(512);
    const coreHsl = config.uniforms.colorCore.getHSL({ h: 0, s: 0, l: 0 });
    const primaryHsl = config.uniforms.colorPrimary.getHSL({ h: 0, s: 0, l: 0 });
    const secondaryHsl = config.uniforms.colorSecondary.getHSL({ h: 0, s: 0, l: 0 });
    expect(coreHsl.h).toBeGreaterThanOrEqual(0);
    expect(coreHsl.h).toBeLessThanOrEqual(1);
    expect(primaryHsl.h).toBeGreaterThanOrEqual(0);
    expect(primaryHsl.h).toBeLessThanOrEqual(1);
    expect(secondaryHsl.h).toBeGreaterThanOrEqual(0);
    expect(secondaryHsl.h).toBeLessThanOrEqual(1);
    expect(config.uniforms.coronaIntensity).toBe(10);
    expect(config.uniforms.coronaFalloff).toBe(0.1);
    expect(config.uniforms.noiseScale).toBe(0.1);
    expect(config.uniforms.textureMix).toBe(1);
    expect(config.uniforms.textureFlicker).toBe(2);
  expect(config.uniforms.coreStrength).toBe(4);
  expect(config.uniforms.rimStrength).toBe(0);
  expect(config.uniforms.coronaStrength).toBe(4);
  expect(config.uniforms.outerGlowStrength).toBe(4);
  expect(config.uniforms.alphaStrength).toBe(3);
  expect(config.uniforms.coronaColorBlend).toBe(1);
  expect(config.uniforms.organicTiling).toBeCloseTo(0.25, 4);
  expect(config.uniforms.organicScrollSpeed).toBe(5);
  expect(config.uniforms.noiseTiling).toBe(4);
  expect(config.uniforms.noiseScrollSpeed).toBe(5);
  expect(config.uniforms.noiseDriftSpeed).toBe(5);
    expect(config.uniforms.colorCore.getHexString()).toBe('ff0000');
    expect(config.uniforms.brightness).toBeGreaterThan(0);
  });

  it('applies color shift when no explicit overrides are provided', () => {
    const config = buildStarDiskMaterialConfig({
      light: BASE_LIGHT,
      opacity: 0.5,
      shader: {
        colorShift: 0.5,
      },
    });

  const baseHex = new Color(BASE_LIGHT.color).convertSRGBToLinear().getHexString();
    expect(config.uniforms.colorCore.getHexString()).not.toBe(baseHex);
    expect(config.uniforms.colorPrimary.getHexString()).not.toBe(baseHex);
    expect(config.uniforms.colorSecondary.getHexString()).not.toBe(baseHex);
  });

  it('allows palette offsets to be customised', () => {
    const config = buildStarDiskMaterialConfig({
      light: BASE_LIGHT,
      opacity: 0.5,
      shader: {
        colorShift: 1,
        paletteOffsets: {
          core: { hue: 0.05, saturation: 0.4, lightness: 0.2 },
          primary: { hue: -0.1, saturation: -0.2, lightness: 0.1 },
          secondary: { hue: 0.15, saturation: 0.5, lightness: -0.3 },
        },
      },
    });

  const expectedCore = new Color(BASE_LIGHT.color).convertSRGBToLinear();
  expectedCore.offsetHSL(0.05, 0.4, 0.2);
  const expectedPrimary = new Color(BASE_LIGHT.color).convertSRGBToLinear();
  expectedPrimary.offsetHSL(-0.1, -0.2, 0.1);
  const expectedSecondary = new Color(BASE_LIGHT.color).convertSRGBToLinear();
  expectedSecondary.offsetHSL(0.15, 0.5, -0.3);

    expect(config.uniforms.colorCore.getHexString()).toBe(expectedCore.getHexString());
    expect(config.uniforms.colorPrimary.getHexString()).toBe(expectedPrimary.getHexString());
    expect(config.uniforms.colorSecondary.getHexString()).toBe(expectedSecondary.getHexString());
  });

  it('exposes fiery defaults when no overrides are supplied', () => {
    const config = buildStarDiskMaterialConfig({ light: BASE_LIGHT, opacity: 0.75 });
  const baseHex = new Color(BASE_LIGHT.color).convertSRGBToLinear().getHexString();
  const baseHsl = new Color(BASE_LIGHT.color).convertSRGBToLinear().getHSL({ h: 0, s: 0, l: 0 });
    const secondaryHsl = config.uniforms.colorSecondary.getHSL({ h: 0, s: 0, l: 0 });

    expect(config.uniforms.coronaIntensity).toBeCloseTo(1.28, 2);
    expect(config.uniforms.textureMix).toBeGreaterThan(0.95);
    expect(config.uniforms.textureFlicker).toBeGreaterThan(0.85);
    expect(config.uniforms.brightness).toBeGreaterThan(0.6);
    expect(config.uniforms.brightness).toBeLessThan(0.9);
    expect(config.uniforms.colorCore.getHexString()).not.toBe(baseHex);
    expect(config.uniforms.colorPrimary.getHexString()).not.toBe(baseHex);
    expect(config.uniforms.colorSecondary.getHexString()).not.toBe(baseHex);
    expect(secondaryHsl.s).toBeGreaterThanOrEqual(baseHsl.s);
    expect(secondaryHsl.h).toBeGreaterThanOrEqual(baseHsl.h);
    expect(secondaryHsl.l).toBeLessThan(baseHsl.l);
  });
});

describe('star disk material lifecycle', () => {
  const createTexture = (id: number) => {
    const tex = new DataTexture(new Uint8Array([id, id, id, 255]), 1, 1, RGBAFormat, UnsignedByteType);
    tex.needsUpdate = true;
    return tex;
  };

  it('creates and updates shader uniforms', () => {
    const textures: StarDiskTextures = {
      organic: createTexture(160),
      noise: createTexture(96),
    };
    const config = buildStarDiskMaterialConfig({ light: BASE_LIGHT, opacity: 0.6, textures });
    const material = createStarDiskMaterial(config.uniforms, textures);

    expect(material).toBeInstanceOf(ShaderMaterial);
    expect(material.transparent).toBe(true);
    const uniforms = material.uniforms as Record<string, { value: unknown }>;
    expect(uniforms.uTextureOrganic.value).toBe(textures.organic);
    expect(uniforms.uTextureNoise.value).toBe(textures.noise);

    const updatedConfig = buildStarDiskMaterialConfig({
      light: { ...BASE_LIGHT, intensity: 2.4 },
      opacity: 0.2,
      shader: {
        coronaIntensity: 0.5,
        coronaScale1: 32,
        textureMix: 0.2,
        textureFlicker: 0.1,
        coreStrength: 0.5,
        rimStrength: 1.8,
        coronaStrength: 1.4,
        outerGlowStrength: 0.6,
        alphaStrength: 0.8,
        coronaColorBlend: 0.2,
        organicTiling: 1.6,
        organicScrollSpeed: 1.4,
        noiseTiling: 0.75,
        noiseScrollSpeed: 1.5,
        noiseDriftSpeed: 0.4,
      },
      textures: {
        organic: createTexture(220),
        noise: createTexture(32),
      },
    });

    updateStarDiskUniforms(material, updatedConfig.uniforms, updatedConfig.textures);

    expect(uniforms.uBrightness.value).toBe(updatedConfig.uniforms.brightness);
    expect(uniforms.uOpacity.value).toBe(updatedConfig.uniforms.opacity);
    expect((uniforms.uColorCore.value as Color).getHexString()).toBe(
      updatedConfig.uniforms.colorCore.getHexString(),
    );
    expect(uniforms.uTextureMix.value).toBe(updatedConfig.uniforms.textureMix);
    expect(uniforms.uTextureFlicker.value).toBe(updatedConfig.uniforms.textureFlicker);
    expect(uniforms.uCoreStrength.value).toBe(updatedConfig.uniforms.coreStrength);
    expect(uniforms.uRimStrength.value).toBe(updatedConfig.uniforms.rimStrength);
    expect(uniforms.uCoronaStrength.value).toBe(updatedConfig.uniforms.coronaStrength);
    expect(uniforms.uOuterGlowStrength.value).toBe(updatedConfig.uniforms.outerGlowStrength);
    expect(uniforms.uAlphaStrength.value).toBe(updatedConfig.uniforms.alphaStrength);
    expect(uniforms.uCoronaColorBlend.value).toBe(updatedConfig.uniforms.coronaColorBlend);
    expect(uniforms.uOrganicTiling.value).toBe(updatedConfig.uniforms.organicTiling);
    expect(uniforms.uOrganicScrollSpeed.value).toBe(updatedConfig.uniforms.organicScrollSpeed);
    expect(uniforms.uNoiseTiling.value).toBe(updatedConfig.uniforms.noiseTiling);
    expect(uniforms.uNoiseScrollSpeed.value).toBe(updatedConfig.uniforms.noiseScrollSpeed);
    expect(uniforms.uNoiseDriftSpeed.value).toBe(updatedConfig.uniforms.noiseDriftSpeed);
    expect(uniforms.uTextureOrganic.value).toBe(updatedConfig.textures.organic);
    expect(uniforms.uTextureNoise.value).toBe(updatedConfig.textures.noise);

    material.dispose();
  });

  it('falls back gracefully when shader creation throws', () => {
    const textures: StarDiskTextures = { organic: null, noise: null };
    const config = buildStarDiskMaterialConfig({ light: BASE_LIGHT, opacity: 0.8, textures });
    const material = tryCreateStarDiskMaterial(config.uniforms, textures, () => {
      throw new Error('fail');
    });
    expect(material).toBeNull();
  });

  it('retains fiery tuning when falling back to generated textures', () => {
    const textures: StarDiskTextures = { organic: null, noise: null };
    const config = buildStarDiskMaterialConfig({ light: BASE_LIGHT, opacity: 0.7, textures });
    const material = createStarDiskMaterial(config.uniforms, textures);
    const uniforms = material.uniforms as Record<string, { value: unknown }>;

    expect(uniforms.uCoronaIntensity.value).toBe(config.uniforms.coronaIntensity);
    expect(uniforms.uTextureMix.value).toBe(config.uniforms.textureMix);
    expect(uniforms.uTextureFlicker.value).toBe(config.uniforms.textureFlicker);
  expect(uniforms.uCoreStrength.value).toBe(config.uniforms.coreStrength);
    expect((uniforms.uTextureOrganic.value as Texture).name).toBe('StarDiskOrganicFallback');
    expect((uniforms.uTextureNoise.value as Texture).name).toBe('StarDiskNoiseFallback');
    expect(uniforms.uOpacity.value).toBeLessThanOrEqual(1);

    material.dispose();
  });
});
