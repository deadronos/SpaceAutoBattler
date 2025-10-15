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
import type { Archetype, GameEntity, BeamVisualEntity } from '../../types/index.js';
import { useArchetypeEntities } from '../../hooks/useArchetypeEntities.js';
import { getProjectileGeometry } from '../../utils/projectileGeometries.js';
import { createInstancedMaterial, type InstancedMaterialInfo } from '../../renderer/materialRegistry.js';
import { useBloomRegistration } from '../../renderer/BloomProvider.js';
import { InstanceAllocator } from './instanceAllocator.js';
import { createSaturationWarningState, warnOnSaturation } from './saturationWarning.js';

interface BeamVisualsInstancedLayerProps {
  archetype: Archetype<GameEntity, ['beamVisual']>;
  capacityByType?: Partial<Record<string, number>>;
  defaultCapacity?: number;
  maxTotal?: number;
}

interface BeamVisualGroupState {
  key: string;
  capacity: number;
  allocator: InstanceAllocator<number>;
  meshRef: React.MutableRefObject<InstancedMesh | null>;
  materialInfo: InstancedMaterialInfo;
  geometry: ReturnType<typeof getProjectileGeometry>;
  baseColor: Color;
  maxIndex: number;
  brightnessAttr?: InstancedBufferAttribute;
}

const DEFAULT_CAPACITY = 256;
const HIDDEN_MATRIX = new Matrix4().makeScale(0, 0, 0);
const TEMP_MATRIX = new Matrix4();
const TEMP_SCALE = new Vector3();
const TEMP_POS = new Vector3();
const TEMP_COLOR = new Color();
const BEAM_BRIGHTNESS_ATTR = 'instanceBeamBrightness';

export const MIN_VISIBLE_BEAM_LENGTH = 0.75;

const MIN_FADE_STRENGTH = 0;
const MAX_FADE_STRENGTH = 1;
const MIN_FADE_EXPONENT = 1;
const MAX_FADE_EXPONENT = 6;
const DISABLE_FADE_THRESHOLD = 1e-3;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function computeBeamBrightness(component: BeamVisualEntity['beamVisual']): number {
  const fade = component.fade;
  if (!fade) {
    return 1;
  }
  const rawStrength = Number.isFinite(fade.strength ?? NaN) ? (fade.strength as number) : 0;
  const rawExponent = Number.isFinite(fade.exponent ?? NaN) ? (fade.exponent as number) : 1;
  const strength = Math.min(Math.max(rawStrength, MIN_FADE_STRENGTH), MAX_FADE_STRENGTH);
  if (strength <= DISABLE_FADE_THRESHOLD) {
    return 1;
  }
  const exponent = Math.min(Math.max(rawExponent, MIN_FADE_EXPONENT), MAX_FADE_EXPONENT);
  const maxLength = Number.isFinite(component.maxLength ?? NaN)
    ? Math.max(Math.abs(component.maxLength as number), MIN_VISIBLE_BEAM_LENGTH)
    : MIN_VISIBLE_BEAM_LENGTH;
  const length = Number.isFinite(component.length ?? NaN)
    ? Math.max(component.length as number, 0)
    : 0;
  const ratio = clamp01(maxLength > 1e-5 ? length / maxLength : 0);
  const curve = Math.pow(ratio, exponent);
  const brightness = 1 - strength * curve;
  return clamp01(brightness);
}

export function resolveBeamRenderLength(
  rawLength: number,
  width: number,
  maxLength: number,
): number {
  const safeLength = Number.isFinite(rawLength) ? Math.max(rawLength, 0) : 0;
  const safeWidth = Number.isFinite(width) ? Math.max(Math.abs(width), 0) : 0;
  const safeMax = Number.isFinite(maxLength) ? Math.max(Math.abs(maxLength), 0) : 0;

  const minLength = Math.max(MIN_VISIBLE_BEAM_LENGTH, safeWidth * 0.6);
  const maxAllowed = safeMax > 0 ? Math.max(minLength, safeMax) : minLength;
  const effective = Math.max(safeLength, minLength);
  return Math.min(effective, maxAllowed);
}

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

function BeamVisualGroupMesh({ group }: { group: BeamVisualGroupState }): React.ReactElement {
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
    // All beam visuals get brightness attribute
    group.brightnessAttr = allocateBeamBrightnessAttribute(mesh, capacity);
    
    return () => {
      if (mesh.instanceColor) {
        mesh.instanceColor = null;
      }
      mesh.geometry.deleteAttribute(BEAM_BRIGHTNESS_ATTR);
      group.brightnessAttr = undefined;
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

export function BeamVisualsInstancedLayer({
  archetype,
  capacityByType,
  defaultCapacity = DEFAULT_CAPACITY,
  maxTotal = Number.POSITIVE_INFINITY,
}: BeamVisualsInstancedLayerProps): React.ReactElement {
  const beamVisuals = useArchetypeEntities<BeamVisualEntity>(archetype);
  const groupsRef = useRef<Map<string, BeamVisualGroupState>>(new Map());
  const [, forceRender] = useState(0);
  const warningStateRef = useRef(createSaturationWarningState());
  const frameRef = useRef(0);

  const ensureGroup = useCallback(
    (key: string): BeamVisualGroupState => {
      const existing = groupsRef.current.get(key);
      if (existing) return existing;
      const resolvedCapacity = Math.max(1, capacityByType?.[key] ?? defaultCapacity);
      const geometry = getProjectileGeometry(key).clone();
      const materialInfo = createInstancedMaterial(key);
      const allocator = new InstanceAllocator<number>(resolvedCapacity);
      const meshRef: React.MutableRefObject<InstancedMesh | null> = { current: null };
      const baseColor = new Color(1, 1, 1);
      
      // Allocate brightness attribute on geometry
      const array = new Float32Array(resolvedCapacity);
      array.fill(1);
      const attr = new InstancedBufferAttribute(array, 1);
      attr.setUsage(DynamicDrawUsage);
      attr.needsUpdate = true;
      geometry.setAttribute(BEAM_BRIGHTNESS_ATTR, attr);
      
      const group: BeamVisualGroupState = {
        key,
        capacity: resolvedCapacity,
        allocator,
        meshRef,
        materialInfo,
        geometry,
        baseColor,
        maxIndex: -1,
        brightnessAttr: attr,
      };
      groupsRef.current.set(key, group);
      forceRender((n) => n + 1);
      return group;
    },
    [capacityByType, defaultCapacity],
  );

  useEffect(() => {
    const keys = new Set<string>();
    for (const beamVisual of beamVisuals) {
      const key = beamVisual.beamVisual.bulletType ?? 'beam:laser';
      keys.add(key);
    }
    for (const key of keys) {
      ensureGroup(key);
    }
  }, [beamVisuals, ensureGroup]);

  useFrame(() => {
    frameRef.current += 1;
    const frameId = frameRef.current;
    let totalAllocated = 0;
    let saturated = false;

    for (const group of groupsRef.current.values()) {
      group.allocator.beginFrame();
      group.maxIndex = -1;
    }

    for (const beamVisual of beamVisuals) {
      const key = beamVisual.beamVisual.bulletType ?? 'beam:laser';
      const group = ensureGroup(key);
      if (!group) continue;

      if (totalAllocated >= maxTotal) {
        saturated = true;
        continue;
      }

      const index = group.allocator.allocate(beamVisual.id);
      if (index == null) {
        saturated = true;
        continue;
      }

      const mesh = group.meshRef.current;
      if (!mesh) continue;

      totalAllocated += 1;
      const visualScale = Number.isFinite(beamVisual.transform.scale)
        ? beamVisual.transform.scale
        : 1;

      const widthRaw = beamVisual.beamVisual.width * visualScale;
      const lengthRaw = beamVisual.beamVisual.length * visualScale;
      const maxLengthRaw = beamVisual.beamVisual.maxLength * visualScale;

      const renderWidth = Number.isFinite(widthRaw) ? Math.max(Math.abs(widthRaw), 1e-3) : 1e-3;
      const renderLength = resolveBeamRenderLength(lengthRaw, renderWidth, maxLengthRaw);

      // Cylinder geometry has length along Z, so X/Y control diameter and Z controls length
      TEMP_SCALE.set(renderWidth, renderWidth, renderLength);

      // Offset beam position forward by half its length so it originates from the muzzle
      const beamOffset = renderLength * 0.5;
      TEMP_POS.copy(beamVisual.transform.position)
        .addScaledVector(beamVisual.direction, beamOffset);
      
      TEMP_MATRIX.compose(TEMP_POS, beamVisual.transform.rotation, TEMP_SCALE);
      mesh.setMatrixAt(index, TEMP_MATRIX);
      
      const brightness = computeBeamBrightness(beamVisual.beamVisual);

      // Set instance color with team tint and optional fade brightness
      if (mesh.instanceColor && group.materialInfo.supportsInstanceColor) {
        const team = beamVisual.beamVisual.team ?? 'blue';
        const hex = (TEAM_COLORS as any)[team] ?? '#ffffff';
        TEMP_COLOR.set(hex);

        TEMP_COLOR.multiplyScalar(brightness);
        
        mesh.setColorAt(index, TEMP_COLOR);
      }
      
      // Set brightness attribute
      if (group.brightnessAttr) {
        group.brightnessAttr.setX(index, brightness);
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
      if (group.brightnessAttr) {
        group.brightnessAttr.needsUpdate = true;
      }
    }

    warnOnSaturation({
      saturated,
      frameId,
      state: warningStateRef.current,
      message: '[BeamVisualsInstancedLayer] Capacity saturated, clamping beam visual render count.',
    });
  });

  return (
    <>
      {Array.from(groupsRef.current.values()).map((group) => (
        <BeamVisualGroupMesh key={group.key} group={group} />
      ))}
    </>
  );
}
