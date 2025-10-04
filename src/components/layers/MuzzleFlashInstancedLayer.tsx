import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import type { InstancedMesh } from 'three';
import {
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { SphereGeometry } from 'three';
import type { Archetype, GameEntity, TurretEntity, MuzzleFlash } from '../../types/index.js';
import { useArchetypeEntities } from '../../hooks/useArchetypeEntities.js';
import { useGameState } from '../../game/context.js';
import { useBloomRegistration } from '../../renderer/BloomProvider.js';
import { createInstancedMaterial } from '../../renderer/materialRegistry.js';
import { InstanceAllocator } from './instanceAllocator.js';
import { computeMuzzleFlashVisuals } from './muzzleFlashMath.js';

interface MuzzleFlashInstancedLayerProps {
  archetype: Archetype<GameEntity, ['turret']>;
  capacity?: number;
  lifetime?: number;
}

const DEFAULT_CAPACITY = 256;
const DEFAULT_LIFETIME = 0.25;
const TEMP_MATRIX = new Matrix4();
const TEMP_SCALE = new Vector3();
const TEMP_POS = new Vector3();
const TEMP_ROT = new Quaternion();
const TEMP_COLOR = new Color();
const HIDDEN_MATRIX = new Matrix4().makeScale(0, 0, 0);

const COLOR_MAP: Record<string, Color> = {
  'bullet:heavy': new Color('#ffb36b'),
  'bullet:plasma': new Color('#a04bff'),
  'bullet:ion': new Color('#6fe8ff'),
};
const DEFAULT_COLOR = new Color('#ffd089');

function resolveFlashColor(bulletType?: string | null): Color {
  if (!bulletType) return DEFAULT_COLOR;
  return COLOR_MAP[bulletType] ?? DEFAULT_COLOR;
}

export function MuzzleFlashInstancedLayer({
  archetype,
  capacity = DEFAULT_CAPACITY,
  lifetime = DEFAULT_LIFETIME,
}: MuzzleFlashInstancedLayerProps): React.ReactElement {
  const turrets = useArchetypeEntities<TurretEntity>(archetype);
  const allocatorRef = useRef(new InstanceAllocator<MuzzleFlash>(capacity));
  const meshRef = useRef<InstancedMesh>(null);
  const warningFrameRef = useRef({ lastFrame: -1 });
  const frameRef = useRef(0);
  const state = useGameState();

  const materialInfo = useMemo(() => createInstancedMaterial('muzzle:flash'), []);
  const geometry = useMemo(() => new SphereGeometry(1, 10, 10), []);

  useBloomRegistration(meshRef, { group: 'muzzleFlashes' });

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
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
    materialInfo.material.dispose();
  }, [materialInfo.material]);

  useEffect(() => () => {
    geometry.dispose();
  }, [geometry]);

  useFrame(() => {
    frameRef.current += 1;
    const mesh = meshRef.current;
    if (!mesh) return;

    const allocator = allocatorRef.current;
    allocator.beginFrame();
    let maxIndex = -1;
    let saturated = false;

    for (const turret of turrets) {
      const flashes = turret.muzzleFlashes ?? [];
      if (!flashes.length) continue;
      TEMP_ROT.copy(turret.transform.rotation);

      for (const flash of flashes) {
        const index = allocator.allocate(flash);
        if (index == null) {
          saturated = true;
          continue;
        }

        const elapsed = Math.max(0, state.time - flash.t0);
        if (elapsed > lifetime) {
          const released = allocator.release(flash);
          if (released != null) {
            mesh.setMatrixAt(released, HIDDEN_MATRIX);
            mesh.setColorAt(released, DEFAULT_COLOR);
          }
          continue;
        }

        TEMP_POS.copy(flash.local)
          .multiplyScalar(turret.transform.scale)
          .applyQuaternion(TEMP_ROT)
          .add(turret.transform.position);
        const visuals = computeMuzzleFlashVisuals({
          baseScale: turret.transform.scale * 1.4,
          amplitude: flash.amp ?? 1,
          lifetime,
          elapsed,
        });
        TEMP_SCALE.setScalar(visuals.scale);
        TEMP_MATRIX.compose(TEMP_POS, TEMP_ROT, TEMP_SCALE);
        mesh.setMatrixAt(index, TEMP_MATRIX);
        mesh.instanceMatrix.needsUpdate = true;

        const color = resolveFlashColor(flash.bulletType);
        TEMP_COLOR.copy(color).multiplyScalar(visuals.intensity);
        mesh.setColorAt(index, TEMP_COLOR);
        if (mesh.instanceColor) {
          mesh.instanceColor.needsUpdate = true;
        }

        if (index > maxIndex) maxIndex = index;
      }
    }

    const summary = allocator.endFrame();
    if (summary.saturated) saturated = true;
    for (const released of summary.released) {
      mesh.setMatrixAt(released, HIDDEN_MATRIX);
      mesh.setColorAt(released, DEFAULT_COLOR);
    }
    const count = maxIndex >= 0 ? Math.min(maxIndex + 1, capacity) : 0;
    mesh.count = count;
    mesh.visible = count > 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    if (saturated && warningFrameRef.current.lastFrame !== frameRef.current) {
      console.warn('[MuzzleFlashInstancedLayer] Capacity saturated, clamping muzzle flashes.');
      warningFrameRef.current.lastFrame = frameRef.current;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, materialInfo.material, capacity]}
      matrixAutoUpdate={false}
      frustumCulled
      visible={false}
    />
  );
}
