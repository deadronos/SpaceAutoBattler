import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Mesh, InstancedBufferGeometry, ShaderMaterial, Frustum, Matrix4 } from 'three';
import type { ShipEntity } from '../types/index.js';
import { THRUSTER_GLOW_CONFIG, PARTICLE_TRAILS_CONFIG } from '../config/effects.js';
import { SeededRng } from '../utils/rng.js';
import {
  createParticleTrailResources,
  disposeParticleTrailResources,
  type ParticleTrailResources,
} from '../renderer/particles/trailResources.js';
import {
  useThrusterAnchors,
  computeThrusterAnchorsWorld as computeAnchorsWorld,
} from '../renderer/particles/useThrusterAnchors.js';

interface ParticleTrailProps {
  ships: ShipEntity[];
  /** Optional GPU resources for testing */
  resources?: ParticleTrailResources;
}

const TRAIL_RNG_SEED = 0x54524149; // 'TRAI'

/**
 * Simple particle trail system for ship thrusters.
 * Spawns small particles from ship thruster anchors that fade out over time.
 *
 * @param {ParticleTrailProps} props - Component properties.
 * @returns {React.ReactElement} The rendered particle system mesh.
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
  const anchorLocalsByHull = useThrusterAnchors();

  // Optimization: Reused objects for culling
  const frustum = useMemo(() => new Frustum(), []);
  const projScreenMatrix = useMemo(() => new Matrix4(), []);
  const camera = useThree((s) => s.camera);

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
      disposeParticleTrailResources(trailResources);
    };
  }, [ownsResources, trailResources]);

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.visible = false;
    }
  }, []);

  const resolveThrusterAnchorsWorld = (ship: ShipEntity): Vector3[] => {
    const locals = anchorLocalsByHull.get(ship.ship.hull);
    const cache = anchorCache.current;
    const desiredCount =
      locals && locals.length > 0
        ? locals.length
        : THRUSTER_GLOW_CONFIG.anchorsByHull[ship.ship.hull] || 1;
    let anchors = cache.get(ship.id);
    if (!anchors || anchors.length !== desiredCount) {
      anchors = Array.from({ length: desiredCount }, () => new Vector3());
      cache.set(ship.id, anchors);
    }

    return computeAnchorsWorld(
      ship,
      locals,
      anchors,
      desiredCount,
      PARTICLE_TRAILS_CONFIG.tailZFactor,
    );
  };

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const time = state.clock.getElapsedTime();
    if (trailResources.material.uniforms.uTime) {
      trailResources.material.uniforms.uTime.value = time;
    }

    // Update Frustum
    // We update every frame because the camera moves
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);

    const spawnRatePerAnchor = PARTICLE_TRAILS_CONFIG.spawnRatePerAnchor;
    const minThrottle = PARTICLE_TRAILS_CONFIG.minThrottle;
    const backwardMin = PARTICLE_TRAILS_CONFIG.backwardSpeed.min;
    const backwardMax = PARTICLE_TRAILS_CONFIG.backwardSpeed.max;
    const lateralJitter = PARTICLE_TRAILS_CONFIG.lateralJitter;
    const longitudinalJitter = PARTICLE_TRAILS_CONFIG.longitudinalJitter;
    const scaleJitter = PARTICLE_TRAILS_CONFIG.scaleJitter;
    const lifetimeBase = PARTICLE_TRAILS_CONFIG.lifetime;
    const maxParticles = PARTICLE_TRAILS_CONFIG.maxParticles;

    // LOD Settings
    const LOD_DISTANCE_SQ = 500 * 500; // Distance squared for LOD culling (500 units)
    const cameraPos = camera.position;

    const activeShipIds = new Set<number>();
    let spawnedThisFrame = false;

    for (const ship of ships) {
      activeShipIds.add(ship.id);
      const throttle = ship.ai?.command?.thrust ?? 0;
      if (throttle < minThrottle) continue;

      const shipPos = ship.transform.position;

      // 1. Distance LOD
      const distSq = cameraPos.distanceToSquared(shipPos);
      if (distSq > LOD_DISTANCE_SQ) {
        continue;
      }

      // 2. Frustum Culling
      // Simple check: is the ship position within the frustum?
      // We could add a radius to containsPoint for better accuracy, but point check is faster
      // and "good enough" for trails usually.
      if (!frustum.containsPoint(shipPos)) {
        continue;
      }

      const anchors = resolveThrusterAnchorsWorld(ship);
      if (anchors.length === 0) continue;

      const remainderForShip = (() => {
        const existing = spawnRemainders.current.get(ship.id);
        if (existing && existing.length === anchors.length) {
          return existing;
        }
        const arr = Array.from({ length: anchors.length }, () => 0);
        spawnRemainders.current.set(ship.id, arr);
        return arr;
      })();

      for (let i = 0; i < anchors.length; i++) {
        const anchor = anchors[i];
        if (!anchor) continue;
        const rate = throttle * spawnRatePerAnchor;
        const remainder = remainderForShip[i] ?? 0;
        const desired = rate * delta + remainder;
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
          trailResources.arrays.scale[idx] =
            1 - scaleJitter + rngRef.current.next() * 2 * scaleJitter;

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
