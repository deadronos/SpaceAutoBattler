import { describe, it, expect } from 'vitest';
import { AdditiveBlending, CylinderGeometry, InstancedMesh, MeshBasicMaterial } from 'three';
import { PROJECTILE_BEAM_SHADER_CONFIG } from '../../src/config/projectiles.js';
import { createBeamLaserShaderMaterial } from '../../src/renderer/materials/beamLaserShader.js';
import { allocateBeamBrightnessAttribute } from '../../src/components/layers/ProjectilesInstancedLayer.js';

describe('Beam shader material', () => {
  it('seeds uniforms from projectile beam config', () => {
    const material = createBeamLaserShaderMaterial();
    const { nearBrightness, farBrightness, falloffExponent, falloffBase } = PROJECTILE_BEAM_SHADER_CONFIG;

    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.vertexColors).toBe(true);
    expect(material.blending).toBe(AdditiveBlending);
    expect(material.userData.__copilot_forceColorWrite).toBe(true);

    expect(material.uniforms.uNearBrightness.value).toBeCloseTo(nearBrightness);
    expect(material.uniforms.uFarBrightness.value).toBeCloseTo(farBrightness);
    expect(material.uniforms.uFalloffExponent.value).toBeCloseTo(falloffExponent);
    expect(material.uniforms.uFalloffBase.value).toBeCloseTo(falloffBase);

    const vertexSource = material.vertexShader;
    // Verify the shader doesn't manually declare instancing attributes (Three.js provides them)
    expect(vertexSource).not.toContain('attribute mat4 instanceMatrix');
    // But it should still use instanceColor from Three.js's instancing system
    expect(vertexSource).toContain('vInstanceColor = instanceColor');
    expect(vertexSource).toContain('vInstanceColor = vec3(1.0);');

    expect(material.fragmentShader).toContain('mix(uNearBrightness, uFarBrightness');
    expect(material.fragmentShader).toContain('pow(1.0 / (1.0 + pow');

    material.dispose();
  });

  it('allocates per-instance beam brightness attribute at unity', () => {
    const capacity = 6;
    const geometry = new CylinderGeometry(0.5, 0.5, 1, 8, 1, true);
    const material = new MeshBasicMaterial();
    const mesh = new InstancedMesh(geometry, material, capacity);

    const attr = allocateBeamBrightnessAttribute(mesh, capacity);

    expect(attr.count).toBe(capacity);
    expect(Array.from(attr.array as Float32Array)).toEqual(Array(capacity).fill(1));
    expect(mesh.geometry.getAttribute('instanceBeamBrightness')).toBe(attr);

    mesh.geometry.deleteAttribute('instanceBeamBrightness');
    mesh.dispose();
    geometry.dispose();
    material.dispose();
  });
});
