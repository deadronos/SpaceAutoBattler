import { describe, expect, it, vi } from 'vitest';
import { ShaderMaterial, Texture } from 'three';
import {
  createMainSequenceStarMaterial,
  updateMainSequenceStarUniforms,
  disposeMainSequenceStarMaterial,
} from '../../src/renderer/starDiskMaterial.js';

const extractUniforms = (material: ShaderMaterial) =>
  material.uniforms as unknown as {
    iTime: { value: number };
    iResolution: { value: { x: number; y: number; z: number } };
    iChannel0: { value: Texture };
    iChannel1: { value: Texture };
    iCameraRoll: { value: number };
    iStarNorth: { value: number };
  };

describe('createMainSequenceStarMaterial', () => {
  it('creates a shader material with provided textures and default uniforms', () => {
    const organic = new Texture();
    organic.name = 'TestOrganic';
    const noise = new Texture();
    noise.name = 'TestNoise';

    const material = createMainSequenceStarMaterial({ organic, noise });

    expect(material).toBeInstanceOf(ShaderMaterial);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);

    const uniforms = extractUniforms(material);
    expect(uniforms.iTime.value).toBe(0);
    expect(uniforms.iResolution.value.x).toBe(1);
    expect(uniforms.iResolution.value.y).toBe(1);
    expect(uniforms.iChannel0.value).toBe(organic);
    expect(uniforms.iChannel0.value.name).toBe('TestOrganic');
    expect(uniforms.iChannel1.value).toBe(noise);
    expect(uniforms.iChannel1.value.name).toBe('TestNoise');
    expect(uniforms.iCameraRoll.value).toBe(0);
    expect(uniforms.iStarNorth.value).toBe(0);
    expect(material.fragmentShader).toContain('void main()');
  });

  it('uses deterministic fallback textures when none are provided', () => {
    const material = createMainSequenceStarMaterial({ organic: null, noise: null });
    const uniforms = extractUniforms(material);

    expect(uniforms.iChannel0.value.name).toBe('MainSequenceOrganicFallback');
    expect(uniforms.iChannel1.value.name).toBe('MainSequenceNoiseFallback');
  });
});

describe('updateMainSequenceStarUniforms', () => {
  it('updates time, resolution, and textures in a single call', () => {
    const material = createMainSequenceStarMaterial({ organic: null, noise: null });
    const uniforms = extractUniforms(material);
    const organic = new Texture();
    organic.name = 'UpdatedOrganic';
    const noise = new Texture();
    noise.name = 'UpdatedNoise';

    updateMainSequenceStarUniforms(material, {
      time: 42.5,
      resolution: { width: 1920, height: 1080 },
      organic,
      noise,
      cameraRoll: Math.PI / 4,
      starNorth: Math.PI / 6,
    });

    expect(uniforms.iTime.value).toBe(42.5);
    expect(uniforms.iResolution.value.x).toBe(1920);
    expect(uniforms.iResolution.value.y).toBe(1080);
    expect(uniforms.iChannel0.value).toBe(organic);
    expect(uniforms.iChannel0.value.name).toBe('UpdatedOrganic');
    expect(uniforms.iChannel1.value).toBe(noise);
    expect(uniforms.iChannel1.value.name).toBe('UpdatedNoise');
    expect(uniforms.iCameraRoll.value).toBeCloseTo(Math.PI / 4);
    expect(uniforms.iStarNorth.value).toBeCloseTo(Math.PI / 6);
  });

  it('clamps non-finite resolution inputs and reuses fallback textures', () => {
    const material = createMainSequenceStarMaterial({ organic: null, noise: null });
    const uniforms = extractUniforms(material);

    updateMainSequenceStarUniforms(material, {
      time: 3,
      resolution: { width: Number.NaN, height: Number.POSITIVE_INFINITY },
    });

    expect(uniforms.iResolution.value.x).toBe(1);
    expect(uniforms.iResolution.value.y).toBe(1);

    updateMainSequenceStarUniforms(material, {
      time: 4,
      resolution: { width: 800, height: 600 },
      organic: null,
      noise: null,
      cameraRoll: Number.NaN,
      starNorth: Number.NaN,
    });

    expect(uniforms.iChannel0.value.name).toBe('MainSequenceOrganicFallback');
    expect(uniforms.iChannel1.value.name).toBe('MainSequenceNoiseFallback');
    expect(uniforms.iCameraRoll.value).toBe(0);
    expect(uniforms.iStarNorth.value).toBe(0);
  });
});

describe('disposeMainSequenceStarMaterial', () => {
  it('invokes dispose on the provided material exactly once', () => {
    const material = createMainSequenceStarMaterial({ organic: null, noise: null });
    const disposeSpy = vi.spyOn(material, 'dispose');

    disposeMainSequenceStarMaterial(material);
    disposeMainSequenceStarMaterial(null);

    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });
});
