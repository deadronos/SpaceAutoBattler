import React, { useEffect, useMemo } from 'react';
import {
  AdditiveBlending,
  ShaderMaterial,
  UniformsUtils,
  type ShaderMaterialParameters,
} from 'three';
import { PROJECTILE_BEAM_SHADER_CONFIG } from '../../config/projectiles.js';

const vertexShader = /* glsl */ `
  attribute float instanceBeamBrightness;
  varying float vSegment;
  varying float vInstanceBrightness;
  varying vec3 vInstanceColor;

  #include <common>
  #include <uv_pars_vertex>
  #include <color_pars_vertex>
  #include <fog_pars_vertex>
  #include <logdepthbuf_pars_vertex>
  #include <clipping_planes_pars_vertex>

  void main() {
    #include <uv_vertex>
    #include <color_vertex>

    vec3 transformed = position;
    #ifdef USE_INSTANCING
      transformed = (instanceMatrix * vec4(transformed, 1.0)).xyz;
    #endif
    vSegment = clamp(transformed.z + 0.5, 0.0, 1.0);
    vInstanceBrightness = instanceBeamBrightness;
    #ifdef USE_INSTANCING_COLOR
      vInstanceColor = instanceColor;
    #else
      vInstanceColor = vec3(1.0);
    #endif

    #include <beginnormal_vertex>
    #include <defaultnormal_vertex>
    #include <morphtarget_vertex>
    #include <skinning_vertex>
    #include <project_vertex>
    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uNearBrightness;
  uniform float uFarBrightness;
  uniform float uFalloffExponent;
  uniform float uFalloffBase;

  varying float vSegment;
  varying float vInstanceBrightness;
  varying vec3 vInstanceColor;

  #include <common>
  #include <packing>
  #include <fog_pars_fragment>
  #include <logdepthbuf_pars_fragment>
  #include <clipping_planes_pars_fragment>

  void main() {
    #include <clipping_planes_fragment>

    float seg = clamp(vSegment, 0.0, 1.0);
    float invSq = pow(1.0 / (1.0 + pow(max(seg, 1e-4), uFalloffBase)), uFalloffExponent);
    float nearFar = mix(uNearBrightness, uFarBrightness, seg);
    float brightness = max(nearFar, 0.0) * invSq * max(vInstanceBrightness, 0.0);
    vec3 finalColor = brightness * vInstanceColor;

    gl_FragColor = vec4(finalColor, clamp(brightness, 0.0, 1.0));

    #include <logdepthbuf_fragment>
    #include <fog_fragment>
  }
`;

function buildBeamUniforms(): ShaderMaterialParameters['uniforms'] {
  const { nearBrightness, farBrightness, falloffExponent, falloffBase } = PROJECTILE_BEAM_SHADER_CONFIG;
  return UniformsUtils.clone({
    uNearBrightness: { value: nearBrightness },
    uFarBrightness: { value: farBrightness },
    uFalloffExponent: { value: falloffExponent },
    uFalloffBase: { value: falloffBase },
  });
}

export function createBeamLaserShaderMaterial(): ShaderMaterial {
  const material = new ShaderMaterial({
    uniforms: buildBeamUniforms(),
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    toneMapped: false,
  });

  material.name = 'beam-laser-shader';
  material.vertexColors = true;
  material.uniformsNeedUpdate = true;
  (material as any).userData = {
    ...(material as any).userData,
    __copilot_forceColorWrite: true,
  };

  return material;
}

export const BeamLaserMaterial: React.FC = () => {
  const material = useMemo(() => createBeamLaserShaderMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" />;
};
