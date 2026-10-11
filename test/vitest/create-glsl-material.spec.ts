import { describe, expect, it } from 'vite-plus/test';
import { AdditiveBlending, DoubleSide } from 'three';
import { createGlslMaterial } from '../../src/renderer/materials/createGlslMaterial.js';
import { COMMON_GLSL, withCommonGlsl } from '../../src/renderer/shaders/index.js';

const VERTEX = 'void main() { gl_Position = vec4(0.0); }';
const FRAGMENT = 'void main() { gl_FragColor = vec4(1.0); }';

describe('createGlslMaterial', () => {
  it('prepends COMMON_GLSL to the fragment shader by default', () => {
    const material = createGlslMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    });

    expect(material.fragmentShader.startsWith(COMMON_GLSL)).toBe(true);
    expect(material.fragmentShader).toBe(withCommonGlsl(FRAGMENT));
    expect(material.fragmentShader).toContain(FRAGMENT);

    material.dispose();
  });

  it('leaves the fragment shader verbatim when prependCommonGlsl is false', () => {
    const material = createGlslMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      prependCommonGlsl: false,
    });

    expect(material.fragmentShader).toBe(FRAGMENT);

    material.dispose();
  });

  it('forwards standard ShaderMaterial parameters', () => {
    const material = createGlslMaterial({
      name: 'TestGlslMaterial',
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    });

    expect(material.name).toBe('TestGlslMaterial');
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(DoubleSide);
    expect(material.blending).toBe(AdditiveBlending);

    material.dispose();
  });

  it('forwards vertexShader and uniforms unchanged', () => {
    const uniforms = {
      uTime: { value: 0 },
      uColor: { value: [0.1, 0.2, 0.3] },
    };
    const material = createGlslMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms,
    });

    expect(material.vertexShader).toBe(VERTEX);
    expect(material.uniforms).toBe(uniforms);

    material.dispose();
  });
});
