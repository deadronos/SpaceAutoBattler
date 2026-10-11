import { useFrame } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Frustum, Matrix4, Sphere, Vector3 } from 'three';
import type { GameState, ProjectileEntity } from '../types/index.js';
import { getProjectileGeometry } from '../utils/projectileGeometries.js';
import {
  computeBeamTransform,
  resolveProjectileInfo,
  type ResolvedProjectileInfo,
} from '../utils/projectileInfo.js';
import {
  createInstancedMaterial,
  type InstancedMaterialInfo,
} from '../renderer/materialRegistry.js';
import { createInstancedLayerManager } from '../components/layers/instancedLayer.js';
import type { InstancedLayerManager } from '../components/layers/types.js';
import {
  createSaturationWarningState,
  warnOnSaturation,
} from '../components/layers/saturationWarning.js';
import { shouldUpdateProjectileMatrix } from '../renderer/projectileLod.js';
import {
  TEMP_PROJECTILES_LAYER_POSITION,
  TEMP_PROJECTILES_LAYER_SCALE,
} from '../utils/tempVectors.js';

export interface ProjectileGroupState {
  key: string;
  capacity: number;
  manager: InstancedLayerManager<number>;
  meshRef: React.MutableRefObject<InstancedMesh | null>;
  materialInfo: InstancedMaterialInfo;
  geometry: ReturnType<typeof getProjectileGeometry>;
  baseColor: Color;
  maxIndex: number;
  info: ResolvedProjectileInfo;
}

// HIDDEN_MATRIX is exported from `instancedLayer.ts` and used globally to
// hide released instances. Keeping a single canonical source avoids dupes.
const TEMP_MATRIX = new Matrix4();

/**
 * Per-frame instanced projectile grouping and matrix update simulation.
 * Owns the group registry and reusable culling/scratch objects.
 *
 * @param {object} params - Hook parameters.
 * @param {ProjectileEntity[]} params.projectiles - Current projectile entities.
 * @param {GameState | null} params.state - Current game state (for tick gating).
 * @param {Partial<Record<string, number>>} [params.capacityByType] - Optional capacity overrides per type.
 * @param {number} params.defaultCapacity - Default capacity per group.
 * @param {number} params.maxTotal - Maximum total rendered projectiles.
 * @returns {React.MutableRefObject<Map<string, ProjectileGroupState>>} Ref to the projectile group registry.
 */
export function useProjectileInstancedGroups(params: {
  projectiles: ProjectileEntity[];
  state: GameState | null;
  capacityByType?: Partial<Record<string, number>>;
  defaultCapacity: number;
  maxTotal: number;
}): React.MutableRefObject<Map<string, ProjectileGroupState>> {
  const { projectiles, state, capacityByType, defaultCapacity, maxTotal } = params;
  const groupsRef = useRef<Map<string, ProjectileGroupState>>(new Map());
  const [, forceRender] = useState(0);
  const warningStateRef = useRef(createSaturationWarningState());
  const frameRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const frustumRef = useRef(new Frustum());
  const projScreenMatrixRef = useRef(new Matrix4());
  const tempSphereRef = useRef(new Sphere());
  const tempBeamCenterRef = useRef(new Vector3());

  const ensureGroup = useCallback(
    (key: string): ProjectileGroupState => {
      const existing = groupsRef.current.get(key);
      if (existing) return existing;
      const resolvedCapacity = Math.max(1, capacityByType?.[key] ?? defaultCapacity);
      const geometry = getProjectileGeometry(key);
      const info = resolveProjectileInfo(key);
      const materialInfo = createInstancedMaterial(key);
      const meshRef: React.MutableRefObject<InstancedMesh | null> = { current: null };
      const baseColor = new Color(1, 1, 1);
      const manager = createInstancedLayerManager<number>(meshRef, {
        capacity: resolvedCapacity,
        supportsInstanceColor: materialInfo.supportsInstanceColor,
        baseColor,
      });
      const group: ProjectileGroupState = {
        key,
        capacity: resolvedCapacity,
        manager,
        meshRef,
        materialInfo,
        geometry,
        baseColor,
        maxIndex: -1,
        info,
      };
      groupsRef.current.set(key, group);
      forceRender((n) => n + 1);
      return group;
    },
    [capacityByType, defaultCapacity],
  );

  useEffect(() => {
    const keys = new Set<string>();
    for (const projectile of projectiles) {
      const key =
        projectile.projectile.renderKey ?? projectile.projectile.bulletType ?? 'bullet:laser';
      keys.add(key);
    }
    for (const key of keys) {
      ensureGroup(key);
    }
  }, [projectiles, ensureGroup]);
  useFrame((r3fState) => {
    frameRef.current += 1;
    const frameId = frameRef.current;
    const simTick = state?.simulation.lastTickIndex ?? null;
    const tickUnchanged = simTick != null && lastTickRef.current === simTick;

    if (tickUnchanged) {
      let hasBeam = false;
      for (const projectile of projectiles) {
        const projectedCategory =
          projectile.projectile.category ?? projectile.projectile.renderInfo?.category;
        if (projectedCategory === 'beam') {
          hasBeam = true;
          break;
        }
      }
      if (!hasBeam) return;
    }
    lastTickRef.current = simTick;

    const camera = r3fState.camera;
    projScreenMatrixRef.current.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    frustumRef.current.setFromProjectionMatrix(projScreenMatrixRef.current);
    const cameraPos = camera.position;

    let totalAllocated = 0;
    let saturated = false;

    for (const group of groupsRef.current.values()) {
      group.manager.beginFrame();
      group.maxIndex = -1;
    }

    for (const projectile of projectiles) {
      const key =
        projectile.projectile.renderKey ?? projectile.projectile.bulletType ?? 'bullet:laser';
      const group = ensureGroup(key);
      if (!group) continue;

      const info = projectile.projectile.renderInfo ?? group.info;
      const category = projectile.projectile.category ?? info.category;

      // 1. Compute bounding sphere for frustum culling
      const pos = projectile.transform.position;
      if (category === 'beam' && projectile.projectile.beam) {
        const beam = projectile.projectile.beam;
        let beamLength =
          beam.maxLength ?? projectile.projectile.speed * projectile.projectile.maxTtl;
        if (beam.hitPoint) {
          beamLength = tempBeamCenterRef.current.copy(beam.hitPoint).sub(pos).length();
        }
        if (!Number.isFinite(beamLength) || beamLength <= 0) {
          beamLength = projectile.projectile.speed * Math.max(projectile.projectile.maxTtl, 0);
        }
        beamLength = Math.max(0.1, beamLength);

        // Midpoint center
        tempBeamCenterRef.current.copy(pos).addScaledVector(projectile.direction, beamLength / 2);
        tempSphereRef.current.center.copy(tempBeamCenterRef.current);
        tempSphereRef.current.radius = beamLength / 2 + 1.0;
      } else {
        const baseScale = projectile.transform.scale * info.visualMultiplier;
        tempSphereRef.current.center.copy(pos);
        tempSphereRef.current.radius = baseScale + 1.0;
      }

      // 2. Frustum Culling
      if (!frustumRef.current.intersectsSphere(tempSphereRef.current)) {
        continue;
      }

      // 3. Distance LOD checking
      const shouldUpdateMatrix = shouldUpdateProjectileMatrix({
        distanceSq: cameraPos.distanceToSquared(tempSphereRef.current.center),
        isNew: !group.manager.has(projectile.id),
        frameId,
        projectileId: projectile.id,
      });

      if (totalAllocated >= maxTotal) {
        saturated = true;
        continue;
      }

      const index = group.manager.allocate(projectile.id);
      if (index == null) {
        saturated = true;
        continue;
      }

      totalAllocated += 1;

      // If we don't need to update matrix on this frame, skip the calculations and keep existing matrix
      if (!shouldUpdateMatrix) {
        continue;
      }

      const mesh = group.meshRef.current;
      if (!mesh) continue;

      if (category === 'beam' && projectile.projectile.beam) {
        const result = computeBeamTransform({
          projectile,
          info,
          matrix: TEMP_MATRIX,
          scratchScale: TEMP_PROJECTILES_LAYER_SCALE,
          scratchPosition: TEMP_PROJECTILES_LAYER_POSITION,
        });
        group.manager.setMatrixAt(index, result.matrix);
      } else {
        const baseScale = projectile.transform.scale * info.visualMultiplier;
        TEMP_PROJECTILES_LAYER_SCALE.setScalar(baseScale);
        TEMP_MATRIX.compose(
          projectile.transform.position,
          projectile.transform.rotation,
          TEMP_PROJECTILES_LAYER_SCALE,
        );
        group.manager.setMatrixAt(index, TEMP_MATRIX);
      }
    }

    for (const group of groupsRef.current.values()) {
      const mesh = group.meshRef.current;
      if (!mesh) continue;
      const summary = group.manager.endFrame();
      if (summary.saturated) saturated = true;
    }

    warnOnSaturation({
      saturated,
      frameId,
      state: warningStateRef.current,
      message: '[ProjectilesInstancedLayer] Capacity saturated, clamping projectile render count.',
    });
  });

  return groupsRef;
}
