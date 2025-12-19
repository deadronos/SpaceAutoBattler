import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import { Color, ConeGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { useOptionalSimulationBridge } from '../../game/context.js';

const DEFAULT_CAPACITY = 2048;

export function WorkerShipsLayer({ capacity = DEFAULT_CAPACITY }: { capacity?: number }): ReactElement {
  const bridge = useOptionalSimulationBridge();
  const meshRef = useRef<InstancedMesh>(null);

  const geometry = useMemo(() => new ConeGeometry(0.6, 1.6, 6), []);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    [],
  );

  const temp = useMemo(
    () => ({
      matrix: new Matrix4(),
      pos: new Vector3(),
      quat: new Quaternion(),
      scale: new Vector3(),
      color: new Color('#6fc3ff'),
    }),
    [],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Ensure a stable instanceColor buffer so per-instance colors work.
    if (!mesh.instanceColor) {
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    }

    return () => {
      if (mesh.instanceColor) {
        mesh.instanceColor = null;
      }
    };
  }, [capacity]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !bridge) return;

    const views = bridge.getLatestViews();
    const slots = bridge.getShipSlots();
    const meta = bridge.getShipMeta();

    if (!views || slots.size === 0) {
      mesh.visible = false;
      mesh.count = 0;
      return;
    }

    let index = 0;

    for (const [id, slot] of slots) {
      if (index >= capacity) break;

      const pBase = slot * 3;
      temp.pos.set(
        views.positions[pBase + 0] ?? 0,
        views.positions[pBase + 1] ?? 0,
        views.positions[pBase + 2] ?? 0,
      );

      const rBase = slot * 4;
      temp.quat.set(
        views.rotations[rBase + 0] ?? 0,
        views.rotations[rBase + 1] ?? 0,
        views.rotations[rBase + 2] ?? 0,
        views.rotations[rBase + 3] ?? 1,
      );

      const baseScale = Math.max(0.2, views.scales[slot] ?? 1);
      temp.scale.setScalar(baseScale);

      temp.matrix.compose(temp.pos, temp.quat, temp.scale);
      mesh.setMatrixAt(index, temp.matrix);

      const team = meta.get(id)?.team ?? 'blue';
      temp.color.set(team === 'red' ? '#ff5a5a' : '#6fc3ff');
      mesh.setColorAt(index, temp.color);

      index += 1;
    }

    mesh.visible = index > 0;
    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, capacity]}
      matrixAutoUpdate={false}
      frustumCulled={false}
      visible={false}
      renderOrder={5}
    />
  );
}
