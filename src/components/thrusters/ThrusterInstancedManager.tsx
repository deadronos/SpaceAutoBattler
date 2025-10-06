import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import type { ShipEntity, ShipHull } from '../../types/index.js';
import { THRUSTER_GLOW_CONFIG } from '../../config/renderer.js';
import { useBloomRegistration } from '../../renderer/BloomProvider.js';
import { getInstanceFriendlyMaterial } from '../../renderer/materialRegistry.js';
import { createSaturationWarningState, warnOnSaturation } from '../layers/saturationWarning.js';

interface ThrusterInstancedManagerProps {
  ships: readonly ShipEntity[];
  capacity?: number;
  intensityBase?: number;
  intensityRange?: number;
}

const DEFAULT_CAPACITY = 512;
const DEFAULT_INTENSITY_BASE = 0.75;
const DEFAULT_INTENSITY_RANGE = 1.5;

const HULL_SIZE_HINTS: Record<ShipHull, Vector3> = {
  fighter: new Vector3(1.4, 0.7, 2.8),
  corvette: new Vector3(2.4, 1.2, 4.2),
  frigate: new Vector3(3.2, 1.4, 5.5),
  destroyer: new Vector3(4.4, 2.0, 7.2),
  carrier: new Vector3(6.4, 2.8, 10.4),
};

function createAnchorPattern(hull: ShipHull): Vector3[] {
  const count = THRUSTER_GLOW_CONFIG.anchorsByHull[hull] ?? 1;
  const size = HULL_SIZE_HINTS[hull] ?? new Vector3(2, 1, 3);
  const tailZ = -size.z * 0.6 - size.z * THRUSTER_GLOW_CONFIG.tailOffset;
  const anchors: Vector3[] = [];
  for (let i = 0; i < count; i += 1) {
    let x = 0;
    let y = 0;
    if (count === 2) {
      x = (i === 0 ? -1 : 1) * 0.3 * size.x;
    } else if (count === 4) {
      x = (i % 2 === 0 ? -1 : 1) * 0.25 * size.x;
      y = (i < 2 ? -1 : 1) * 0.2 * size.y;
    } else if (count === 6) {
      x = (i % 2 === 0 ? -1 : 1) * 0.35 * size.x;
      y = (Math.floor(i / 2) - 1) * 0.18 * size.y;
    }
    anchors.push(new Vector3(x, y, tailZ));
  }
  return anchors;
}

const HULL_ANCHOR_CACHE = new Map<ShipHull, Vector3[]>([
  ['fighter', createAnchorPattern('fighter')],
  ['corvette', createAnchorPattern('corvette')],
  ['frigate', createAnchorPattern('frigate')],
  ['destroyer', createAnchorPattern('destroyer')],
  ['carrier', createAnchorPattern('carrier')],
]);

function getAnchors(hull: ShipHull): readonly Vector3[] {
  return HULL_ANCHOR_CACHE.get(hull) ?? HULL_ANCHOR_CACHE.get('fighter')!;
}

export function ThrusterInstancedManager({
  ships,
  capacity = DEFAULT_CAPACITY,
  intensityBase = DEFAULT_INTENSITY_BASE,
  intensityRange = DEFAULT_INTENSITY_RANGE,
}: ThrusterInstancedManagerProps): React.ReactElement {
  const meshRef = useRef<InstancedMesh>(null);
  const warningStateRef = useRef(createSaturationWarningState());
  const frameRef = useRef(0);

  const materialInfo = useMemo(
    () =>
      getInstanceFriendlyMaterial('thruster:glow', {
        requireInstanceColor: true,
        fallbackKey: 'muzzle:flash',
      }),
    [],
  );
  const geometry = useMemo(() => new SphereGeometry(1, 16, 12), []);
  const tempMatrix = useMemo(() => new Matrix4(), []);
  const tempScale = useMemo(() => new Vector3(), []);
  const tempPos = useMemo(() => new Vector3(), []);
  const tempQuat = useMemo(() => new Quaternion(), []);
  const tempColor = useMemo(() => new Color(THRUSTER_GLOW_CONFIG.defaultEmissiveColor), []);
  const baseColor = useMemo(() => new Color(THRUSTER_GLOW_CONFIG.defaultEmissiveColor), []);

  useBloomRegistration(meshRef, { group: 'engines' });

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (!mesh.instanceColor) {
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
      mesh.instanceColor.needsUpdate = true;
    }
    return () => {
      mesh.instanceColor = null;
    };
  }, [capacity]);

  useEffect(() => () => {
    geometry.dispose();
  }, [geometry]);

  useEffect(() => () => {
    materialInfo.material.dispose();
  }, [materialInfo.material]);

  useFrame(() => {
    frameRef.current += 1;
    const frameId = frameRef.current;
    const mesh = meshRef.current;
    if (!mesh) return;

    let index = 0;
    let saturated = false;

    for (const ship of ships) {
      const throttle = Math.min(Math.max(ship.ai?.command?.thrust ?? 0, 0), 1);
      const anchors = getAnchors(ship.ship.hull);
      const hullScale = Math.max(ship.transform.scale, 0.1);
      const baseScale = hullScale * (THRUSTER_GLOW_CONFIG.glowMeshSize * 50);

      tempQuat.copy(ship.transform.rotation);

      for (const local of anchors) {
        if (index >= capacity) {
          saturated = true;
          break;
        }

        tempPos
          .copy(local)
          .multiplyScalar(hullScale)
          .applyQuaternion(ship.transform.rotation)
          .add(ship.transform.position);

        const scaleValue = baseScale * (1 + throttle * 1.8);
        tempScale.setScalar(scaleValue);
        tempMatrix.compose(tempPos, tempQuat, tempScale);
        mesh.setMatrixAt(index, tempMatrix);

        tempColor.copy(baseColor).multiplyScalar(intensityBase + intensityRange * throttle);
        mesh.setColorAt(index, tempColor);

        index += 1;
      }
      if (saturated) break;
    }

    mesh.count = index;
    mesh.visible = index > 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    warnOnSaturation({
      saturated,
      frameId,
      state: warningStateRef.current,
      message: '[ThrusterInstancedManager] Capacity saturated, clamping thruster glows.',
    });
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, materialInfo.material, capacity]}
      matrixAutoUpdate={false}
      frustumCulled={false}
      visible={false}
    />
  );
}

