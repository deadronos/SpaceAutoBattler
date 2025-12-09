import { useMemo, type RefObject } from 'react';
import type React from 'react';
import { Box3, Color, Sphere, type Group } from 'three';
import type { ShipEntity } from '../../types/index.js';
import { getShieldVisuals, TEAM_COLORS } from '../../config/renderer.js';
import { FALLBACK_RADIUS_BY_HULL, type HullMaterial } from './ShipModel.js';
import { ShieldBubble, SHIELD_RENDER_ORDER } from './ShipShield.js';

export { SHIELD_RENDER_ORDER };

export interface ShipViewProps {
  entity: ShipEntity;
  groupRef: RefObject<Group | null>;
  /** Optional child group that receives purely visual offsets (bob/sway/bank). */
  visualRef?: RefObject<Group | null>;
  scene: Group | null;
  hasValidPath: boolean;
  hullMaterialsRef: RefObject<HullMaterial[]>;
}

/**
 * Visual presentation component for a ship.
 * Renders the model and the shield bubble.
 *
 * @param {ShipViewProps} props - Component props.
 * @returns {React.ReactElement} The rendered group.
 */
export function ShipView({
  entity,
  groupRef,
  scene,
  hasValidPath,
  hullMaterialsRef,
  visualRef,
}: ShipViewProps): React.ReactElement {
  const modelRadius = useMemo(() => {
    if (!scene) return FALLBACK_RADIUS_BY_HULL[entity.ship.hull] ?? 2.0;
    const box = new Box3().setFromObject(scene);
    const sphere = new Sphere();
    box.getBoundingSphere(sphere);
    const { margin } = getShieldVisuals(entity.ship.hull);
    return sphere.radius * margin;
  }, [scene, entity.ship.hull]);

  if (scene && hasValidPath) {
    return (
      <group ref={groupRef} dispose={null}>
        <group ref={visualRef}>
          <primitive object={scene} />
        </group>
        <ShieldBubble entity={entity} radius={modelRadius} hullMaterialsRef={hullMaterialsRef} />
      </group>
    );
  }

  return (
    <group ref={groupRef} dispose={null}>
      <group ref={visualRef}>
        <mesh castShadow receiveShadow>
          <coneGeometry args={[0.6, 1.6, 6]} />
          <meshStandardMaterial 
            color={entity.ship.team === 'blue' ? new Color(TEAM_COLORS.blue) : new Color(TEAM_COLORS.red)} 
          />
        </mesh>
      </group>
      <ShieldBubble entity={entity} radius={modelRadius} />
    </group>
  );
}
