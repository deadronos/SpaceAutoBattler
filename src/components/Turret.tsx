import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type React from 'react';
import type { Group } from 'three';
import { useBloomRegistration } from '../renderer/BloomProvider.js';
import { useRef as useReactRef } from 'react';
import type { Mesh } from 'three';
import type { TurretEntity } from '../types/index.js';
// Debug visuals removed from config; keep local defaults (false)
const SHOW_TURRET_GIZMOS = false;
const SHOW_MUZZLE_FLASHES = true;

export function TurretObject({ entity }: { entity: TurretEntity }): React.ReactElement {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.copy(entity.transform.position);
    g.quaternion.copy(entity.transform.rotation);
    g.scale.setScalar(entity.transform.scale);
  });

  const Gizmo = useMemo(() => {
  if (!SHOW_TURRET_GIZMOS) return null;
    return (
      <>
        <mesh frustumCulled={false}>
          <boxGeometry args={[0.18, 0.08, 0.18]} />
          <meshStandardMaterial color="#00ffaa" emissive="#00ffaa" emissiveIntensity={1.0} />
        </mesh>
        {/* Simple barrel forward along +Z */}
        <mesh position={[0, 0, 0.25]} frustumCulled={false}>
          <cylinderGeometry args={[0.03, 0.03, 0.3, 10]} />
          <meshStandardMaterial color="#99ffcc" roughness={0.4} metalness={0.2} />
        </mesh>
      </>
    );
  }, []);

  const Muzzles: React.FC = useMemo(() => {
  if (!SHOW_MUZZLE_FLASHES) return () => null;
    function MuzzleSphere({ position, color, emissive, intensity }: { position: [number, number, number]; color: string; emissive: string; intensity: number }) {
      const ref = useReactRef<Mesh>(null);
      useBloomRegistration(ref, true);
      return (
        <mesh ref={ref} position={position} frustumCulled={false}>
          <sphereGeometry args={[0.1, 10, 10]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={intensity} transparent opacity={0.9} />
        </mesh>
      );
    }

    return function MuzzleFlashes() {
      return (
        <group name="turret-muzzle-flashes">
          {(entity.muzzleFlashes ?? []).map((m, i) => (
            <MuzzleSphere
              key={`tmf-${i}`}
              position={[m.local.x, m.local.y, m.local.z]}
              color={m.bulletType === 'bullet:heavy' ? '#ffb36b' : '#ffd089'}
              emissive="#ff962f"
              intensity={8.6}
            />
          ))}
        </group>
      );
    };
  }, [entity.muzzleFlashes]);

  return (
    <group ref={groupRef}>
      {Gizmo}
      <Muzzles />
    </group>
  );
}
