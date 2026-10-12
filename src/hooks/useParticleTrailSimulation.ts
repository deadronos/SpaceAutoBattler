import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Frustum, InstancedBufferGeometry, Matrix4, Mesh, ShaderMaterial, Vector3 } from 'three';
import type { ShipEntity } from '../types/index.js';
import { PARTICLE_TRAILS_CONFIG, THRUSTER_GLOW_CONFIG } from '../config/effects.js';
import { useUiStore } from '../app/uiStore.js';
import { usePrefersReducedMotion } from './usePrefersReducedMotion.js';
import { SeededRng } from '../utils/rng.js';
import type { ParticleTrailResources } from '../renderer/particles/trailResources.js';
import {
  useThrusterAnchors,
  computeThrusterAnchorsWorld as computeAnchorsWorld,
} from '../renderer/particles/useThrusterAnchors.js';
import { markAttributeUpdateRange } from '../renderer/particles/trailUpdateRanges.js';

const TRAIL_RNG_SEED = 0x54524149; // 'TRAI'

/**
 * Per-frame particle trail simulation for ship thrusters.
 * Owns the trail instance buffers' spawn bookkeeping, anchor caches, and RNG state.
 *
 * @param {ShipEntity[]} ships - Ships to emit trails for.
 * @param {ParticleTrailResources} trailResources - GPU resources backing the trail instances.
 * @param {number} [spawnRatePerAnchor] - Particles/sec per anchor at full throttle. Defaults to the
 *   shipped `PARTICLE_TRAILS_CONFIG.spawnRatePerAnchor` (the `high` quality baseline).
 * @returns {React.RefObject<Mesh<InstancedBufferGeometry, ShaderMaterial> | null>} Ref to the trail mesh.
 */
export function useParticleTrailSimulation(
  ships: ShipEntity[],
  trailResources: ParticleTrailResources,
  spawnRatePerAnchor: number = PARTICLE_TRAILS_CONFIG.spawnRatePerAnchor,
): React.RefObject<Mesh<InstancedBufferGeometry, ShaderMaterial> | null> {
  const meshRef = useRef<Mesh<InstancedBufferGeometry, ShaderMaterial>>(null);
  const nextParticleIndex = useRef(0);
  const filledCount = useRef(0);
  const rngRef = useRef(new SeededRng(TRAIL_RNG_SEED));
  const spawnRemainders = useRef<Map<number, number[]>>(new Map());
  const anchorCache = useRef<Map<number, Vector3[]>>(new Map());
  const activeShipIdsRef = useRef<Set<number>>(new Set());
  const backward = useMemo(() => new Vector3(), []);
  const anchorLocalsByHull = useThrusterAnchors();

  // Optimization: Reused objects for culling
  const frustum = useMemo(() => new Frustum(), []);
  const projScreenMatrix = useMemo(() => new Matrix4(), []);
  const camera = useThree((s) => s.camera);

  const paused = useUiStore((s) => s.paused);
  const reducedMotion = usePrefersReducedMotion();
  const lastTimeRef = useRef(0);
  const accumulatedTimeRef = useRef(0);

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

    const elapsed = state.clock.getElapsedTime();
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = elapsed;
      accumulatedTimeRef.current = elapsed;
    }
    const d = elapsed - lastTimeRef.current;
    lastTimeRef.current = elapsed;
    if (!paused && !reducedMotion) {
      accumulatedTimeRef.current += d;
    }

    if (trailResources.material.uniforms.uTime) {
      trailResources.material.uniforms.uTime.value = accumulatedTimeRef.current;
    }

    // Update Frustum
    // We update every frame because the camera moves
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);

    const minThrottle = PARTICLE_TRAILS_CONFIG.minThrottle;
    const backwardMin = PARTICLE_TRAILS_CONFIG.backwardSpeed.min;
    const backwardMax = PARTICLE_TRAILS_CONFIG.backwardSpeed.max;
    const lateralJitter = PARTICLE_TRAILS_CONFIG.lateralJitter;
    const longitudinalJitter = PARTICLE_TRAILS_CONFIG.longitudinalJitter;
    const scaleJitter = PARTICLE_TRAILS_CONFIG.scaleJitter;
    const lifetimeBase = PARTICLE_TRAILS_CONFIG.lifetime;
    const maxParticles = trailResources.arrays.spawnTime.length;

    // LOD Settings
    const LOD_DISTANCE_SQ = 500 * 500; // Distance squared for LOD culling (500 units)
    const cameraPos = camera.position;

    const activeShipIds = activeShipIdsRef.current;
    activeShipIds.clear();
    let frameFirstParticleIndex = -1;
    let spawnedParticleCount = 0;

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

      // Ship rotation is constant across its anchors/spawns this frame, so
      // compute the backward direction once per ship instead of per particle.
      backward.set(0, 0, -1).applyQuaternion(ship.transform.rotation);

      let remainderForShip = spawnRemainders.current.get(ship.id);
      if (!remainderForShip || remainderForShip.length !== anchors.length) {
        remainderForShip = Array.from({ length: anchors.length }, () => 0);
        spawnRemainders.current.set(ship.id, remainderForShip);
      }

      for (let i = 0; i < anchors.length; i++) {
        const anchor = anchors[i];
        if (!anchor) continue;
        const rate = throttle * spawnRatePerAnchor;
        const remainder = remainderForShip[i] ?? 0;
        // WCAG 2.3.3: with reduced motion requested, feed a zero delta so the
        // spawn loop emits nothing while the frustum/LOD and remainder
        // bookkeeping continue to run and instanceCount stays stable.
        const actualDelta = paused || reducedMotion ? 0 : delta;
        const desired = rate * actualDelta + remainder;
        const spawnCount = Math.floor(desired);
        remainderForShip[i] = desired - spawnCount;
        if (spawnCount <= 0) continue;

        for (let spawnIndex = 0; spawnIndex < spawnCount; spawnIndex++) {
          const idx = nextParticleIndex.current;
          if (frameFirstParticleIndex === -1) {
            frameFirstParticleIndex = idx;
          }
          spawnedParticleCount++;
          const base3 = idx * 3;

          trailResources.arrays.spawnPosition[base3] = anchor.x;
          trailResources.arrays.spawnPosition[base3 + 1] = anchor.y;
          trailResources.arrays.spawnPosition[base3 + 2] = anchor.z;

          const speed = backwardMin + rngRef.current.next() * (backwardMax - backwardMin);
          const jitterX = (rngRef.current.next() - 0.5) * 2 * lateralJitter;
          const jitterY = (rngRef.current.next() - 0.5) * 2 * lateralJitter;
          const jitterZ = (rngRef.current.next() - 0.5) * 2 * longitudinalJitter;

          trailResources.arrays.velocity[base3] = backward.x * speed + jitterX;
          trailResources.arrays.velocity[base3 + 1] = backward.y * speed + jitterY;
          trailResources.arrays.velocity[base3 + 2] = backward.z * speed + jitterZ;

          const lifetimeJitter = 1 - scaleJitter + rngRef.current.next() * 2 * scaleJitter;
          trailResources.arrays.lifetime[idx] = lifetimeBase * lifetimeJitter;
          trailResources.arrays.spawnTime[idx] = accumulatedTimeRef.current;
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

    if (spawnedParticleCount > 0 && frameFirstParticleIndex !== -1) {
      markAttributeUpdateRange(
        3,
        frameFirstParticleIndex,
        spawnedParticleCount,
        maxParticles,
        trailResources.attributes.spawnPosition,
      );
      markAttributeUpdateRange(
        3,
        frameFirstParticleIndex,
        spawnedParticleCount,
        maxParticles,
        trailResources.attributes.velocity,
      );
      markAttributeUpdateRange(
        1,
        frameFirstParticleIndex,
        spawnedParticleCount,
        maxParticles,
        trailResources.attributes.spawnTime,
      );
      markAttributeUpdateRange(
        1,
        frameFirstParticleIndex,
        spawnedParticleCount,
        maxParticles,
        trailResources.attributes.lifetime,
      );
      markAttributeUpdateRange(
        1,
        frameFirstParticleIndex,
        spawnedParticleCount,
        maxParticles,
        trailResources.attributes.scale,
      );
    }

    trailResources.geometry.instanceCount = filledCount.current;
    mesh.visible = filledCount.current > 0;
  });

  return meshRef;
}
