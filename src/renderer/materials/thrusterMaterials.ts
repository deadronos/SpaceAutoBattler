import { Color, DoubleSide, MeshBasicMaterial, NormalBlending } from 'three';
import type { MeshBasicMaterialParameters, ShaderMaterial, ShaderMaterialParameters } from 'three';
import { thrusterGlowPreset } from './materialPresets.js';
import { createBasicMaterial } from './materialFactory.js';
import { createGlslMaterial } from './createGlslMaterial.js';

const SHIP_IMPOSTOR_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
varying vec3 vInstanceColor;

void main() {
  vUv = uv;
  #ifdef USE_INSTANCING_COLOR
    vInstanceColor = instanceColor;
  #else
    vInstanceColor = vec3(1.0);
  #endif

  vec4 localPosition = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    localPosition = instanceMatrix * localPosition;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * localPosition;
}
`;

const SHIP_IMPOSTOR_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;

varying vec2 vUv;
varying vec3 vInstanceColor;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float radial = length(p);
  if (radial > 1.0) {
    discard;
  }

  // Stylized hull-signature sprite: diamond tactical core + soft rim ring + outer halo.
  float diamond = abs(p.x) * 1.15 + abs(p.y) * 0.95;
  float core = 1.0 - smoothstep(0.18, 0.48, diamond);
  float ring = exp(-pow((radial - 0.62) / 0.14, 2.0)) * 0.7;
  float halo = (1.0 - smoothstep(0.25, 1.0, radial)) * 0.4;

  float alpha = clamp(core + ring + halo, 0.0, 1.0) * uOpacity;
  if (alpha <= 0.004) {
    discard;
  }

  vec3 baseColor = uColor * vInstanceColor;
  vec3 highlightColor = mix(baseColor, vec3(1.0), core * 0.45);
  gl_FragColor = vec4(highlightColor, alpha);
}
`;

export function createThrusterGlowMaterial(
  parameters: MeshBasicMaterialParameters = {},
): MeshBasicMaterial {
  const material = createBasicMaterial({ ...thrusterGlowPreset, ...parameters });
  material.name = 'thruster-glow-instance';
  return material;
}

export function createShipImpostorMaterial(
  parameters: ShaderMaterialParameters = {},
): ShaderMaterial {
  const { uniforms: customUniforms, ...rest } = parameters;
  const material = createGlslMaterial({
    vertexShader: SHIP_IMPOSTOR_VERTEX_SHADER,
    fragmentShader: SHIP_IMPOSTOR_FRAGMENT_SHADER,
    prependCommonGlsl: false,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: NormalBlending,
    toneMapped: false,
    ...rest,
    uniforms: {
      uColor: { value: new Color('#ffffff') },
      uOpacity: { value: 0.9 },
      ...customUniforms,
    },
  });
  material.name = 'ship-impostor-instance';
  return material;
}
