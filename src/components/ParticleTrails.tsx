import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  SphereGeometry,
  Vector3,
  Color,
  Box3,
  Mesh,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  ShaderMaterial,
  DynamicDrawUsage,
  AdditiveBlending,
} from 'three';
import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SHIP_MODEL_PATHS } from '../assets/ships.js';
import type { ShipEntity } from '../types/index.js';
import type { ShipHull } from '../types/index.js';
import { THRUSTER_GLOW_CONFIG, PARTICLE_TRAILS_CONFIG } from '../config/renderer.js';
import type { ParticleTrailsConfig } from '../config/renderer.js';
import { SeededRng } from '../utils/rng.js';

interface ParticleTrailProps {
  ships: ShipEntity[];
  /** Optional GPU resources for testing */
  resources?: ParticleTrailResources;
}

const TRAIL_RNG_SEED = 0x54524149; // 'TRAI'

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
  config: Pick<ParticleTrailsConfig, 'color' | 'opacity' | 'additiveBlending' | 'depthTest' | 'depthWrite'>,
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
  config: Pick<ParticleTrailsConfig, 'size' | 'color' | 'opacity' | 'additiveBlending' | 'depthTest' | 'depthWrite'>,
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

/**
 * Simple particle trail system for ship thrusters.
 * Spawns small particles from ship thruster anchors that fade out over time.
 */
export function ParticleTrails({ ships, resources }: ParticleTrailProps): React.ReactElement {
  if (!PARTICLE_TRAILS_CONFIG.enabled) return <></>;

  const meshRef = useRef<Mesh<InstancedBufferGeometry, ShaderMaterial>>(null);
  const nextParticleIndex = useRef(0);
  const filledCount = useRef(0);
  const rngRef = useRef(new SeededRng(TRAIL_RNG_SEED));
  const spawnRemainders = useRef<Map<number, number[]>>(new Map());
  const anchorCache = useRef<Map<number, Vector3[]>>(new Map());
  const backward = useMemo(() => new Vector3(), []);

  const ownsResources = resources == null;
  const trailResources = useMemo(() => {
    if (resources) return resources;
    return createParticleTrailResources(PARTICLE_TRAILS_CONFIG.maxParticles, {
      size: PARTICLE_TRAILS_CONFIG.size,
      color: PARTICLE_TRAILS_CONFIG.color || THRUSTER_GLOW_CONFIG.defaultEmissiveColor,
      opacity: PARTICLE_TRAILS_CONFIG.opacity,
      additiveBlending: PARTICLE_TRAILS_CONFIG.additiveBlending,
      depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
      depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
    });
  }, [resources]);

  useEffect(() => {
    if (!ownsResources) return;
    return () => {
      trailResources.geometry.dispose();
      trailResources.material.dispose();
    };
  }, [ownsResources, trailResources]);

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.visible = false;
    }
  }, []);

  const gltfFighter = useGLTF(SHIP_MODEL_PATHS.fighter) as GLTF;
  const gltfCorvette = useGLTF(SHIP_MODEL_PATHS.corvette) as GLTF;
  const gltfFrigate = useGLTF(SHIP_MODEL_PATHS.frigate) as GLTF;
  const gltfDestroyer = useGLTF(SHIP_MODEL_PATHS.destroyer) as GLTF;
  const gltfCarrier = useGLTF(SHIP_MODEL_PATHS.carrier) as GLTF;

  const anchorLocalsByHull = useMemo(() => {
    const makeAnchors = (gltf: GLTF | null, hull: ShipHull): Vector3[] => {
      if (!gltf?.scene) return [];
      gltf.scene.updateMatrixWorld(true);
      const box = new Box3().setFromObject(gltf.scene);
      const size = box.getSize(new Vector3());
      const count = THRUSTER_GLOW_CONFIG.anchorsByHull[hull] || 1;
      const tailZ = box.min.z - THRUSTER_GLOW_CONFIG.tailOffset * size.z;
      const anchors: Vector3[] = [];
      for (let i = 0; i < count; i++) {
        let x = 0;
        let y = 0;
        if (count === 2) {
          x = (i === 0 ? -1 : 1) * 0.3 * size.x;
        } else if (count === 4) {
          x = (i % 2 === 0 ? -1 : 1) * 0.25 * size.x;
          y = (i < 2 ? -1 : 1) * 0.15 * size.y;
        } else if (count === 6) {
          x = (i % 2 === 0 ? -1 : 1) * 0.35 * size.x;
          y = (Math.floor(i / 2) - 1) * 0.2 * size.y;
        }
        anchors.push(new Vector3(x, y, tailZ));
      }
      return anchors;
    };

    return new Map<ShipHull, Vector3[]>([
      ['fighter', makeAnchors(gltfFighter, 'fighter')],
      ['corvette', makeAnchors(gltfCorvette, 'corvette')],
      ['frigate', makeAnchors(gltfFrigate, 'frigate')],
      ['destroyer', makeAnchors(gltfDestroyer, 'destroyer')],
      ['carrier', makeAnchors(gltfCarrier, 'carrier')],
    ]);
  }, [gltfFighter, gltfCorvette, gltfFrigate, gltfDestroyer, gltfCarrier]);

  const computeThrusterAnchorsWorld = (ship: ShipEntity): Vector3[] => {
    const locals = anchorLocalsByHull.get(ship.ship.hull);
    const cache = anchorCache.current;
    const desiredCount = locals && locals.length > 0 ? locals.length : THRUSTER_GLOW_CONFIG.anchorsByHull[ship.ship.hull] || 1;
    let anchors = cache.get(ship.id);
    if (!anchors || anchors.length !== desiredCount) {
      anchors = Array.from({ length: desiredCount }, () => new Vector3());
      cache.set(ship.id, anchors);
    }

    if (!locals || locals.length === 0) {
      const shipSize = { x: 2, y: 1, z: 3 };
      const tailZ = -shipSize.z * PARTICLE_TRAILS_CONFIG.tailZFactor;
      for (let i = 0; i < desiredCount; i++) {
        let x = 0;
        let y = 0;
        if (desiredCount === 2) {
          x = (i === 0 ? -1 : 1) * 0.3 * shipSize.x;
        } else if (desiredCount === 4) {
          x = (i % 2 === 0 ? -1 : 1) * 0.25 * shipSize.x;
          y = (i < 2 ? -1 : 1) * 0.15 * shipSize.y;
        } else if (desiredCount === 6) {
          x = (i % 2 === 0 ? -1 : 1) * 0.35 * shipSize.x;
          y = (Math.floor(i / 2) - 1) * 0.2 * shipSize.y;
        }

        anchors[i]
          .set(x, y, tailZ)
          .multiplyScalar(ship.transform.scale)
          .applyQuaternion(ship.transform.rotation)
          .add(ship.transform.position);
      }
      return anchors;
    }

    for (let i = 0; i < locals.length; i++) {
      anchors[i]
        .copy(locals[i])
        .multiplyScalar(ship.transform.scale)
        .applyQuaternion(ship.transform.rotation)
        .add(ship.transform.position);
    }

    return anchors;
  };

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const time = state.clock.getElapsedTime();
    trailResources.material.uniforms.uTime.value = time;

    const spawnRatePerAnchor = PARTICLE_TRAILS_CONFIG.spawnRatePerAnchor;
    const minThrottle = PARTICLE_TRAILS_CONFIG.minThrottle;
    const backwardMin = PARTICLE_TRAILS_CONFIG.backwardSpeed.min;
    const backwardMax = PARTICLE_TRAILS_CONFIG.backwardSpeed.max;
    const lateralJitter = PARTICLE_TRAILS_CONFIG.lateralJitter;
    const longitudinalJitter = PARTICLE_TRAILS_CONFIG.longitudinalJitter;
    const scaleJitter = PARTICLE_TRAILS_CONFIG.scaleJitter;
    const lifetimeBase = PARTICLE_TRAILS_CONFIG.lifetime;
    const maxParticles = PARTICLE_TRAILS_CONFIG.maxParticles;

    const activeShipIds = new Set<number>();
    let spawnedThisFrame = false;

    for (const ship of ships) {
      activeShipIds.add(ship.id);
      const throttle = ship.ai?.command?.thrust ?? 0;
      if (throttle < minThrottle) continue;

      const anchors = computeThrusterAnchorsWorld(ship);
      if (anchors.length === 0) continue;

      const remainderForShip = (() => {
        const existing = spawnRemainders.current.get(ship.id);
        if (existing && existing.length === anchors.length) {
          return existing;
        }
        const arr = new Array<number>(anchors.length).fill(0);
        spawnRemainders.current.set(ship.id, arr);
        return arr;
      })();

      for (let i = 0; i < anchors.length; i++) {
        const anchor = anchors[i];
        const rate = throttle * spawnRatePerAnchor;
        const desired = rate * delta + remainderForShip[i];
        const spawnCount = Math.floor(desired);
        remainderForShip[i] = desired - spawnCount;
        if (spawnCount <= 0) continue;
        spawnedThisFrame = true;

        for (let spawnIndex = 0; spawnIndex < spawnCount; spawnIndex++) {
          const idx = nextParticleIndex.current;
          const base3 = idx * 3;

          trailResources.arrays.spawnPosition[base3] = anchor.x;
          trailResources.arrays.spawnPosition[base3 + 1] = anchor.y;
          trailResources.arrays.spawnPosition[base3 + 2] = anchor.z;

          backward.set(0, 0, -1).applyQuaternion(ship.transform.rotation);
          const speed = backwardMin + rngRef.current.next() * (backwardMax - backwardMin);
          const jitterX = (rngRef.current.next() - 0.5) * 2 * lateralJitter;
          const jitterY = (rngRef.current.next() - 0.5) * 2 * lateralJitter;
          const jitterZ = (rngRef.current.next() - 0.5) * 2 * longitudinalJitter;

          trailResources.arrays.velocity[base3] = backward.x * speed + jitterX;
          trailResources.arrays.velocity[base3 + 1] = backward.y * speed + jitterY;
          trailResources.arrays.velocity[base3 + 2] = backward.z * speed + jitterZ;

          const lifetimeJitter = 1 - scaleJitter + rngRef.current.next() * 2 * scaleJitter;
          trailResources.arrays.lifetime[idx] = lifetimeBase * lifetimeJitter;
          trailResources.arrays.spawnTime[idx] = time;
          trailResources.arrays.scale[idx] = 1 - scaleJitter + rngRef.current.next() * 2 * scaleJitter;

          nextParticleIndex.current = (nextParticleIndex.current + 1) % maxParticles;
          if (filledCount.current < maxParticles) {
            filledCount.current++;
          }
        }
      }
    }

    for (const [shipId] of spawnRemainders.current) {
      if (!activeShipIds.has(shipId)) {
        spawnRemainders.current.delete(shipId);
      }
    }
    for (const [shipId] of anchorCache.current) {
      if (!activeShipIds.has(shipId)) {
        anchorCache.current.delete(shipId);
      }
    }

    if (spawnedThisFrame) {
      trailResources.attributes.spawnPosition.needsUpdate = true;
      trailResources.attributes.velocity.needsUpdate = true;
      trailResources.attributes.spawnTime.needsUpdate = true;
      trailResources.attributes.lifetime.needsUpdate = true;
      trailResources.attributes.scale.needsUpdate = true;
    }

    trailResources.geometry.instanceCount = filledCount.current;
    mesh.visible = filledCount.current > 0;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={trailResources.geometry}
      material={trailResources.material}
      frustumCulled={false}
    />
  );
}
