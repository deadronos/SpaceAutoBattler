import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh } from 'three';
import type { ProjectileEntity } from '../types/index.js';
import type React from 'react';
import { getMaterial } from '../renderer/materialRegistry.js';
import { PROJECTILE_CONFIG, DEFAULT_PROJECTILE_CONFIG } from '../config/projectiles.js';
import { useBloomRegistration } from '../renderer/BloomProvider.js';

export function ProjectileObject({ entity }: { entity: ProjectileEntity }): React.ReactElement {
  const meshRef = useRef<Mesh>(null);
  useBloomRegistration(meshRef, true);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.position.copy(entity.transform.position);
    mesh.quaternion.copy(entity.transform.rotation);
    const scale = entity.transform.scale;
    const cfg = PROJECTILE_CONFIG[entity.projectile.bulletType ?? ''] ?? DEFAULT_PROJECTILE_CONFIG;
    const visual = scale * (cfg.visualMultiplier ?? DEFAULT_PROJECTILE_CONFIG.visualMultiplier ?? 1);
    mesh.scale.set(visual, visual, visual);
  });

  // Select a bullet material by key; fallback to built-in glow if missing
  const key = entity.projectile.bulletType ?? 'bullet:laser';
  const Mat = getMaterial(key);
  return (
    <mesh ref={meshRef} castShadow receiveShadow>
  {/* geometry base radius will be scaled by transform.scale in useFrame */}
  <sphereGeometry args={[PROJECTILE_CONFIG['bullet:laser'].baseGeometryRadius, 16, 16]} />
      {Mat ? (
        // provide minimal props surface for future materials
        <Mat />
      ) : (
        <meshStandardMaterial color="#ffd089" emissive="#ff962f" emissiveIntensity={1.8} />
      )}
    </mesh>
  );
}
