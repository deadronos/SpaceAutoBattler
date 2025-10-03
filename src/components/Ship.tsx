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

export function ShipObject({ entity }: { entity: ShipEntity }): React.ReactElement {
  const group = useRef<Group>(null);

  const { state: interpState, smoothing } = useShipInterpolation(entity, group);
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
      groupRef={group}
      scene={scene}
      hasValidPath={hasValidPath}
      hullMaterialsRef={hullMaterialsRef}
    />
  );
}