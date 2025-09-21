import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type React from 'react';
import type { Group } from 'three';
import type { TurretEntity } from '../types/index.js';
import { DEBUG_VISUALS } from '../config/renderer.js';

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
    if (!DEBUG_VISUALS.showTurretGizmos) return null;
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
    if (!DEBUG_VISUALS.showMuzzleFlashes) return () => null;
    return function MuzzleFlashes() {
      return (
        <group name="turret-muzzle-flashes">
          {(entity.muzzleFlashes ?? []).map((m, i) => (
            <mesh key={`tmf-${i}`} position={m.local} frustumCulled={false}>
              <sphereGeometry args={[0.1, 10, 10]} />
              <meshStandardMaterial color={m.bulletType === 'bullet:heavy' ? '#ffb36b' : '#ffd089'} emissive="#ff962f" emissiveIntensity={1.6} transparent opacity={0.6} />
            </mesh>
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
