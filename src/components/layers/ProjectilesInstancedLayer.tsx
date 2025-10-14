import { useFrame } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { InstancedMesh } from 'three';
import {
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  Matrix4,
  Vector3,
} from 'three';
import { TEAM_COLORS } from '../../config/renderer.js';
import type { Archetype, GameEntity, ProjectileEntity } from '../../types/index.js';
import { useArchetypeEntities } from '../../hooks/useArchetypeEntities.js';
import { getProjectileCategory, getProjectileConfig } from '../../config/projectiles.js';
import { getProjectileGeometry } from '../../utils/projectileGeometries.js';
import { createInstancedMaterial, type InstancedMaterialInfo } from '../../renderer/materialRegistry.js';
import { useBloomRegistration } from '../../renderer/BloomProvider.js';
import { InstanceAllocator } from './instanceAllocator.js';
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
  allocator: InstanceAllocator<number>;
  meshRef: React.MutableRefObject<InstancedMesh | null>;
  materialInfo: InstancedMaterialInfo;
  geometry: ReturnType<typeof getProjectileGeometry>;
  baseColor: Color;
  maxIndex: number;
  isBeam: boolean;
  brightnessAttr?: InstancedBufferAttribute;
}

const DEFAULT_CAPACITY = 512;
const HIDDEN_MATRIX = new Matrix4().makeScale(0, 0, 0);
const TEMP_MATRIX = new Matrix4();
const TEMP_SCALE = new Vector3();
const TEMP_POS = new Vector3();
const TEMP_COLOR = new Color();
const BEAM_BRIGHTNESS_ATTR = 'instanceBeamBrightness';

export function allocateBeamBrightnessAttribute(
  mesh: InstancedMesh,
  capacity: number,
): InstancedBufferAttribute {
  const existing = mesh.geometry.getAttribute(BEAM_BRIGHTNESS_ATTR) as
    | InstancedBufferAttribute
    | undefined;
  if (existing && existing.count === capacity) {
    const arr = existing.array as Float32Array;
    for (let i = 0; i < capacity; i += 1) {
      arr[i] = 1;
    }
    existing.setUsage(DynamicDrawUsage);
    existing.needsUpdate = true;
    return existing;
  }

  const array = new Float32Array(capacity);
  for (let i = 0; i < capacity; i += 1) {
    array[i] = 1;
  }
  const attr = new InstancedBufferAttribute(array, 1);
  attr.setUsage(DynamicDrawUsage);
  attr.needsUpdate = true;
  mesh.geometry.setAttribute(BEAM_BRIGHTNESS_ATTR, attr);
  return attr;
}

function ProjectileGroupMesh({ group }: { group: ProjectileGroupState }): React.ReactElement {
  const { meshRef, materialInfo, geometry, capacity, baseColor } = group;
  useBloomRegistration(meshRef, { group: 'projectiles' });

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (materialInfo.supportsInstanceColor && !mesh.instanceColor) {
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
      for (let i = 0; i < capacity; i += 1) {
        mesh.setColorAt(i, baseColor);
      }
      mesh.instanceColor.setUsage(DynamicDrawUsage);
      mesh.instanceColor.needsUpdate = true;
    }
    if (group.isBeam) {
      group.brightnessAttr = allocateBeamBrightnessAttribute(mesh, capacity);
    } else {
      mesh.geometry.deleteAttribute(BEAM_BRIGHTNESS_ATTR);
      group.brightnessAttr = undefined;
    }
    return () => {
      if (mesh.instanceColor) {
        mesh.instanceColor = null;
      }
      if (group.isBeam) {
        mesh.geometry.deleteAttribute(BEAM_BRIGHTNESS_ATTR);
        group.brightnessAttr = undefined;
      }
    };
  }, [meshRef, materialInfo.supportsInstanceColor, capacity, baseColor, group]);

  useEffect(() => () => {
    materialInfo.material.dispose();
  }, [materialInfo.material]);

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
      const geometry = getProjectileGeometry(key).clone();
      const materialInfo = createInstancedMaterial(key);
      const allocator = new InstanceAllocator<number>(resolvedCapacity);
      const meshRef: React.MutableRefObject<InstancedMesh | null> = { current: null };
      const baseColor = new Color(1, 1, 1);
      const isBeam = getProjectileCategory(key) === 'beam';
      let brightnessAttr: InstancedBufferAttribute | undefined;
      if (isBeam) {
        const array = new Float32Array(resolvedCapacity);
        array.fill(1);
        const attr = new InstancedBufferAttribute(array, 1);
        attr.setUsage(DynamicDrawUsage);
        attr.needsUpdate = true;
        geometry.setAttribute(BEAM_BRIGHTNESS_ATTR, attr);
        brightnessAttr = attr;
      }
      const group: ProjectileGroupState = {
        key,
        capacity: resolvedCapacity,
        allocator,
        meshRef,
        materialInfo,
        geometry,
        baseColor,
        maxIndex: -1,
        isBeam,
        brightnessAttr,
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
      group.allocator.beginFrame();
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

      const index = group.allocator.allocate(projectile.id);
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
      // If this projectile is a beam, scale non-uniformly: width for X/Y, length for Z.
      if (projectile.projectile.category === 'beam' && projectile.projectile.beam) {
        const beamCfg = projectile.projectile.beam;
        const width = (beamCfg.width ?? 1) * baseScale;
        const length = (beamCfg.length ?? 1) * baseScale;
        // Cylinder geometry was created with length along Z (rotated in geometry creation),
        // so scale.x/scale.y control diameter and scale.z controls length.
        TEMP_SCALE.set(width, width, length);
        // Offset beam position forward by half its length so it originates from the muzzle
        // instead of being centered on it (cylinder geometry is centered at origin)
        const beamOffset = length * 0.5;
        TEMP_POS.copy(projectile.transform.position)
          .addScaledVector(projectile.direction, beamOffset);
        TEMP_MATRIX.compose(TEMP_POS, projectile.transform.rotation, TEMP_SCALE);
      } else {
        TEMP_SCALE.setScalar(baseScale);
        TEMP_MATRIX.compose(projectile.transform.position, projectile.transform.rotation, TEMP_SCALE);
      }
      mesh.setMatrixAt(index, TEMP_MATRIX);
      // Set instance color when supported. Use team tint and fade with distance for beams.
      if (mesh.instanceColor && group.materialInfo.supportsInstanceColor) {
        const team = projectile.projectile.team ?? 'blue';
        const hex = (TEAM_COLORS as any)[team] ?? '#ffffff';
        TEMP_COLOR.set(hex);
        if (projectile.projectile.category === 'beam' && projectile.projectile.beam) {
          const len = projectile.projectile.beam.length ?? 2000;
          const t = Math.min(len / 2000, 1);
          const dim = 1 - 0.6 * t; // fade to 40% at max distance
          TEMP_COLOR.multiplyScalar(dim);
        }
        mesh.setColorAt(index, TEMP_COLOR);
      }
      if (group.isBeam && group.brightnessAttr) {
        group.brightnessAttr.setX(index, 1);
      }
      mesh.instanceMatrix.needsUpdate = true;
      group.maxIndex = Math.max(group.maxIndex, index);
    }

    for (const group of groupsRef.current.values()) {
      const mesh = group.meshRef.current;
      if (!mesh) continue;
      const summary = group.allocator.endFrame();
      if (summary.saturated) saturated = true;

      for (const released of summary.released) {
        mesh.setMatrixAt(released, HIDDEN_MATRIX);
      }

      const maxIndex = Math.max(group.maxIndex, summary.maxIndex);
      const count = maxIndex >= 0 ? Math.min(maxIndex + 1, group.capacity) : 0;
      mesh.count = count;
      mesh.visible = count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
      if (group.isBeam && group.brightnessAttr) {
        group.brightnessAttr.needsUpdate = true;
      }
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
