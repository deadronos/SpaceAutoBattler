import {
  SphereGeometry,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  ShaderMaterial,
  DynamicDrawUsage,
  AdditiveBlending,
  Color,
} from 'three';
import type { ParticleTrailsConfig } from '../../config/effects.js';
import { THRUSTER_GLOW_CONFIG } from '../../config/effects.js';

export interface ParticleTrailResources {
  geometry: InstancedBufferGeometry;
  material: ShaderMaterial;
  attributes: {
    spawnPosition: InstancedBufferAttribute;
    velocity: InstancedBufferAttribute;
    spawnTime: InstancedBufferAttribute;
    lifetime: InstancedBufferAttribute;
    scale: InstancedBufferAttribute;
  };
  arrays: {
    spawnPosition: Float32Array;
    velocity: Float32Array;
    spawnTime: Float32Array;
    lifetime: Float32Array;
    scale: Float32Array;
  };
}

function createTrailMaterial(
  config: Pick<
    ParticleTrailsConfig,
    'color' | 'opacity' | 'additiveBlending' | 'depthTest' | 'depthWrite'
  >,
): ShaderMaterial {
  const color = new Color(config.color || THRUSTER_GLOW_CONFIG.defaultEmissiveColor);

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uOpacity: { value: config.opacity },
    },
    transparent: true,
    depthTest: config.depthTest,
    depthWrite: config.depthWrite,
    vertexShader: /* glsl */ `
      attribute vec3 instanceSpawnPosition;
      attribute vec3 instanceVelocity;
      attribute float instanceSpawnTime;
      attribute float instanceLifetime;
      attribute float instanceScale;

      uniform float uTime;

      varying float vFade;

      void main() {
        float age = max(uTime - instanceSpawnTime, 0.0);
        float lifeRatio = clamp(1.0 - age / max(instanceLifetime, 1e-6), 0.0, 1.0);
        float scale = instanceScale * lifeRatio;
        vec3 worldPosition = instanceSpawnPosition + instanceVelocity * age + position * scale;
        vFade = lifeRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPosition, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;

      varying float vFade;

      void main() {
        float alpha = uOpacity * vFade;
        if (alpha <= 0.001) {
          discard;
        }
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });

  if (config.additiveBlending) {
    material.blending = AdditiveBlending;
  }

  return material;
}

export function createParticleTrailResources(
  maxParticles: number,
  config: Pick<
    ParticleTrailsConfig,
    'size' | 'color' | 'opacity' | 'additiveBlending' | 'depthTest' | 'depthWrite'
  >,
): ParticleTrailResources {
  const baseGeometry = new SphereGeometry(config.size, 6, 4);
  const geometry = new InstancedBufferGeometry();
  const positionAttribute = baseGeometry.getAttribute('position');
  geometry.setAttribute('position', positionAttribute.clone());
  const normalAttribute = baseGeometry.getAttribute('normal');
  if (normalAttribute) {
    geometry.setAttribute('normal', normalAttribute.clone());
  }
  const uvAttribute = baseGeometry.getAttribute('uv');
  if (uvAttribute) {
    geometry.setAttribute('uv', uvAttribute.clone());
  }
  const index = baseGeometry.getIndex();
  if (index) {
    geometry.setIndex(index.clone());
  }
  baseGeometry.dispose();
  geometry.instanceCount = 0;

  const spawnPositionArray = new Float32Array(maxParticles * 3);
  const velocityArray = new Float32Array(maxParticles * 3);
  const spawnTimeArray = new Float32Array(maxParticles);
  const lifetimeArray = new Float32Array(maxParticles);
  const scaleArray = new Float32Array(maxParticles);

  const spawnPosition = new InstancedBufferAttribute(spawnPositionArray, 3);
  spawnPosition.setUsage(DynamicDrawUsage);
  const velocity = new InstancedBufferAttribute(velocityArray, 3);
  velocity.setUsage(DynamicDrawUsage);
  const spawnTime = new InstancedBufferAttribute(spawnTimeArray, 1);
  spawnTime.setUsage(DynamicDrawUsage);
  const lifetime = new InstancedBufferAttribute(lifetimeArray, 1);
  lifetime.setUsage(DynamicDrawUsage);
  const scale = new InstancedBufferAttribute(scaleArray, 1);
  scale.setUsage(DynamicDrawUsage);

  geometry.setAttribute('instanceSpawnPosition', spawnPosition);
  geometry.setAttribute('instanceVelocity', velocity);
  geometry.setAttribute('instanceSpawnTime', spawnTime);
  geometry.setAttribute('instanceLifetime', lifetime);
  geometry.setAttribute('instanceScale', scale);
  geometry.computeBoundingSphere();

  const material = createTrailMaterial(config);

  return {
    geometry,
    material,
    attributes: {
      spawnPosition,
      velocity,
      spawnTime,
      lifetime,
      scale,
    },
    arrays: {
      spawnPosition: spawnPositionArray,
      velocity: velocityArray,
      spawnTime: spawnTimeArray,
      lifetime: lifetimeArray,
      scale: scaleArray,
    },
  };
}

export function disposeParticleTrailResources(resources: ParticleTrailResources): void {
  resources.geometry.dispose();
  resources.material.dispose();
}
