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
    iViewAlignment: { value: { x: number; y: number; z: number } };
    iHazeParams: { value: { x: number; y: number; z: number } };
    iBoundaryFeather: { value: { x: number; y: number; z: number; w: number } };
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
    expect(uniforms.iViewAlignment.value.x).toBe(0);
    expect(uniforms.iViewAlignment.value.y).toBe(0);
    expect(uniforms.iViewAlignment.value.z).toBe(1);
    expect(uniforms.iHazeParams.value.x).toBe(1);
    expect(uniforms.iHazeParams.value.y).toBeCloseTo(0.5);
    expect(uniforms.iHazeParams.value.z).toBeCloseTo(1.25);
    expect(uniforms.iBoundaryFeather.value.x).toBeCloseTo(0.875, 2);
    expect(uniforms.iBoundaryFeather.value.y).toBeCloseTo(1.75, 2);
    expect(uniforms.iBoundaryFeather.value.z).toBeCloseTo(0.05, 3);
    expect(uniforms.iBoundaryFeather.value.w).toBe(0);
    expect(material.fragmentShader).toContain('void main()');
  });

  it('uses deterministic fallback textures when none are provided', () => {
    const material = createMainSequenceStarMaterial({ organic: null, noise: null });
    const uniforms = extractUniforms(material);

    expect(uniforms.iChannel0.value.name).toBe('MainSequenceOrganicFallback');
    expect(uniforms.iChannel1.value.name).toBe('MainSequenceNoiseFallback');
    expect(uniforms.iBoundaryFeather.value.x).toBeCloseTo(0.875, 2);
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
      viewAlignment: { x: 0.6, y: -0.8, z: 0.75 },
      haze: { taperStrength: 0.9, edgeFadeThreshold: 0.25, edgeExponent: 3.5 },
      boundary: { featherStart: 0.85, featherExponent: 3.2, alphaFloor: 0.1 },
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
    expect(uniforms.iViewAlignment.value.x).toBeCloseTo(0.6);
    expect(uniforms.iViewAlignment.value.y).toBeCloseTo(-0.8);
    expect(uniforms.iViewAlignment.value.z).toBeCloseTo(0.75);
    expect(uniforms.iHazeParams.value.x).toBeLessThan(1.01);
    expect(uniforms.iHazeParams.value.x).toBeGreaterThan(0.0);
    expect(uniforms.iHazeParams.value.y).toBeCloseTo(0.25);
    expect(uniforms.iHazeParams.value.z).toBeCloseTo(3.5);
    expect(uniforms.iBoundaryFeather.value.x).toBeCloseTo(0.85, 2);
    expect(uniforms.iBoundaryFeather.value.y).toBeCloseTo(3.2, 2);
    expect(uniforms.iBoundaryFeather.value.z).toBeCloseTo(0.1, 2);
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
      viewAlignment: { x: Number.POSITIVE_INFINITY, y: Number.NaN, z: 2 },
      haze: { taperStrength: Number.NaN, edgeFadeThreshold: Number.POSITIVE_INFINITY, edgeExponent: Number.NaN },
      boundary: { featherStart: Number.NaN, featherExponent: Number.NaN, alphaFloor: Number.NaN },
    });

    expect(uniforms.iChannel0.value.name).toBe('MainSequenceOrganicFallback');
    expect(uniforms.iChannel1.value.name).toBe('MainSequenceNoiseFallback');
    expect(uniforms.iCameraRoll.value).toBe(0);
    expect(uniforms.iStarNorth.value).toBe(0);
    expect(uniforms.iViewAlignment.value.x).toBe(0);
    expect(uniforms.iViewAlignment.value.y).toBe(0);
    expect(uniforms.iViewAlignment.value.z).toBe(1);
    expect(uniforms.iHazeParams.value.x).toBe(1);
    expect(uniforms.iHazeParams.value.y).toBeCloseTo(0.5);
    expect(uniforms.iHazeParams.value.z).toBeCloseTo(1.25);
    expect(uniforms.iBoundaryFeather.value.x).toBeCloseTo(0.875, 2);
    expect(uniforms.iBoundaryFeather.value.y).toBeCloseTo(1.75, 2);
    expect(uniforms.iBoundaryFeather.value.z).toBeCloseTo(0.05, 3);
  });

  it('disables boundary feathering when legacy values are requested', () => {
    const material = createMainSequenceStarMaterial({ organic: null, noise: null });
    const uniforms = extractUniforms(material);

    updateMainSequenceStarUniforms(material, {
      time: 0,
      resolution: { width: 1024, height: 1024 },
      boundary: { featherStart: 1, alphaFloor: 1, featherExponent: 5 },
    });

    expect(uniforms.iBoundaryFeather.value.x).toBeCloseTo(0.999, 3);
    expect(uniforms.iBoundaryFeather.value.y).toBeCloseTo(1, 3);
    expect(uniforms.iBoundaryFeather.value.z).toBeCloseTo(1, 3);
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
