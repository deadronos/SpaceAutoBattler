import { useMemo, useRef, type RefObject } from 'react';
import type React from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Box3,
  Color,
  DoubleSide,
  Sphere,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
} from 'three';
import type { ShipEntity } from '../../types/index.js';
import { useUiStore } from '../../app/uiStore.js';
import { getShieldVisuals, TEAM_COLORS } from '../../config/renderer.js';
import { FALLBACK_RADIUS_BY_HULL, type HullMaterial } from './ShipModel.js';
import { ShieldBubble, SHIELD_RENDER_ORDER } from './ShipShield.js';

export { SHIELD_RENDER_ORDER };

const FALLBACK_CONE_ARGS = [0.6, 1.6, 6] as const;
const SELECTION_RING_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0];
const NOOP_RAYCAST = (): void => {};

function SelectionRing({ radius, color }: { radius: number; color: string }): React.ReactElement {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);
  const ringArgs = useMemo(() => [radius * 1.15, radius * 1.3, 48] as const, [radius]);

  useFrame(({ clock }) => {
    const wave = Math.sin(clock.elapsedTime * 3);
    const mesh = meshRef.current;
    if (mesh) {
      const pulse = 1 + 0.04 * wave;
      mesh.scale.set(pulse, pulse, 1);
    }
    const material = materialRef.current;
    if (material) {
      material.opacity = 0.58 + 0.14 * wave;
    }
  });

  return (
    <mesh
      ref={meshRef}
      rotation={SELECTION_RING_ROTATION}
      renderOrder={SHIELD_RENDER_ORDER + 1}
      raycast={NOOP_RAYCAST}
    >
      <ringGeometry args={ringArgs} />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.7}
        side={DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

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
 * Renders the model, shield bubble, and optional selection indicator.
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
  const isSelected = useUiStore((s) => s.selectedShipId === entity.id);

  const modelRadius = useMemo(() => {
    if (!scene) return FALLBACK_RADIUS_BY_HULL[entity.ship.hull] ?? 2.0;
    const box = new Box3().setFromObject(scene);
    const sphere = new Sphere();
    box.getBoundingSphere(sphere);
    const { margin } = getShieldVisuals(entity.ship.hull);
    return sphere.radius * margin;
  }, [scene, entity.ship.hull]);

  const teamColorHex = entity.ship.team === 'blue' ? TEAM_COLORS.blue : TEAM_COLORS.red;
  const fallbackColor = useMemo(() => new Color(teamColorHex), [teamColorHex]);

  const showLoadedScene = Boolean(scene && hasValidPath);

  return (
    <group
      ref={groupRef}
      dispose={null}
      userData={{ shipId: entity.id }}
      onPointerDown={(event) => {
        event.stopPropagation();
        useUiStore.getState().selectShip(entity.id);
      }}
    >
      <group ref={visualRef}>
        {showLoadedScene && scene ? (
          <primitive object={scene} />
        ) : (
          <mesh castShadow receiveShadow>
            <coneGeometry args={FALLBACK_CONE_ARGS} />
            <meshStandardMaterial color={fallbackColor} />
          </mesh>
        )}
      </group>
      <ShieldBubble
        entity={entity}
        radius={modelRadius}
        hullMaterialsRef={showLoadedScene ? hullMaterialsRef : undefined}
      />
      {isSelected ? <SelectionRing radius={modelRadius} color={teamColorHex} /> : null}
    </group>
  );
}
