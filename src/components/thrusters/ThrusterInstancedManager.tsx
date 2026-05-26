import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import { clamp01 } from '../../utils/math.js';
import type { ShipEntity, ShipHull } from '../../types/index.js';
import { THRUSTER_GLOW_CONFIG } from '../../config/renderer.js';
import { useBloomRegistration } from '../../renderer/bloom/index.js';
import { getInstanceFriendlyMaterial } from '../../renderer/materialRegistry.js';
import { createSaturationWarningState, warnOnSaturation } from '../layers/saturationWarning.js';
import { createInstancedLayerManager } from '../layers/instancedLayer.js';

interface ThrusterInstancedManagerProps {
  ships: readonly ShipEntity[];
  capacity?: number;
  intensityBase?: number;
  intensityRange?: number;
}

const DEFAULT_CAPACITY = 512;
const DEFAULT_INTENSITY_BASE = 0.75;
const DEFAULT_INTENSITY_RANGE = 1.5;
const HIGH_DENSITY_THRESHOLD = 120;
const HIGH_DENSITY_UPDATE_INTERVAL = 2;

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
  const managerRef = useRef(
    createInstancedLayerManager<string>(meshRef, {
      capacity,
      supportsInstanceColor: true,
      baseColor: baseColor,
    }),
  );

  useBloomRegistration(meshRef, { group: 'engines' });

  useEffect(() => {
    // initialize attributes once mesh mounted
    const manager = managerRef.current;
    manager.initMesh();
    return () => {
      manager.dispose();
    };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );

  useEffect(
    () => () => {
      materialInfo.material.dispose();
    },
    [materialInfo.material],
  );

  useFrame(() => {
    frameRef.current += 1;
    const frameId = frameRef.current;
    const mesh = meshRef.current;
    if (!mesh) return;

    if (ships.length >= HIGH_DENSITY_THRESHOLD && frameId % HIGH_DENSITY_UPDATE_INTERVAL === 0) {
      return;
    }

    managerRef.current.beginFrame();
    let saturated = false;

    for (const ship of ships) {
      const throttle = clamp01(ship.ai?.command?.thrust ?? 0);
      const anchors = getAnchors(ship.ship.hull);
      const hullScale = Math.max(ship.transform.scale, 0.1);
      const baseScale = hullScale * (THRUSTER_GLOW_CONFIG.glowMeshSize * 50);

      tempQuat.copy(ship.transform.rotation);

      for (let ai = 0; ai < anchors.length; ai += 1) {
        const local = anchors[ai];
        if (!local) continue;
        const key = `${ship.id}:${ai}`;
        const idx = managerRef.current.allocate(key);
        if (idx == null) {
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
        managerRef.current.setMatrixAt(idx, tempMatrix);

        tempColor.copy(baseColor).multiplyScalar(intensityBase + intensityRange * throttle);
        managerRef.current.setColorAt(idx, tempColor);
      }
      if (saturated) break;
    }

    const summary = managerRef.current.endFrame();
    if (summary.saturated) saturated = true;

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
