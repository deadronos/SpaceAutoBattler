import { describe, expect, it } from 'vitest';
import { Texture } from 'three';
import {
  createMainSequenceStarMaterial,
  updateMainSequenceStarUniforms,
  disposeMainSequenceStarMaterial,
} from '../../src/renderer/starDisk/materialFactory.js';

describe('main sequence star material factory', () => {
  it('creates, updates, and disposes the shader material without errors', () => {
    const material = createMainSequenceStarMaterial({ organic: null, noise: null });

    const organic = new Texture();
    const noise = new Texture();
    updateMainSequenceStarUniforms(material, {
      time: 1.5,
      resolution: { width: 256, height: 128 },
      organic,
      noise,
      cameraRoll: Math.PI / 4,
      starNorth: Math.PI / 3,
      viewAlignment: { x: 0.25, y: -0.5, z: 0.8 },
      haze: { taperStrength: 0.4, edgeFadeThreshold: 0.35, edgeExponent: 2.5 },
      boundary: { featherStart: 0.7, featherExponent: 2.2, alphaFloor: 0.08 },
      depthCoreRadius: 0.45,
    });

    const uniforms = material.uniforms as unknown as Record<string, { value: unknown }>;
    expect((uniforms.iTime?.value as number) ?? 0).toBeCloseTo(1.5);
    const resolution = uniforms.iResolution?.value as { x: number; y: number };
    expect(resolution.x).toBe(256);
    expect(resolution.y).toBe(128);
    expect(uniforms.iChannel0?.value).toBe(organic);
    expect(uniforms.iChannel1?.value).toBe(noise);
    const boundary = uniforms.iBoundaryFeather?.value as { x: number; y: number; z: number };
    expect(boundary.x).toBeCloseTo(0.7);
    expect(boundary.y).toBeCloseTo(2.2);
    expect(boundary.z).toBeCloseTo(0.08);
    const haze = uniforms.iHazeParams?.value as { x: number; y: number; z: number };
    expect(haze.x).toBeGreaterThan(0);
    expect(haze.y).toBeCloseTo(0.35);
    expect(haze.z).toBeCloseTo(2.5);
    expect((uniforms.iDepthCoreRadius?.value as number) ?? 0).toBeCloseTo(0.45);

    updateMainSequenceStarUniforms(material, {
      time: 2,
      resolution: { width: 1, height: 1 },
      cameraRoll: undefined,
      starNorth: undefined,
      viewAlignment: { x: 0, y: 0, z: 2 },
    });

    const clampedAlignment = uniforms.iViewAlignment?.value as {
      x: number;
      y: number;
      z: number;
    };
    expect(clampedAlignment.z).toBe(1);

    const cleanupBeforeDispose = (material.userData as Record<string, unknown>)[
      '__starDiskDevCleanup'
    ];
    expect(typeof cleanupBeforeDispose === 'function' || cleanupBeforeDispose === undefined).toBe(
      true,
    );

    disposeMainSequenceStarMaterial(material);

    expect((material.userData as Record<string, unknown>).__starDiskDevCleanup).toBeUndefined();
  });
});
