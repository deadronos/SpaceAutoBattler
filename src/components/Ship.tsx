import { useRef } from 'react';
import type React from 'react';
import { type Group } from 'three';
import type { ShipEntity } from '../types/index.js';
import { useShipInterpolation } from '../hooks/useShipInterpolation.js';
import { useShipThrusters } from '../hooks/useShipThrusters.js';
import { useShipModel, useHullMaterials } from './ship/ShipModel.js';
import { ShipView, SHIELD_RENDER_ORDER } from './ship/ShipView.js';

export { SHIELD_RENDER_ORDER };
export { resolveModelPath } from './ship/ShipModel.js';

/**
 * Renders a single ship entity in the 3D scene.
 * Handles model loading, interpolation, thrusters, and hull materials.
 *
 * @param {object} props - Component props.
 * @param {ShipEntity} props.entity - The ship entity to render.
 * @returns {React.ReactElement} The rendered ship object.
 */
export function ShipObject({ entity }: { entity: ShipEntity }): React.ReactElement {
  const rootGroup = useRef<Group>(null);
  const visualGroup = useRef<Group>(null);

  const { state: interpState, smoothing } = useShipInterpolation(entity, rootGroup, visualGroup);
  const { scene, hasValidPath } = useShipModel(entity.model);
  if (!Number.isFinite(smoothing.thrusterIntensity.base)) {
    smoothing.thrusterIntensity.base = 0;
  }
  if (!Number.isFinite(smoothing.thrusterIntensity.range)) {
    smoothing.thrusterIntensity.range = 0;
  }
  const thrusterMaterialsRef = useShipThrusters(scene, entity, smoothing);
  const hullMaterialsRef = useHullMaterials(scene);

  return (
    <ShipView
      entity={entity}
      groupRef={rootGroup}
      visualRef={visualGroup}
      scene={scene}
      hasValidPath={hasValidPath}
      hullMaterialsRef={hullMaterialsRef}
    />
  );
}
