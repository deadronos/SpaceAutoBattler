import { afterEach, describe, expect, it } from 'vitest';
import { Color, DataTexture, RGBAFormat, ShaderMaterial, Texture, UnsignedByteType } from 'three';
import type { StarLightConfig, StarDiskShaderConfig } from '../../src/config/environment.js';
import {
  buildStarDiskMaterialConfig,
  createStarDiskMaterial,
  tryCreateStarDiskMaterial,
  updateStarDiskUniforms,
  type StarDiskTextures,
} from '../../src/renderer/starDiskMaterial.js';
import { applyStarDiskDebugOverrides } from '../../src/config/starDiskDebug.js';

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
        textureRadialPower: 10,
        coronaEdgeSoftness: -5,
        baseFillStrength: 2,
        colorCore: '#ff0000',
        textureMix: 1.5,
        textureFlicker: 3,
    coreRadiusInner: 0.9,
    coreRadiusOuter: 0.4,
    coreTightness: 7,
    haloFalloff: 10,
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
        swirlRate: 3,
        sectorDarkeningStrength: 5,
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
    expect(config.uniforms.textureRadialPower).toBe(2);
    expect(config.uniforms.coronaEdgeSoftness).toBe(0.2);
    expect(config.uniforms.baseFillStrength).toBe(1);
    expect(config.uniforms.coreRadiusInner).toBeCloseTo(0.6, 6);
    expect(config.uniforms.coreRadiusOuter).toBeCloseTo(0.65, 6);
    expect(config.uniforms.coreTightness).toBe(4);
    expect(config.uniforms.haloFalloff).toBe(4);
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
    expect(config.uniforms.swirlRate).toBe(2); // Clamped from 3 to 2
    expect(config.uniforms.sectorDarkeningStrength).toBe(2); // Clamped from 5 to 2
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

    expect(config.uniforms.coronaIntensity).toBeCloseTo(1.88, 2);
    expect(config.uniforms.textureMix).toBeGreaterThan(0.85);
    expect(config.uniforms.textureFlicker).toBeGreaterThan(1.0);
    expect(config.uniforms.textureRadialPower).toBeCloseTo(0.52, 2);
    expect(config.uniforms.coronaEdgeSoftness).toBeCloseTo(0.6, 2);
    expect(config.uniforms.baseFillStrength).toBeCloseTo(0.18, 2);
    expect(config.uniforms.coreRadiusInner).toBeCloseTo(0.18, 2);
    expect(config.uniforms.coreRadiusOuter).toBeCloseTo(0.54, 2);
    expect(config.uniforms.coreTightness).toBeCloseTo(1.6, 2);
    expect(config.uniforms.haloFalloff).toBeCloseTo(0.92, 2);
    expect(config.uniforms.coreHotspotMix).toBeCloseTo(0.24, 2);
    expect(config.uniforms.coreDetailStrength).toBeCloseTo(0.82, 2);
    expect(config.uniforms.coreDetailNoise).toBeCloseTo(0.66, 2);
    expect(config.uniforms.coronaFilamentStrength).toBeCloseTo(0.92, 2);
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
        textureRadialPower: 0.4,
        coronaEdgeSoftness: 1.8,
        baseFillStrength: 0.05,
    coreRadiusInner: 0.1,
    coreRadiusOuter: 0.45,
    coreTightness: 1.9,
    haloFalloff: 0.6,
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
    expect(uniforms.uTextureRadialPower.value).toBe(updatedConfig.uniforms.textureRadialPower);
    expect(uniforms.uCoronaEdgeSoftness.value).toBe(updatedConfig.uniforms.coronaEdgeSoftness);
    expect(uniforms.uBaseFillStrength.value).toBe(updatedConfig.uniforms.baseFillStrength);
    expect(uniforms.uCoreRadiusInner.value).toBe(updatedConfig.uniforms.coreRadiusInner);
    expect(uniforms.uCoreRadiusOuter.value).toBe(updatedConfig.uniforms.coreRadiusOuter);
    expect(uniforms.uCoreTightness.value).toBe(updatedConfig.uniforms.coreTightness);
    expect(uniforms.uHaloFalloff.value).toBe(updatedConfig.uniforms.haloFalloff);
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
    expect(uniforms.uTextureRadialPower.value).toBe(config.uniforms.textureRadialPower);
    expect(uniforms.uCoronaEdgeSoftness.value).toBe(config.uniforms.coronaEdgeSoftness);
    expect(uniforms.uBaseFillStrength.value).toBe(config.uniforms.baseFillStrength);
    expect(uniforms.uCoreRadiusInner.value).toBe(config.uniforms.coreRadiusInner);
    expect(uniforms.uCoreRadiusOuter.value).toBe(config.uniforms.coreRadiusOuter);
    expect(uniforms.uCoreTightness.value).toBe(config.uniforms.coreTightness);
    expect(uniforms.uHaloFalloff.value).toBe(config.uniforms.haloFalloff);
    expect(uniforms.uCoreStrength.value).toBe(config.uniforms.coreStrength);
    expect((uniforms.uTextureOrganic.value as Texture).name).toBe('StarDiskOrganicFallback');
    expect((uniforms.uTextureNoise.value as Texture).name).toBe('StarDiskNoiseFallback');
    expect(uniforms.uOpacity.value).toBeLessThanOrEqual(1);

    material.dispose();
  });
});

describe('star disk debug overrides', () => {
  const debugGlobal = globalThis as {
    __STAR_DISK_DEBUG__?: { shaderOverrides?: Partial<StarDiskShaderConfig> };
    __STAR_DISK_DEBUG_STATE__?: { merged?: StarDiskShaderConfig };
  };

  afterEach(() => {
    delete debugGlobal.__STAR_DISK_DEBUG__;
    delete debugGlobal.__STAR_DISK_DEBUG_STATE__;
  });

  it('returns base config when no debug context is present', () => {
    const base: StarDiskShaderConfig = { textureMix: 0.5 };
    const result = applyStarDiskDebugOverrides(base);
    expect(result).toBe(base);
  });

  it('merges numeric overrides from the debug context without mutating the base', () => {
    const base: StarDiskShaderConfig = {
      textureMix: 0.5,
      coronaStrength: 1.2,
    };
    debugGlobal.__STAR_DISK_DEBUG__ = {
      shaderOverrides: {
        textureMix: 0.1,
        coronaStrength: 2.4,
      },
    };

    const result = applyStarDiskDebugOverrides(base);

    expect(result).not.toBe(base);
    expect(result?.textureMix).toBe(0.1);
    expect(result?.coronaStrength).toBe(2.4);
    expect(base.textureMix).toBe(0.5);
    expect(base.coronaStrength).toBe(1.2);
  });

  it('deep merges palette offsets without mutating the source config', () => {
    const base: StarDiskShaderConfig = {
      paletteOffsets: {
        core: { hue: 0.1 },
        primary: { saturation: 0.2 },
      },
    };
    debugGlobal.__STAR_DISK_DEBUG__ = {
      shaderOverrides: {
        paletteOffsets: {
          core: { saturation: 0.3 },
          secondary: { lightness: -0.15 },
        },
      },
    };

    const result = applyStarDiskDebugOverrides(base);

    expect(result).not.toBe(base);
    expect(result?.paletteOffsets?.core?.hue).toBe(0.1);
    expect(result?.paletteOffsets?.core?.saturation).toBe(0.3);
    expect(result?.paletteOffsets?.secondary?.lightness).toBe(-0.15);
    expect(base.paletteOffsets?.core?.saturation).toBeUndefined();
    expect(base.paletteOffsets?.secondary).toBeUndefined();
  });

  it('returns overrides when no base config is supplied', () => {
    debugGlobal.__STAR_DISK_DEBUG__ = {
      shaderOverrides: {
        textureRadialPower: 0.4,
        coronaEdgeSoftness: 1.1,
      },
    };

    const result = applyStarDiskDebugOverrides(undefined);

    expect(result).toBeDefined();
    expect(result?.textureRadialPower).toBe(0.4);
    expect(result?.coronaEdgeSoftness).toBe(1.1);
    expect(debugGlobal.__STAR_DISK_DEBUG_STATE__?.merged?.textureRadialPower).toBe(0.4);
  });

  it('includes new fiery enhancement parameters in debug overrides', () => {
    const base: StarDiskShaderConfig = {
      swirlRate: 0.2,
      sectorDarkeningStrength: 0.1,
    };
    debugGlobal.__STAR_DISK_DEBUG__ = {
      shaderOverrides: {
        swirlRate: 0.8,
        sectorDarkeningStrength: 0.6,
        coreStrength: 2.5,
      },
    };

    const result = applyStarDiskDebugOverrides(base);

    expect(result).not.toBe(base);
    expect(result?.swirlRate).toBe(0.8);
    expect(result?.sectorDarkeningStrength).toBe(0.6);
    expect(result?.coreStrength).toBe(2.5);
    expect(base.swirlRate).toBe(0.2);
    expect(base.sectorDarkeningStrength).toBe(0.1);
  });
});
