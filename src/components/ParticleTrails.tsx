import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { 
  InstancedMesh, 
  SphereGeometry, 
  MeshBasicMaterial, 
  Vector3, 
  Color,
  Object3D,
  Box3,
} from 'three';
import type { ShipEntity } from '../types/index.js';
import { THRUSTER_GLOW_CONFIG, PARTICLE_TRAILS_CONFIG } from '../config/renderer.js';
import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SHIP_MODEL_PATHS } from '../assets/ships.js';
import type { ShipHull } from '../types/index.js';

interface ParticleTrailProps {
  ships: ShipEntity[];
}

interface Particle {
  position: Vector3;
  velocity: Vector3;
  life: number;
  maxLife: number;
  scale: number;
  shipId: number;
}

/**
 * Simple particle trail system for ship thrusters.
 * Spawns small particles from ship thruster anchors that fade out over time.
 */
export function ParticleTrails({ ships }: ParticleTrailProps): React.ReactElement {
  // Early out if globally disabled via config
  if (!PARTICLE_TRAILS_CONFIG.enabled) return <></>;
  const meshRef = useRef<InstancedMesh>(null);
  const particlesRef = useRef<Particle[]>([]);
  const nextParticleIndex = useRef(0);
  const dummy = useMemo(() => new Object3D(), []);
  const tmpVec = useMemo(() => new Vector3(), []);

  // Preload GLTFs for all hulls and compute local anchors from real model bounds.
  // These hooks are unconditional to satisfy the Rules of Hooks.
  const gltfFighter = useGLTF(SHIP_MODEL_PATHS.fighter) as GLTF;
  const gltfCorvette = useGLTF(SHIP_MODEL_PATHS.corvette) as GLTF;
  const gltfFrigate = useGLTF(SHIP_MODEL_PATHS.frigate) as GLTF;
  const gltfDestroyer = useGLTF(SHIP_MODEL_PATHS.destroyer) as GLTF;
  const gltfCarrier = useGLTF(SHIP_MODEL_PATHS.carrier) as GLTF;

  const anchorLocalsByHull = useMemo(() => {
    const makeAnchors = (gltf: GLTF | null, hull: ShipHull): Vector3[] => {
      if (!gltf?.scene) return [];
      // Compute bounding box from the GLTF scene (local space)
      gltf.scene.updateMatrixWorld(true);
      const box = new Box3().setFromObject(gltf.scene);
      const size = box.getSize(new Vector3());
      const count = THRUSTER_GLOW_CONFIG.anchorsByHull[hull] || 1;
      const tailZ = box.min.z - THRUSTER_GLOW_CONFIG.tailOffset * size.z;
      const anchors: Vector3[] = [];
      for (let i = 0; i < count; i++) {
        let x = 0, y = 0;
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
  
  const geometry = useMemo(() => new SphereGeometry(PARTICLE_TRAILS_CONFIG.size, 6, 4), []);
  const material = useMemo(() => {
    const m = new MeshBasicMaterial({
      color: new Color(PARTICLE_TRAILS_CONFIG.color || THRUSTER_GLOW_CONFIG.defaultEmissiveColor),
      transparent: true,
      opacity: PARTICLE_TRAILS_CONFIG.opacity,
      depthTest: PARTICLE_TRAILS_CONFIG.depthTest,
      depthWrite: PARTICLE_TRAILS_CONFIG.depthWrite,
    });
    if (PARTICLE_TRAILS_CONFIG.additiveBlending) {
      // Lazy import enum to avoid direct dependency; numeric value is fine too, but use property if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m as any).blending = 2; // AdditiveBlending
    }
    return m;
  }, []);

  // Initialize particle pool
  useEffect(() => {
    particlesRef.current = Array.from({ length: PARTICLE_TRAILS_CONFIG.maxParticles }, () => ({
      position: new Vector3(),
      velocity: new Vector3(),
      life: 0,
      maxLife: PARTICLE_TRAILS_CONFIG.lifetime,
      scale: 0,
      shipId: 0,
    }));
  }, []);

  const computeThrusterAnchorsWorld = (ship: ShipEntity): Vector3[] => {
    const locals = anchorLocalsByHull.get(ship.ship.hull);
    if (!locals || locals.length === 0) {
      // Fallback to heuristic anchors if GLTF not yet ready
      const count = THRUSTER_GLOW_CONFIG.anchorsByHull[ship.ship.hull] || 1;
      const anchors: Vector3[] = [];
      const shipSize = { x: 2, y: 1, z: 3 };
      const tailZ = -shipSize.z * PARTICLE_TRAILS_CONFIG.tailZFactor;
      for (let i = 0; i < count; i++) {
        let x = 0, y = 0;
        if (count === 2) x = (i === 0 ? -1 : 1) * 0.3 * shipSize.x;
        else if (count === 4) { x = (i % 2 === 0 ? -1 : 1) * 0.25 * shipSize.x; y = (i < 2 ? -1 : 1) * 0.15 * shipSize.y; }
        else if (count === 6) { x = (i % 2 === 0 ? -1 : 1) * 0.35 * shipSize.x; y = (Math.floor(i / 2) - 1) * 0.2 * shipSize.y; }
        anchors.push(new Vector3(x, y, tailZ)
          .multiplyScalar(ship.transform.scale)
          .applyQuaternion(ship.transform.rotation)
          .add(ship.transform.position));
      }
      return anchors;
    }
    // Transform local anchors to world using ship transform and scale
    const out: Vector3[] = new Array(locals.length);
    for (let i = 0; i < locals.length; i++) {
      out[i] = tmpVec.clone()
        .copy(locals[i])
        .multiplyScalar(ship.transform.scale)
        .applyQuaternion(ship.transform.rotation)
        .add(ship.transform.position);
    }
    return out;
  };

  useFrame((state, delta) => {
  if (!meshRef.current) return;

    const particles = particlesRef.current;
    let activeCount = 0;

    // Update existing particles
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      
      if (particle.life <= 0) continue;
      
      particle.life -= delta;
      particle.position.add(particle.velocity.clone().multiplyScalar(delta));
      
      if (particle.life > 0) {
        const lifeRatio = particle.life / particle.maxLife;
        const scale = particle.scale * lifeRatio;
        
        dummy.position.copy(particle.position);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        
        meshRef.current.setMatrixAt(activeCount, dummy.matrix);
        activeCount++;
      }
    }

    // Spawn new particles from thrusting ships
    for (const ship of ships) {
      const throttle = ship.ai?.command?.thrust ?? 0;
      if (throttle < PARTICLE_TRAILS_CONFIG.minThrottle) continue; // Only spawn when thrusting
      
  const anchors = computeThrusterAnchorsWorld(ship);
  const spawnRate = throttle * PARTICLE_TRAILS_CONFIG.spawnRatePerAnchor; // Particles/s per anchor
  const shouldSpawn = Math.random() < spawnRate * delta;
      
      if (shouldSpawn) {
        for (const anchor of anchors) {
          const particle = particles[nextParticleIndex.current];
          nextParticleIndex.current = (nextParticleIndex.current + 1) % PARTICLE_TRAILS_CONFIG.maxParticles;
          
          particle.position.copy(anchor);
          
          // Random velocity backwards from ship with some spread
          const backward = new Vector3(0, 0, -1).applyQuaternion(ship.transform.rotation);
          const speed = PARTICLE_TRAILS_CONFIG.backwardSpeed.min + Math.random() * (PARTICLE_TRAILS_CONFIG.backwardSpeed.max - PARTICLE_TRAILS_CONFIG.backwardSpeed.min);
          particle.velocity.copy(backward).multiplyScalar(speed)
            .add(new Vector3(
              (Math.random() - 0.5) * 2 * PARTICLE_TRAILS_CONFIG.lateralJitter,
              (Math.random() - 0.5) * 2 * PARTICLE_TRAILS_CONFIG.lateralJitter,
              (Math.random() - 0.5) * 2 * PARTICLE_TRAILS_CONFIG.longitudinalJitter
            ));

          particle.life = PARTICLE_TRAILS_CONFIG.lifetime * (1 - PARTICLE_TRAILS_CONFIG.scaleJitter + Math.random() * 2 * PARTICLE_TRAILS_CONFIG.scaleJitter);
          particle.maxLife = particle.life;
          particle.scale = 1 - PARTICLE_TRAILS_CONFIG.scaleJitter + Math.random() * 2 * PARTICLE_TRAILS_CONFIG.scaleJitter;
          particle.shipId = ship.id;
        }
      }
    }

    // Update the instanced mesh
    meshRef.current.count = activeCount;
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, PARTICLE_TRAILS_CONFIG.maxParticles]}
      frustumCulled={false}
    />
  );
}