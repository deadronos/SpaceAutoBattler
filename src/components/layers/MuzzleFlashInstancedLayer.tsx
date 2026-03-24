import { useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Matrix4, Quaternion, Vector3 } from 'three';
import { SphereGeometry } from 'three';
import type { Archetype, GameEntity, TurretEntity, MuzzleFlash } from '../../types/index.js';
import { useArchetypeEntities } from '../../hooks/useArchetypeEntities.js';
import { useGameState } from '../../game/context.js';
import { useBloomRegistration } from '../../renderer/bloom/index.js';
import { getInstanceFriendlyMaterial } from '../../renderer/materialRegistry.js';
import { createInstancedLayerManager } from './instancedLayer.js';
import { computeMuzzleFlashVisuals } from './muzzleFlashMath.js';
import { createSaturationWarningState, warnOnSaturation } from './saturationWarning.js';

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
// HIDDEN_MATRIX lifecycle is handled by InstancedLayerManager

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

/**
 * Instanced renderer for muzzle flashes.
 *
 * @param {object} props - Component props.
 * @param {Archetype<GameEntity, ['turret']>} props.archetype - Archetype containing turrets (which hold flashes).
 * @param {number} [props.capacity=256] - Max number of flashes.
 * @param {number} [props.lifetime=0.25] - Lifetime of a flash in seconds.
 * @returns {React.ReactElement} The instanced mesh for muzzle flashes.
 */
export function MuzzleFlashInstancedLayer({
  archetype,
  capacity = DEFAULT_CAPACITY,
  lifetime = DEFAULT_LIFETIME,
}: MuzzleFlashInstancedLayerProps): React.ReactElement {
  const turrets = useArchetypeEntities<TurretEntity>(archetype);
  const meshRef = useRef<InstancedMesh>(null);
  const managerRef = useRef(
    createInstancedLayerManager<MuzzleFlash>(
      // meshRef will be attached by React after render; manager init is lazy
      meshRef,
      { capacity, supportsInstanceColor: true, baseColor: DEFAULT_COLOR },
    ),
  );
  const warningStateRef = useRef(createSaturationWarningState());
  const frameRef = useRef(0);
  const state = useGameState();

  const materialInfo = useMemo(
    () => getInstanceFriendlyMaterial('muzzle:flash', { requireInstanceColor: true }),
    [],
  );
  const geometry = useMemo(() => new SphereGeometry(1, 10, 10), []);

  useBloomRegistration(meshRef, { group: 'muzzleFlashes' });

  useEffect(() => {
    // Ensure manager initializes attributes once the mesh is mounted
    const manager = managerRef.current;
    manager.initMesh();
    return () => {
      manager.dispose();
    };
  }, []);

  useEffect(
    () => () => {
      materialInfo.material.dispose();
    },
    [materialInfo.material],
  );

  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );

  useFrame(() => {
    frameRef.current += 1;
    const frameId = frameRef.current;
    const mesh = meshRef.current;
    if (!mesh) return;

    const manager = managerRef.current;
    manager.beginFrame();
    let maxIndex = -1;
    let saturated = false;

    for (const turret of turrets) {
      const flashes = turret.muzzleFlashes ?? [];
      if (!flashes.length) continue;
      TEMP_ROT.copy(turret.transform.rotation);

      for (const flash of flashes) {
        const index = manager.allocate(flash);
        if (index == null) {
          saturated = true;
          continue;
        }

        const elapsed = Math.max(0, state.time - flash.t0);
        if (elapsed > lifetime) {
          // manager.release will hide the index and reset color
          manager.release(flash);
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
        manager.setMatrixAt(index, TEMP_MATRIX);

        const color = resolveFlashColor(flash.bulletType);
        TEMP_COLOR.copy(color).multiplyScalar(visuals.intensity);
        manager.setColorAt(index, TEMP_COLOR);

        if (index > maxIndex) maxIndex = index;
      }
    }

    const summary = manager.endFrame();
    if (summary.saturated) saturated = true;

    warnOnSaturation({
      saturated,
      frameId,
      state: warningStateRef.current,
      message: '[MuzzleFlashInstancedLayer] Capacity saturated, clamping muzzle flashes.',
    });
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
