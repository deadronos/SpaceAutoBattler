import { describe, expect, it } from 'vite-plus/test';
import { Color, DoubleSide, NormalBlending, ShaderMaterial } from 'three';
import { createShipImpostorMaterial } from '../../src/renderer/materials/thrusterMaterials.js';

describe('createShipImpostorMaterial', () => {
  it('returns a ShaderMaterial configured for instanced impostor sprites', () => {
    const material = createShipImpostorMaterial();

    expect(material).toBeInstanceOf(ShaderMaterial);
    expect(material.name).toBe('ship-impostor-instance');
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(DoubleSide);
    expect(material.blending).toBe(NormalBlending);
    expect(material.toneMapped).toBe(false);

    expect(material.uniforms.uColor?.value).toBeInstanceOf(Color);
    expect((material.uniforms.uColor?.value as Color).getHexString()).toBe('ffffff');
    expect(material.uniforms.uOpacity?.value).toBeCloseTo(0.9, 5);

    expect(material.vertexShader).toContain('USE_INSTANCING');
    expect(material.vertexShader).toContain('USE_INSTANCING_COLOR');
    expect(material.vertexShader).toContain('vUv');

    expect(material.fragmentShader).toContain('radial > 1.0');
    expect(material.fragmentShader).toContain('discard;');
    expect(material.fragmentShader).toContain('diamond');
    expect(material.fragmentShader).toContain('ring');
    expect(material.fragmentShader).toContain('halo');

    material.dispose();
  });

  it('merges custom parameters and uniforms cleanly', () => {
    const customColor = new Color('#33ccff');
    const material = createShipImpostorMaterial({
      uniforms: {
        uColor: { value: customColor },
        uOpacity: { value: 0.65 },
      },
    });

    expect((material.uniforms.uColor?.value as Color).getHexString()).toBe('33ccff');
    expect(material.uniforms.uOpacity?.value).toBeCloseTo(0.65, 5);

    material.dispose();
  });
});
