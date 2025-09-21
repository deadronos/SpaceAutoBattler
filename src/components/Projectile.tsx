import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh } from 'three';
import type { ProjectileEntity } from '../types/index.js';
import type React from 'react';
import { getMaterial } from '../renderer/materialRegistry.js';

export function ProjectileObject({ entity }: { entity: ProjectileEntity }): React.ReactElement {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.position.copy(entity.transform.position);
    mesh.quaternion.copy(entity.transform.rotation);
    const scale = entity.transform.scale;
    mesh.scale.set(scale, scale, scale);
  });

  // Select a bullet material by key; fallback to built-in glow if missing
  const Mat = getMaterial('bullet:laser');
  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <sphereGeometry args={[0.4, 16, 16]} />
      {Mat ? (
        // provide minimal props surface for future materials
        <Mat />
      ) : (
        <meshStandardMaterial color="#ffd089" emissive="#ff962f" emissiveIntensity={1.8} />
      )}
    </mesh>
  );
}
