import { useFrame } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { InstancedMesh } from 'three';
import { Color, DynamicDrawUsage, InstancedBufferAttribute, Matrix4, Vector3 } from 'three';
import type { Archetype, GameEntity, ProjectileEntity } from '../../types/index.js';
import { useArchetypeEntities } from '../../hooks/useArchetypeEntities.js';
import { getProjectileConfig } from '../../config/projectiles.js';
import { getProjectileGeometry } from '../../utils/projectileGeometries.js';
import {
  createInstancedMaterial,
  type InstancedMaterialInfo,
} from '../../renderer/materialRegistry.js';
import { useBloomRegistration } from '../../renderer/BloomProvider.js';
import { createInstancedLayerManager, InstancedLayerManager } from './instancedLayer.js';
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
}

const DEFAULT_CAPACITY = 512;
const HIDDEN_MATRIX = new Matrix4().makeScale(0, 0, 0);
const TEMP_MATRIX = new Matrix4();
const TEMP_SCALE = new Vector3();
const TEMP_POSITION = new Vector3();

interface ProjectileGeometryMetadata {
  category?: string;
  baseRadius?: number;
  baseWidth?: number;
  baseLength?: number;
}

function ProjectileGroupMesh({ group }: { group: ProjectileGroupState }): React.ReactElement {
  const { meshRef, materialInfo, geometry, capacity, baseColor } = group;
  useBloomRegistration(meshRef, { group: 'projectiles' });

  useEffect(() => {
    // Initialize mesh attributes via the group's manager (if attached)
    group.manager.initMesh();
    return () => {
      const mesh = meshRef.current;
      if (mesh && mesh.instanceColor) {
        mesh.instanceColor = null;
      }
    };
  }, [meshRef, materialInfo.supportsInstanceColor, capacity, baseColor]);

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

  const ensureGroup = useCallback(
    (key: string): ProjectileGroupState => {
      const existing = groupsRef.current.get(key);
      if (existing) return existing;
      const resolvedCapacity = Math.max(1, capacityByType?.[key] ?? defaultCapacity);
      const geometry = getProjectileGeometry(key);
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
      const key = projectile.projectile.bulletType ?? 'bullet:laser';
      keys.add(key);
    }
    for (const key of keys) {
      ensureGroup(key);
    }
  }, [projectiles, ensureGroup]);

  useFrame(() => {
    frameRef.current += 1;
    const frameId = frameRef.current;
    let totalAllocated = 0;
    let saturated = false;

    for (const group of groupsRef.current.values()) {
      group.manager.beginFrame();
      group.maxIndex = -1;
    }

    for (const projectile of projectiles) {
      const key = projectile.projectile.bulletType ?? 'bullet:laser';
      const group = ensureGroup(key);
      if (!group) continue;

      if (totalAllocated >= maxTotal) {
        saturated = true;
        continue;
      }

      const index = group.manager.allocate(projectile.id);
      if (index == null) {
        saturated = true;
        continue;
      }

      const mesh = group.meshRef.current;
      if (!mesh) continue;

      totalAllocated += 1;
      const cfg = getProjectileConfig(projectile.projectile.bulletType);
      const visualMultiplier = cfg.visualMultiplier ?? 1;
      const baseScale = projectile.transform.scale * visualMultiplier;
      const metadata = (group.geometry.userData.projectile ?? {}) as ProjectileGeometryMetadata;
      const category =
        projectile.projectile.category ?? metadata.category ?? cfg.category ?? 'bullet';

      if (category === 'beam' && projectile.projectile.beam) {
        const beam = projectile.projectile.beam;
        const baseLength = metadata.baseLength && metadata.baseLength > 0 ? metadata.baseLength : 1;
        const widthConfig = beam.width ?? cfg.beam?.width ?? metadata.baseWidth ?? baseScale;
        const baseWidth =
          metadata.baseWidth && metadata.baseWidth > 0 ? metadata.baseWidth : baseScale;
        let beamLength =
          beam.maxLength ?? projectile.projectile.speed * projectile.projectile.maxTtl;

        if (beam.hitPoint) {
          TEMP_POSITION.copy(beam.hitPoint).sub(projectile.transform.position);
          beamLength = TEMP_POSITION.length();
        }

        beamLength = Math.max(0.1, beamLength);
        const lengthScale = beamLength / baseLength;
        const widthScale = baseWidth > 0 ? widthConfig / baseWidth : baseScale;
        TEMP_SCALE.set(widthScale, widthScale, lengthScale);
        TEMP_POSITION.copy(projectile.transform.position).addScaledVector(
          projectile.direction,
          beamLength / 2,
        );
        TEMP_MATRIX.compose(TEMP_POSITION, projectile.transform.rotation, TEMP_SCALE);
      } else {
        TEMP_SCALE.setScalar(baseScale);
        TEMP_MATRIX.compose(
          projectile.transform.position,
          projectile.transform.rotation,
          TEMP_SCALE,
        );
      }
      group.manager.setMatrixAt(index, TEMP_MATRIX);
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
