import { useFrame } from '@react-three/fiber';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { InstancedMesh } from 'three';
import {
  AdditiveBlending,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  Matrix4,
  SphereGeometry,
  Vector3,
} from 'three';
import { TEAM_COLORS } from '../../config/renderer.js';
import type { Archetype, GameEntity, BeamVisualEntity } from '../../types/index.js';
import { useArchetypeEntities } from '../../hooks/useArchetypeEntities.js';
import { getProjectileGeometry } from '../../utils/projectileGeometries.js';
import {
  createInstancedMaterial,
  type InstancedMaterialInfo,
} from '../../renderer/materialRegistry.js';
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
  impactMeshRef: React.MutableRefObject<InstancedMesh | null>;
  bodyMaterialInfo: InstancedMaterialInfo;
  impactMaterialInfo: InstancedMaterialInfo;
  geometry: ReturnType<typeof getProjectileGeometry>;
  impactGeometry: SphereGeometry;
  baseColor: Color;
  maxIndex: number;
  impactMaxIndex: number;
  brightnessAttr?: InstancedBufferAttribute;
  impactBrightnessAttr?: InstancedBufferAttribute;
}

const DEFAULT_CAPACITY = 256;
const HIDDEN_MATRIX = new Matrix4().makeScale(0, 0, 0);
const TEMP_MATRIX = new Matrix4();
const TEMP_SCALE = new Vector3();
const TEMP_IMPACT_SCALE = new Vector3();
const TEMP_POS = new Vector3();
const TEMP_IMPACT_POS = new Vector3();
const TEMP_COLOR = new Color();
const TEMP_DIRECTION = new Vector3();
const TEMP_START = new Vector3();
const TEMP_END = new Vector3();
const FORWARD = new Vector3(0, 0, 1);
const BEAM_BRIGHTNESS_ATTR = 'instanceBeamBrightness';

export const MIN_VISIBLE_BEAM_LENGTH = 0.75;
// Hard visual cap to avoid screen-spanning beams in edge cases; damage logic is unaffected
export const MAX_RENDER_BEAM_LENGTH = 150;

const MIN_FADE_STRENGTH = 0;
const MAX_FADE_STRENGTH = 1;
const MIN_FADE_EXPONENT = 1;
const MAX_FADE_EXPONENT = 6;
const DISABLE_FADE_THRESHOLD = 1e-3;
const MIN_WORLD_WIDTH = 0.05;

const IMPACT_BASE_SCALE = 0.4;

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
  // Apply a hard cap for rendering to keep beams from spanning the entire screen in degenerate cases
  const hardCap = Math.max(minLength, MAX_RENDER_BEAM_LENGTH);
  const maxAllowed = safeMax > 0 ? Math.min(Math.max(minLength, safeMax), hardCap) : minLength;
  const effective = Math.max(safeLength, minLength);
  return Math.min(effective, maxAllowed);
}

function computeBeamOpacity(component: BeamVisualEntity['beamVisual']): number {
  const baseBrightness = computeBeamBrightness(component);
  const ttlFade = component.maxTtl > 0 ? clamp01(component.ttl / component.maxTtl) : 1;
  return clamp01(baseBrightness * ttlFade);
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

function initialiseInstancedMesh(
  meshRef: React.MutableRefObject<InstancedMesh | null>,
  supportsInstanceColor: boolean,
  group: BeamVisualGroupState,
  assignBrightness: (attr: InstancedBufferAttribute) => void,
): void {
  const mesh = meshRef.current;
  if (!mesh) return;
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.visible = false;
  if (supportsInstanceColor && !mesh.instanceColor) {
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(group.capacity * 3), 3);
    for (let i = 0; i < group.capacity; i += 1) {
      mesh.setColorAt(i, group.baseColor);
    }
    mesh.instanceColor.setUsage(DynamicDrawUsage);
    mesh.instanceColor.needsUpdate = true;
  }
  const attr = allocateBeamBrightnessAttribute(mesh, group.capacity);
  assignBrightness(attr);
}

function BeamVisualGroupMeshes({ group }: { group: BeamVisualGroupState }): React.ReactElement {
  const { meshRef, impactMeshRef, bodyMaterialInfo, impactMaterialInfo, geometry, impactGeometry, capacity } = group;

  useBloomRegistration(meshRef, { group: 'projectiles' });
  useBloomRegistration(impactMeshRef, { group: 'projectiles' });

  useEffect(() => {
    initialiseInstancedMesh(meshRef, group.bodyMaterialInfo.supportsInstanceColor, group, (attr) => {
      group.brightnessAttr = attr;
    });
    return () => {
      const mesh = meshRef.current;
      if (!mesh) return;
      if (mesh.instanceColor) {
        mesh.instanceColor = null;
      }
      mesh.geometry.deleteAttribute(BEAM_BRIGHTNESS_ATTR);
      group.brightnessAttr = undefined;
    };
  }, [meshRef, group]);

  useEffect(() => {
    initialiseInstancedMesh(impactMeshRef, group.impactMaterialInfo.supportsInstanceColor, group, (attr) => {
      group.impactBrightnessAttr = attr;
    });
    return () => {
      const mesh = impactMeshRef.current;
      if (!mesh) return;
      if (mesh.instanceColor) {
        mesh.instanceColor = null;
      }
      mesh.geometry.deleteAttribute(BEAM_BRIGHTNESS_ATTR);
      group.impactBrightnessAttr = undefined;
    };
  }, [impactMeshRef, group]);

  useEffect(
    () => () => {
      bodyMaterialInfo.material.dispose();
      impactMaterialInfo.material.dispose();
      geometry.dispose();
      impactGeometry.dispose();
    },
    [bodyMaterialInfo.material, impactMaterialInfo.material, geometry, impactGeometry],
  );

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[geometry, bodyMaterialInfo.material, capacity]}
        matrixAutoUpdate={false}
        frustumCulled={false}
      />
      <instancedMesh
        ref={impactMeshRef}
        args={[impactGeometry, impactMaterialInfo.material, capacity]}
        matrixAutoUpdate={false}
        frustumCulled={false}
      />
    </>
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
      const impactGeometry = new SphereGeometry(0.5, 12, 12);
      // Create two materials: body (depthTest=false) and impact (depthTest=true)
      const bodyMaterialInfo = createInstancedMaterial(key);
      bodyMaterialInfo.material.transparent = true;
      bodyMaterialInfo.material.depthWrite = false;
      bodyMaterialInfo.material.toneMapped = false;
      bodyMaterialInfo.material.blending = AdditiveBlending;
  // Beam body should render on top for readability; disable depthTest only on the body material
  bodyMaterialInfo.material.depthTest = false;

      const impactMaterialInfo = createInstancedMaterial(key);
      impactMaterialInfo.material.transparent = true;
      impactMaterialInfo.material.depthWrite = false;
      impactMaterialInfo.material.toneMapped = false;
      impactMaterialInfo.material.blending = AdditiveBlending;
  // Keep impact sphere depth-tested to stay grounded in the scene
  impactMaterialInfo.material.depthTest = true;
      const allocator = new InstanceAllocator<number>(resolvedCapacity);
      const meshRef: React.MutableRefObject<InstancedMesh | null> = { current: null };
      const impactMeshRef: React.MutableRefObject<InstancedMesh | null> = { current: null };
      const baseColor = new Color(1, 1, 1);

      const brightnessArray = new Float32Array(resolvedCapacity);
      brightnessArray.fill(1);
      const attr = new InstancedBufferAttribute(brightnessArray, 1);
      attr.setUsage(DynamicDrawUsage);
      attr.needsUpdate = true;
      geometry.setAttribute(BEAM_BRIGHTNESS_ATTR, attr);

      const impactBrightnessArray = new Float32Array(resolvedCapacity);
      impactBrightnessArray.fill(1);
      const impactAttr = new InstancedBufferAttribute(impactBrightnessArray, 1);
      impactAttr.setUsage(DynamicDrawUsage);
      impactAttr.needsUpdate = true;
      impactGeometry.setAttribute(BEAM_BRIGHTNESS_ATTR, impactAttr);

      const group: BeamVisualGroupState = {
        key,
        capacity: resolvedCapacity,
        allocator,
        meshRef,
        impactMeshRef,
        bodyMaterialInfo,
        impactMaterialInfo,
        geometry,
        impactGeometry,
        baseColor,
        maxIndex: -1,
        impactMaxIndex: -1,
        brightnessAttr: attr,
        impactBrightnessAttr: impactAttr,
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
      group.impactMaxIndex = -1;
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
      const impactMesh = group.impactMeshRef.current;
      if (!mesh || !impactMesh) continue;

      totalAllocated += 1;
      const visualScale = Number.isFinite(beamVisual.transform.scale)
        ? beamVisual.transform.scale
        : 1;

      const widthRaw = beamVisual.beamVisual.width * visualScale;
      const lengthRaw = beamVisual.beamVisual.length * visualScale;
      const maxLengthRaw = beamVisual.beamVisual.maxLength * visualScale;

      const renderWidth = Number.isFinite(widthRaw)
        ? Math.max(Math.abs(widthRaw), MIN_WORLD_WIDTH)
        : MIN_WORLD_WIDTH;
      const renderLength = resolveBeamRenderLength(lengthRaw, renderWidth, maxLengthRaw);

      const transform = beamVisual.transform;
      const direction = beamVisual.direction;
      if (direction && direction.lengthSq() > 1e-6) {
        TEMP_DIRECTION.copy(direction).normalize();
      } else {
        TEMP_DIRECTION.copy(FORWARD).applyQuaternion(transform.rotation);
      }

      TEMP_START.copy(transform.position);
      TEMP_END.copy(TEMP_DIRECTION).multiplyScalar(renderLength).add(TEMP_START);

      const beamOffset = renderLength * 0.5;
      TEMP_POS.copy(TEMP_START).addScaledVector(TEMP_DIRECTION, beamOffset);

      TEMP_SCALE.set(renderWidth, renderWidth, renderLength);
      TEMP_MATRIX.compose(TEMP_POS, transform.rotation, TEMP_SCALE);
      mesh.setMatrixAt(index, TEMP_MATRIX);

      const opacity = computeBeamOpacity(beamVisual.beamVisual);

      TEMP_IMPACT_POS.copy(TEMP_END);
      const impactScale =
        Math.max(renderWidth * 0.8, IMPACT_BASE_SCALE) + opacity * renderWidth * 0.9;
      TEMP_IMPACT_SCALE.setScalar(impactScale);
      TEMP_MATRIX.compose(TEMP_IMPACT_POS, transform.rotation, TEMP_IMPACT_SCALE);
      impactMesh.setMatrixAt(index, TEMP_MATRIX);
      const team = beamVisual.beamVisual.team ?? 'blue';
      const hex = (TEAM_COLORS as Record<string, string | undefined>)[team] ?? '#ffffff';
      const brightness = 1.2 + opacity * 0.6;
      TEMP_COLOR.set(hex).multiplyScalar(brightness);

      if (mesh.instanceColor && group.bodyMaterialInfo.supportsInstanceColor) {
        mesh.setColorAt(index, TEMP_COLOR);
      }
      if (impactMesh.instanceColor && group.impactMaterialInfo.supportsInstanceColor) {
        impactMesh.setColorAt(index, TEMP_COLOR);
      }

      if (group.brightnessAttr) {
        group.brightnessAttr.setX(index, opacity);
      }
      if (group.impactBrightnessAttr) {
        group.impactBrightnessAttr.setX(index, opacity);
      }

      mesh.instanceMatrix.needsUpdate = true;
      impactMesh.instanceMatrix.needsUpdate = true;
      group.maxIndex = Math.max(group.maxIndex, index);
      group.impactMaxIndex = Math.max(group.impactMaxIndex, index);
    }

    for (const group of groupsRef.current.values()) {
      const mesh = group.meshRef.current;
      const impactMesh = group.impactMeshRef.current;
      if (!mesh || !impactMesh) continue;

      const summary = group.allocator.endFrame();
      if (summary.saturated) saturated = true;

      for (const released of summary.released) {
        mesh.setMatrixAt(released, HIDDEN_MATRIX);
        impactMesh.setMatrixAt(released, HIDDEN_MATRIX);
      }

      const maxIndex = Math.max(group.maxIndex, summary.maxIndex);
      const impactMaxIndex = Math.max(group.impactMaxIndex, summary.maxIndex);
      const count = maxIndex >= 0 ? Math.min(maxIndex + 1, group.capacity) : 0;
      const impactCount = impactMaxIndex >= 0 ? Math.min(impactMaxIndex + 1, group.capacity) : 0;
      mesh.count = count;
      impactMesh.count = impactCount;
      mesh.visible = count > 0;
      impactMesh.visible = impactCount > 0;
      mesh.instanceMatrix.needsUpdate = true;
      impactMesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
      if (impactMesh.instanceColor) {
        impactMesh.instanceColor.needsUpdate = true;
      }
      if (group.brightnessAttr) {
        group.brightnessAttr.needsUpdate = true;
      }
      if (group.impactBrightnessAttr) {
        group.impactBrightnessAttr.needsUpdate = true;
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
        <BeamVisualGroupMeshes key={group.key} group={group} />
      ))}
    </>
  );
}
