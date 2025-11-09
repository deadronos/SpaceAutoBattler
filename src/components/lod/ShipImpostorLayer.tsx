import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import { Color, InstancedMesh, Matrix4, PlaneGeometry, Quaternion, Vector3 } from 'three';
import type { ShipEntity } from '../../types/index.js';
import { getInstanceFriendlyMaterial } from '../../renderer/materialRegistry.js';
import { TEAM_COLORS } from '../../config/renderer.js';
import { createSaturationWarningState, warnOnSaturation } from '../layers/saturationWarning.js';
import { createInstancedLayerManager } from '../layers/instancedLayer.js';

export interface PopulateImpostorParams {
  ships: readonly ShipEntity[];
  capacity: number;
  cameraQuaternion: Quaternion;
  mesh: InstancedMesh | null;
  temp: {
    matrix: Matrix4;
    scale: Vector3;
    quat: Quaternion;
    pos: Vector3;
    color: Color;
  };
}

export function populateImpostorInstances({
  ships,
  capacity,
  cameraQuaternion,
  mesh,
  temp,
}: PopulateImpostorParams): { count: number; saturated: boolean } {
  if (!mesh) {
    return { count: 0, saturated: false };
  }

  let index = 0;
  let saturated = false;

  for (const ship of ships) {
    if (index >= capacity) {
      saturated = true;
      break;
    }

    temp.pos.copy(ship.transform.position);
    const scale = Math.max(ship.transform.scale * 6, 4);
    temp.scale.setScalar(scale);
    temp.quat.copy(cameraQuaternion);
    temp.matrix.compose(temp.pos, temp.quat, temp.scale);
    mesh.setMatrixAt(index, temp.matrix);

    const teamColor = TEAM_COLORS[ship.ship.team] ?? '#a0a0a0';
    temp.color.set(teamColor);
    mesh.setColorAt(index, temp.color);

    index += 1;
  }

  mesh.count = index;
  mesh.visible = index > 0;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  return { count: index, saturated };
}

interface ShipImpostorLayerProps {
  ships: readonly ShipEntity[];
  capacity: number;
}

export function ShipImpostorLayer({ ships, capacity }: ShipImpostorLayerProps): ReactElement {
  const meshRef = useRef<InstancedMesh>(null);
  const managerRef = useRef(
    createInstancedLayerManager<number>(meshRef, {
      capacity,
      supportsInstanceColor: true,
      baseColor: new Color('#a0a0a0'),
    }),
  );
  const warningStateRef = useRef(createSaturationWarningState());
  const frameRef = useRef(0);
  const geometry = useMemo(() => new PlaneGeometry(1, 1, 1, 1), []);
  const materialInfo = useMemo(
    () =>
      getInstanceFriendlyMaterial('ship:impostor', {
        requireInstanceColor: true,
        fallbackKey: 'thruster:glow',
      }),
    [],
  );
  const temp = useMemo(
    () => ({
      matrix: new Matrix4(),
      scale: new Vector3(),
      quat: new Quaternion(),
      pos: new Vector3(),
      color: new Color('#6fc3ff'),
    }),
    [],
  );

  useEffect(() => {
    managerRef.current.initMesh();
    return () => {
      managerRef.current.dispose();
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

  useFrame(({ camera }) => {
    frameRef.current += 1;
    const frameId = frameRef.current;

    const manager = managerRef.current;
    manager.beginFrame();

    for (const ship of ships) {
      const key = ship.id;
      const idx = manager.allocate(key);
      if (idx == null) continue;
      temp.pos.copy(ship.transform.position);
      const scale = Math.max(ship.transform.scale * 6, 4);
      temp.scale.setScalar(scale);
      temp.quat.copy(camera.quaternion);
      temp.matrix.compose(temp.pos, temp.quat, temp.scale);
      manager.setMatrixAt(idx, temp.matrix);

      const teamColor = TEAM_COLORS[ship.ship.team] ?? '#a0a0a0';
      temp.color.set(teamColor);
      manager.setColorAt(idx, temp.color);
    }

    const summary = manager.endFrame();

    warnOnSaturation({
      saturated: summary.saturated,
      frameId,
      state: warningStateRef.current,
      message: '[ShipImpostorLayer] Capacity saturated, clamping distant ship impostors.',
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
