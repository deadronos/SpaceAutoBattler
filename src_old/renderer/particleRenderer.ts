import * as THREE from 'three';
import type { GameState } from '../types/index.js';
import { RendererConfig } from '../config/rendererConfig.js';
import { ensureParticleSystem, type Vec3 } from './particleSystem.js';
import {
  billboardExplosionVertexShader,
  billboardExplosionFragmentShader,
  DefaultBillboardExplosionParams,
  hexToVec3,
} from './shaders/billboardExplosionShader.js';
import { setTextureNeedsUpdateThrottled } from './textureThrottle.js';

export interface ParticleRendererInitOptions {
  state: GameState;
  scene: THREE.Scene;
}

type ParticleRenderInstance = {
  id: number;
  pos: Vec3;
  size: number;
  age: number;
  lifetime: number;
  color: string;
};

interface ParticleAttributes {
  position: THREE.InstancedBufferAttribute;
  size: THREE.InstancedBufferAttribute;
  color: THREE.InstancedBufferAttribute;
  age: THREE.InstancedBufferAttribute;
  lifetime: THREE.InstancedBufferAttribute;
  seed: THREE.InstancedBufferAttribute;
}

interface ParticleRendererResources {
  state: GameState;
  scene: THREE.Scene;
  mesh: THREE.InstancedMesh;
  material: THREE.ShaderMaterial;
  geometry: THREE.BufferGeometry;
  attributes: ParticleAttributes;
  capacity: number;
  maxCapacity: number;
  texture: THREE.Texture;
  fallbackTexture: THREE.Texture;
  activeCount: number;
}

let resources: ParticleRendererResources | null = null;

function createFallbackTexture(): THREE.Texture {
  const data = new Uint8Array([255, 255, 255, 255]);
  const texture = new THREE.DataTexture(data, 1, 1);
  setTextureNeedsUpdateThrottled(texture);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function ensureThreeTexture(source: unknown): THREE.Texture | null {
  if (source instanceof THREE.Texture) return source;

  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
  const tex = new THREE.Texture(source);
  setTextureNeedsUpdateThrottled(tex);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
  const tex = new THREE.Texture(source);
  setTextureNeedsUpdateThrottled(tex);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  if (typeof ImageData !== 'undefined' && source instanceof ImageData) {
  const tex = new THREE.DataTexture(source.data, source.width, source.height);
  setTextureNeedsUpdateThrottled(tex);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  return null;
}

function resolveExplosionTexture(state: GameState, fallback: THREE.Texture): THREE.Texture {
  const pool = state.assetPool;
  const preferredKeys = [
    'textures/explosionSoftCircleTexture',
    'textures/explosionSoftCircle',
    'textures/particle-explosion',
  ];

  for (const key of preferredKeys) {
    const candidate = pool?.get(key);
    if (!candidate) continue;
    const tex = ensureThreeTexture(candidate);
    if (tex) {
      pool?.set('textures/explosionSoftCircleTexture', tex);
      return tex;
    }
  }

  return fallback;
}

function createMaterial(texture: THREE.Texture): THREE.ShaderMaterial {
  const configuredColors = RendererConfig.particles.explosion.colors;
  const colorStops = [...configuredColors];
  while (colorStops.length < 3) {
    colorStops.push(colorStops[colorStops.length - 1] ?? '#ffffff');
  }

  const [color1, color2, color3] = colorStops.slice(0, 3).map((hex) => hexToVec3(hex));

  return new THREE.ShaderMaterial({
    uniforms: {
      billboardScale: { value: DefaultBillboardExplosionParams.billboardScale },
      fadeInDuration: { value: DefaultBillboardExplosionParams.fadeInDuration },
      fadeOutStart: { value: DefaultBillboardExplosionParams.fadeOutStart },
      softEdgePower: { value: DefaultBillboardExplosionParams.softEdgePower },
      colorIntensity: { value: DefaultBillboardExplosionParams.colorIntensity },
      glowIntensity: { value: DefaultBillboardExplosionParams.glowIntensity },
      glowFalloff: { value: DefaultBillboardExplosionParams.glowFalloff },
      rimLocation: { value: DefaultBillboardExplosionParams.rimLocation },
      rimSharpness: { value: DefaultBillboardExplosionParams.rimSharpness },
      heatExponent: { value: DefaultBillboardExplosionParams.heatExponent },
      pulseFrequency: { value: DefaultBillboardExplosionParams.pulseFrequency },
      pulseAmplitude: { value: DefaultBillboardExplosionParams.pulseAmplitude },
      sparkleIntensity: { value: DefaultBillboardExplosionParams.sparkleIntensity },
      alphaMultiplier: { value: DefaultBillboardExplosionParams.alphaMultiplier },
      colorStop1: { value: new THREE.Vector3(...color1) },
      colorStop2: { value: new THREE.Vector3(...color2) },
      colorStop3: { value: new THREE.Vector3(...color3) },
      colorStop1Pos: { value: DefaultBillboardExplosionParams.colorStop1Pos },
      colorStop2Pos: { value: DefaultBillboardExplosionParams.colorStop2Pos },
      colorStop3Pos: { value: DefaultBillboardExplosionParams.colorStop3Pos },
      minAlpha: { value: DefaultBillboardExplosionParams.minAlpha },
      explosionTexture: { value: texture },
    },
    vertexShader: billboardExplosionVertexShader,
    fragmentShader: billboardExplosionFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });
}

function createGeometry(capacity: number): {
  geometry: THREE.BufferGeometry;
  attributes: ParticleAttributes;
} {
  const baseGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = baseGeometry.index;
  geometry.setAttribute('position', baseGeometry.getAttribute('position'));
  geometry.setAttribute('uv', baseGeometry.getAttribute('uv'));

  const position = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  const size = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  const color = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  const age = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  const lifetime = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  const seed = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);

  position.setUsage(THREE.DynamicDrawUsage);
  size.setUsage(THREE.DynamicDrawUsage);
  color.setUsage(THREE.DynamicDrawUsage);
  age.setUsage(THREE.DynamicDrawUsage);
  lifetime.setUsage(THREE.DynamicDrawUsage);
  seed.setUsage(THREE.DynamicDrawUsage);

  geometry.setAttribute('instancePosition', position);
  geometry.setAttribute('instanceSize', size);
  geometry.setAttribute('instanceColor', color);
  geometry.setAttribute('instanceAge', age);
  geometry.setAttribute('instanceLifetime', lifetime);
  geometry.setAttribute('instanceSeed', seed);

  baseGeometry.dispose();

  return {
    geometry,
    attributes: { position, size, color, age, lifetime, seed },
  };
}

function buildMesh(
  capacity: number,
  material: THREE.ShaderMaterial,
): { mesh: THREE.InstancedMesh; geometry: THREE.BufferGeometry; attributes: ParticleAttributes } {
  const { geometry, attributes } = createGeometry(capacity);
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.visible = false;
  return { mesh, geometry, attributes };
}

function ensureCapacity(desired: number) {
  if (!resources) return;
  if (desired <= resources.capacity) return;
  const next = Math.min(
    resources.maxCapacity,
    Math.max(desired, Math.ceil(resources.capacity * 1.5)),
  );
  if (next <= resources.capacity) return;

  const { scene, mesh: oldMesh, material } = resources;
  const rebuilt = buildMesh(next, material);
  scene.add(rebuilt.mesh);
  scene.remove(oldMesh);
  try {
    oldMesh.dispose();
  } catch {
    /* ignore */
  }

  resources.mesh = rebuilt.mesh;
  resources.geometry = rebuilt.geometry;
  resources.attributes = rebuilt.attributes;
  resources.capacity = next;
  resources.activeCount = 0;
}

function writeInstanceData(instances: ReadonlyArray<ParticleRenderInstance>) {
  if (!resources) return;
  ensureCapacity(instances.length);
  const { attributes } = resources;
  const capacity = resources.capacity;
  const count = Math.min(instances.length, capacity);

  const positionArray = attributes.position.array as Float32Array;
  const sizeArray = attributes.size.array as Float32Array;
  const colorArray = attributes.color.array as Float32Array;
  const ageArray = attributes.age.array as Float32Array;
  const lifetimeArray = attributes.lifetime.array as Float32Array;
  const seedArray = attributes.seed.array as Float32Array;

  for (let i = 0; i < count; i++) {
    const instance = instances[i];
    const base = i * 3;
    positionArray[base] = instance.pos.x;
    positionArray[base + 1] = instance.pos.y;
    positionArray[base + 2] = instance.pos.z;

    sizeArray[i] = instance.size;

    const colorIndex = i * 4;
    const [r, g, b] = hexToVec3(instance.color ?? '#ffffff');
    colorArray[colorIndex] = r;
    colorArray[colorIndex + 1] = g;
    colorArray[colorIndex + 2] = b;
    colorArray[colorIndex + 3] = 1.0;

    ageArray[i] = instance.age ?? 0;
    lifetimeArray[i] = instance.lifetime ?? 1;

    const rawSeed = Math.sin(instance.id * 12.9898) * 43758.5453;
    const normalizedSeed = rawSeed - Math.floor(rawSeed);
    seedArray[i] = normalizedSeed;
  }

  attributes.position.needsUpdate = true;
  attributes.size.needsUpdate = true;
  attributes.color.needsUpdate = true;
  attributes.age.needsUpdate = true;
  attributes.lifetime.needsUpdate = true;
  attributes.seed.needsUpdate = true;

  resources.mesh.count = count;
  resources.mesh.visible = count > 0;
  resources.activeCount = count;
}

export function initParticleRenderer(options: ParticleRendererInitOptions) {
  if (resources) {
    resources.state = options.state;
    return;
  }

  if (!RendererConfig.visual.enableParticles || !RendererConfig.particles.explosion.enabled) {
    return;
  }

  const fallbackTexture = createFallbackTexture();
  const texture = resolveExplosionTexture(options.state, fallbackTexture);
  const material = createMaterial(texture);

  const initialCapacity = RendererConfig.particles.explosion.pooling.initial;
  const maxCapacity = RendererConfig.particles.explosion.pooling.growTo;
  const { mesh, geometry, attributes } = buildMesh(initialCapacity, material);

  options.scene.add(mesh);

  resources = {
    state: options.state,
    scene: options.scene,
    mesh,
    material,
    geometry,
    attributes,
    capacity: initialCapacity,
    maxCapacity,
    texture,
    fallbackTexture,
    activeCount: 0,
  };
}

export function renderParticleSystem(delta: number) {
  if (!resources) return;
  if (!RendererConfig.visual.enableParticles || !RendererConfig.particles.explosion.enabled) {
    resources.mesh.visible = false;
    return;
  }

  if (resources.texture === resources.fallbackTexture) {
    try {
      const refreshed = resolveExplosionTexture(resources.state, resources.fallbackTexture);
      if (refreshed !== resources.texture) {
        resources.texture = refreshed;
        try {
          const uniforms = resources.material.uniforms as Record<string, { value: unknown }>;
          if (uniforms && uniforms.explosionTexture) {
            uniforms.explosionTexture.value = refreshed;
          }
        } catch {
          /* ignore uniform update failure */
        }
      }
    } catch {
      /* ignore texture refresh errors */
    }
  }

  let system;
  try {
    system = ensureParticleSystem(resources.state);
  } catch {
    return;
  }

  try {
    system.update(delta);
  } catch {
    return;
  }

  let instances: ParticleRenderInstance[] = [];
  try {
    instances = system.getActiveInstances() as ParticleRenderInstance[];
  } catch {
    instances = [];
  }

  writeInstanceData(instances);
}

export function disposeParticleRenderer() {
  if (!resources) return;
  try {
    resources.scene.remove(resources.mesh);
  } catch {
    /* ignore */
  }
  try {
    resources.mesh.dispose();
  } catch {
    /* ignore */
  }
  try {
    resources.geometry.dispose();
  } catch {
    /* ignore */
  }
  try {
    resources.material.dispose();
  } catch {
    /* ignore */
  }
  try {
    resources.fallbackTexture.dispose();
  } catch {
    /* ignore */
  }
  resources = null;
}
