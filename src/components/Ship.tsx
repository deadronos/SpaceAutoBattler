import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type React from 'react';
import { Box3, Color, MathUtils, Sphere, type Group } from 'three';
import type { ShipEntity } from '../types/index.js';
import { getShieldVisuals, TEAM_COLORS } from '../config/renderer.js';
import { useOptionalGameState } from '../game/context.js';
import { useShipInterpolation, updateInterpolation } from '../hooks/useShipInterpolation.js';
import { useShipThrusters, updateThrusterIntensity } from '../hooks/useShipThrusters.js';
import { useShipModel, useHullMaterials, FALLBACK_RADIUS_BY_HULL, resolveModelPath } from './ship/ShipModel.js';
import { ShieldBubble, SHIELD_RENDER_ORDER } from './ship/ShipShield.js';

export { SHIELD_RENDER_ORDER, resolveModelPath };

export function ShipObject({ entity }: { entity: ShipEntity }): React.ReactElement {
  const group = useRef<Group>(null);
  const state = useOptionalGameState();

  const lastTickIndex = state?.simulation.lastTickIndex ?? 0;
  const { state: interpState, smoothing } = useShipInterpolation(entity, lastTickIndex);
  const bankValueRef = useRef(0);
  const lastTickIndexRef = useRef(-1);

  const { scene, hasValidPath } = useShipModel(entity.model);
  const thrusterMaterialsRef = useShipThrusters(scene, entity);
  const hullMaterialsRef = useHullMaterials(scene);
  const thrusterColorRef = useMemo(() => new Color(), []);

  const modelRadius = useMemo(() => {
    if (!scene) return FALLBACK_RADIUS_BY_HULL[entity.ship.hull] ?? 2.0;
    const box = new Box3().setFromObject(scene);
    const sphere = new Sphere();
    box.getBoundingSphere(sphere);
    const { margin } = getShieldVisuals(entity.ship.hull);
    return sphere.radius * margin;
  }, [scene, entity.ship.hull]);

  useFrame(() => {
    const ref = group.current;
    if (!ref) return;

    const sim = state?.simulation;
    const tickIndex = sim?.lastTickIndex ?? lastTickIndexRef.current;
    const alpha = sim ? MathUtils.clamp(sim.alpha, 0, 1) : 1;

    updateInterpolation(
      entity,
      interpState,
      smoothing,
      alpha,
      tickIndex,
      bankValueRef,
      lastTickIndexRef,
    );

    ref.position.copy(interpState.visualPosition);
    ref.quaternion.copy(interpState.finalRotation);
    ref.scale.setScalar(entity.transform.scale);

    const thrusters = thrusterMaterialsRef.current;
    if (thrusters.length > 0) {
      const throttle = MathUtils.clamp(entity.ai?.command?.thrust ?? 0, 0, 1);
      updateThrusterIntensity(
        thrusters,
        throttle,
        smoothing.thrusterIntensity.base,
        smoothing.thrusterIntensity.range,
        thrusterColorRef,
      );
    }
  });

  if (scene) {
    return (
      <group ref={group} dispose={null}>
        <primitive object={scene} />
        <ShieldBubble entity={entity} radius={modelRadius} hullMaterialsRef={hullMaterialsRef} />
      </group>
    );
  }

  return (
    <group ref={group} dispose={null}>
      <mesh castShadow receiveShadow>
        <coneGeometry args={[0.6, 1.6, 6]} />
        <meshStandardMaterial color={entity.ship.team === 'blue' ? new Color(TEAM_COLORS.blue) : new Color(TEAM_COLORS.red)} />
      </mesh>
      <ShieldBubble entity={entity} radius={modelRadius} />
    </group>
  );
}
