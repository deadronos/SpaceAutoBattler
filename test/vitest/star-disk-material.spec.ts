import { describe, expect, it } from 'vitest';
import { Color, DataTexture, RGBAFormat, ShaderMaterial, UnsignedByteType } from 'three';
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
      },
    });

    expect(config.bloomGroup).toBe('corona');
    expect(config.uniforms.opacity).toBe(1);
    expect(config.uniforms.timeScale).toBe(64);
    expect(config.uniforms.coronaScale1).toBe(1);
    expect(config.uniforms.coronaScale2).toBe(512);
    expect(config.uniforms.coronaIntensity).toBe(10);
    expect(config.uniforms.coronaFalloff).toBe(0.1);
    expect(config.uniforms.noiseScale).toBe(0.1);
    expect(config.uniforms.textureMix).toBe(1);
    expect(config.uniforms.textureFlicker).toBe(2);
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

    const baseHex = new Color(BASE_LIGHT.color).getHexString();
    expect(config.uniforms.colorCore.getHexString()).not.toBe(baseHex);
    expect(config.uniforms.colorPrimary.getHexString()).not.toBe(baseHex);
    expect(config.uniforms.colorSecondary.getHexString()).not.toBe(baseHex);
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
      shader: { coronaIntensity: 0.5, coronaScale1: 32, textureMix: 0.2, textureFlicker: 0.1 },
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
});
