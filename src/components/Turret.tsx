import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type React from 'react';
import type { Group } from 'three';
import type { TurretEntity } from '../types/index.js';
// Debug visuals removed from config; keep local defaults (false)
const SHOW_TURRET_GIZMOS = false;

/**
 * Renders a turret entity in the 3D scene.
 * Updates position and rotation based on the entity transform.
 *
 * @param {object} props - Component props.
 * @param {TurretEntity} props.entity - The turret entity to render.
 * @returns {React.ReactElement} The rendered turret object.
 */
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

  return (
    <group ref={groupRef}>
      {Gizmo}
    </group>
  );
}
