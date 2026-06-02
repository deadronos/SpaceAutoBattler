import { useFrame } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { InstancedMesh } from 'three';
import { Color, Frustum, Matrix4, Sphere, Vector3 } from 'three';
import type { Archetype, GameEntity, ProjectileEntity } from '../../types/index.js';
import { useArchetypeEntities } from '../../hooks/useArchetypeEntities.js';
import { useGameState } from '../../game/context.js';
import { getProjectileGeometry } from '../../utils/projectileGeometries.js';
import {
  computeBeamTransform,
  resolveProjectileInfo,
  type ResolvedProjectileInfo,
} from '../../utils/projectileInfo.js';
import {
  createInstancedMaterial,
  type InstancedMaterialInfo,
} from '../../renderer/materialRegistry.js';
import { useBloomRegistration } from '../../renderer/bloom/index.js';
import { createInstancedLayerManager } from './instancedLayer.js';
import type { InstancedLayerManager } from './types.js';
import { createSaturationWarningState, warnOnSaturation } from './saturationWarning.js';

interface ProjectilesInstancedLayerProps {
  archetype: Archetype<GameEntity, ['projectile']>;
  capacityByType?: Partial<Record<string, number>>;
  defaultCapacity?: number;
  maxTotal?: number;
}

interface ProjectileGroupState {
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

const DEFAULT_CAPACITY = 512;
const LOD_CLOSE_DISTANCE_SQ = 200 * 200; // Projects within 200 units are updated at full 60 FPS
const LOD_FAR_UPDATE_INTERVAL = 2; // Far projectiles update every 2 frames
// HIDDEN_MATRIX is exported from `instancedLayer.ts` and used globally to
// hide released instances. Keeping a single canonical source avoids dupes.
const TEMP_MATRIX = new Matrix4();
const TEMP_SCALE = new Vector3();
const TEMP_POSITION = new Vector3();

function ProjectileGroupMesh({ group }: { group: ProjectileGroupState }): React.ReactElement {
  const { meshRef, materialInfo, geometry, capacity, baseColor } = group;
  useBloomRegistration(meshRef, { group: 'projectiles' });

  useEffect(() => {
    // Initialize mesh attributes via the group's manager (if attached)
    const manager = group.manager;
    const mesh = meshRef.current;
    manager.initMesh();
    return () => {
      if (mesh && mesh.instanceColor) {
        mesh.instanceColor = null;
      }
    };
  }, [group.manager, meshRef, materialInfo.supportsInstanceColor, capacity, baseColor]);

  useEffect(
    () => () => {
      materialInfo.material.dispose();
    },
    [materialInfo.material],
  );

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

/**
 * Instanced renderer for projectiles.
 * Groups projectiles by type/key and renders them using InstancedMesh for performance.
 * Handles beam visualization separately via scaling matrices.
 *
 * @param {object} props - Component props.
 * @param {Archetype<GameEntity, ['projectile']>} props.archetype - The projectile archetype.
 * @param {Partial<Record<string, number>>} [props.capacityByType] - Optional capacity overrides per type.
 * @param {number} [props.defaultCapacity=512] - Default capacity per group.
 * @param {number} [props.maxTotal=Infinity] - Maximum total rendered projectiles.
 * @returns {React.ReactElement} The rendered instanced meshes.
 */
export function ProjectilesInstancedLayer({
  archetype,
  capacityByType,
  defaultCapacity = DEFAULT_CAPACITY,
  maxTotal = Number.POSITIVE_INFINITY,
}: ProjectilesInstancedLayerProps): React.ReactElement {
  const projectiles = useArchetypeEntities<ProjectileEntity>(archetype);
  const groupsRef = useRef<Map<string, ProjectileGroupState>>(new Map());
  const [, forceRender] = useState(0);
  const warningStateRef = useRef(createSaturationWarningState());
  const frameRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const frustumRef = useRef(new Frustum());
  const projScreenMatrixRef = useRef(new Matrix4());
  const tempSphereRef = useRef(new Sphere());
  const tempBeamCenterRef = useRef(new Vector3());
  const state = useGameState();

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
      const distSq = cameraPos.distanceToSquared(tempSphereRef.current.center);
      const isClose = distSq < LOD_CLOSE_DISTANCE_SQ;
      const isNew = !group.manager.has(projectile.id);
      const shouldUpdateMatrix =
        isClose || isNew || (frameId + projectile.id) % LOD_FAR_UPDATE_INTERVAL === 0;

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
          scratchScale: TEMP_SCALE,
          scratchPosition: TEMP_POSITION,
        });
        group.manager.setMatrixAt(index, result.matrix);
      } else {
        const baseScale = projectile.transform.scale * info.visualMultiplier;
        TEMP_SCALE.setScalar(baseScale);
        TEMP_MATRIX.compose(
          projectile.transform.position,
          projectile.transform.rotation,
          TEMP_SCALE,
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

  return (
    <>
      {Array.from(groupsRef.current.values()).map((group) => (
        <ProjectileGroupMesh key={group.key} group={group} />
      ))}
    </>
  );
}
