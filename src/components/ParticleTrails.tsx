import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { 
  InstancedMesh, 
  SphereGeometry, 
  MeshBasicMaterial, 
  Matrix4, 
  Vector3, 
  Color,
  Object3D
} from 'three';
import type { ShipEntity } from '../types/index.js';
import { THRUSTER_GLOW_CONFIG, PARTICLE_TRAILS_CONFIG } from '../config/renderer.js';

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

  // Compute thruster anchors for a ship (replicating Ship.tsx logic)
  const computeThrusterAnchors = (ship: ShipEntity): Vector3[] => {
    const anchors: Vector3[] = [];
  const anchorCount = THRUSTER_GLOW_CONFIG.anchorsByHull[ship.ship.hull] || 1;
    
    // Simplified anchor computation - assume standard ship dimensions
  const shipSize = { x: 2, y: 1, z: 3 }; // Rough estimate used for trail anchors
  const tailZ = -shipSize.z * PARTICLE_TRAILS_CONFIG.tailZFactor; // Behind the ship
    
    for (let i = 0; i < anchorCount; i++) {
      let x = 0, y = 0;
      if (anchorCount === 2) {
        x = (i === 0 ? -1 : 1) * 0.3 * shipSize.x;
      } else if (anchorCount === 4) {
        x = (i % 2 === 0 ? -1 : 1) * 0.25 * shipSize.x;
        y = (i < 2 ? -1 : 1) * 0.15 * shipSize.y;
      } else if (anchorCount === 6) {
        x = (i % 2 === 0 ? -1 : 1) * 0.35 * shipSize.x;
        y = (Math.floor(i / 2) - 1) * 0.2 * shipSize.y;
      }
      
      const anchor = new Vector3(x, y, tailZ);
      // Transform to world space
      anchor.applyQuaternion(ship.transform.rotation);
      anchor.add(ship.transform.position);
      anchors.push(anchor);
    }
    
    return anchors;
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
        const opacity = lifeRatio * 0.6;
        
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
      
      const anchors = computeThrusterAnchors(ship);
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