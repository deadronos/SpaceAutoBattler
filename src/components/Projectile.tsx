import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh } from 'three';
import type { ProjectileEntity } from '../types/index.js';

export function ProjectileObject({ entity }: { entity: ProjectileEntity }): JSX.Element {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.position.copy(entity.transform.position);
    mesh.quaternion.copy(entity.transform.rotation);
    const scale = entity.transform.scale;
    mesh.scale.set(scale, scale, scale);
  });

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <sphereGeometry args={[0.4, 16, 16]} />
      <meshStandardMaterial color="#ffd089" emissive="#ff962f" emissiveIntensity={1.8} />
    </mesh>
  );
}
