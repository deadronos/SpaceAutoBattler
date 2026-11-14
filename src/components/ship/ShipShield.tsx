import type React from 'react';
import { useRef, useMemo } from 'react';
import { Color, SphereGeometry, type Mesh, type ShaderMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import type { ShipEntity, ShieldRipple } from '../../types/index.js';
import {
  getShieldVisuals,
  SHIELD_RIPPLE_TUNING,
  TEAM_COLORS,
  HULL_TINT,
} from '../../config/renderer.js';
import { getMaterial } from '../../renderer/materialRegistry.js';
import { useOptionalGameState } from '../../app/context.js';
import { useBloomRegistration, type BloomRegistrationOptions } from '../../renderer/bloom/index.js';
import type { HullMaterial } from './ShipModel.js';
import { applyHullTint } from './ShipModel.js';
import { normalizedShieldFraction, resolveShieldGeometrySegments } from './shieldUtils.js';
import { processRipplesForRendering } from './rippleUtils.js';
import type {
  ShieldHexMaterialProps,
  ShieldTransmissionMaterialProps,
} from '../../renderer/shields/index.js';
import type { ShieldHexUniforms } from '../../types/renderer.js';
import { updateShieldHexRipples } from '../../renderer/shields/useShieldHexUniforms.js';

const SHIELD_BLOOM_OPTIONS: BloomRegistrationOptions = { group: 'shields' };
const EMPTY_RIPPLES: readonly ShieldRipple[] = [];
const TEAM_TINTS = { blue: new Color(TEAM_COLORS.blue), red: new Color(TEAM_COLORS.red) };
const minShieldThreshold = 0.01;
const SHARED_SHIELD_GEOMETRIES = new Map<number, SphereGeometry>();

/** Returns a shared unit `SphereGeometry` for the requested segment tier. */
export function getSharedShieldGeometry(segments: number): SphereGeometry {
  const key = Math.max(8, Math.floor(segments));
  let geometry = SHARED_SHIELD_GEOMETRIES.get(key);
  if (!geometry) {
    geometry = new SphereGeometry(1, key, key);
    SHARED_SHIELD_GEOMETRIES.set(key, geometry);
  }
  return geometry;
}

function clampScaleMultiplier(value: number): number {
  return Math.max(0.05, Math.min(Number.isFinite(value) ? value : 0.05, 8));
}

/** Render order for the transparent shield bubble. */
export const SHIELD_RENDER_ORDER = 20;

const FALLBACK_SHIELD_RADIUS_BY_HULL: Record<ShipEntity['ship']['hull'], number> = {
  fighter: 1.8,
  corvette: 2.3,
  frigate: 3.0,
  destroyer: 3.7,
  carrier: 4.6,
};

interface ShieldBubbleProps {
  entity: ShipEntity;
  radius?: number;
  hullMaterialsRef?: React.MutableRefObject<HullMaterial[]>;
}

/**
 * Renders the energy shield bubble around a ship.
 * Handles visibility based on shield HP, ripple effects, and material resolution.
 *
 * @param {ShieldBubbleProps} props - Component props.
 * @returns {React.ReactElement} The rendered shield mesh.
 */
export function ShieldBubble({
  entity,
  radius,
  hullMaterialsRef,
}: ShieldBubbleProps): React.ReactElement {
  const meshRef = useRef<Mesh>(null);
  useBloomRegistration(meshRef, SHIELD_BLOOM_OPTIONS);
  const state = useOptionalGameState();
  const rippleCache = useRef({
    material: null as ShaderMaterial | null,
    list: EMPTY_RIPPLES,
    count: 0,
    latest: undefined as ShieldRipple | undefined,
  });

  const visuals = getShieldVisuals(entity.ship.hull);
  const { x, y, z } = visuals.shieldScale;
  const r = radius ?? FALLBACK_SHIELD_RADIUS_BY_HULL[entity.ship.hull] ?? 2.0;
  const sx = clampScaleMultiplier(x) * r;
  const sy = clampScaleMultiplier(y) * r;
  const sz = clampScaleMultiplier(z) * r;
  const initialSegments = resolveShieldGeometrySegments(0, visuals.geometrySegments);
  const segmentsRef = useRef(initialSegments);
  const initialGeometry = useMemo(
    () => getSharedShieldGeometry(initialSegments),
    [initialSegments],
  );

  useFrame(({ camera }) => {
    const { shield, maxShield, team } = entity.ship;
    const materials = hullMaterialsRef?.current;
    if (materials?.length) {
      applyHullTint(
        materials,
        shield / Math.max(1, maxShield),
        TEAM_TINTS[team],
        HULL_TINT.tintThreshold,
        HULL_TINT.tintStrength,
      );
    }

    const mesh = meshRef.current;
    if (!mesh) return;

    const shieldFraction = normalizedShieldFraction(shield, maxShield);
    mesh.visible = shieldFraction >= minShieldThreshold;
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(sx, sy, sz);

    const dist =
      camera?.position && entity.transform?.position
        ? camera.position.distanceTo(entity.transform.position)
        : 0;
    const targetSegments = resolveShieldGeometrySegments(
      dist,
      visuals.geometrySegments,
      segmentsRef.current,
    );
    if (targetSegments !== segmentsRef.current) {
      segmentsRef.current = targetSegments;
      mesh.geometry = getSharedShieldGeometry(targetSegments);
    }

    const material = mesh.material;
    if (Array.isArray(material)) return;

    const shader = material as ShaderMaterial;
    if (!shader.isShaderMaterial) {
      // Drei checks material visibility before rendering its transmission buffer.
      material.visible = mesh.visible;
      material.opacity = Math.min(1, shieldFraction * visuals.maxAlpha);
      return;
    }

    const uniforms = shader.uniforms as unknown as ShieldHexUniforms;
    if (!uniforms.uOpacity) return;
    uniforms.uOpacity.value = shieldFraction;

    const list = entity.shieldRipples ?? EMPTY_RIPPLES;
    const latest = list[list.length - 1];
    const cache = rippleCache.current;
    if (
      cache.material !== shader ||
      cache.list !== list ||
      cache.count !== list.length ||
      cache.latest !== latest
    ) {
      const queue = list.length
        ? processRipplesForRendering(list, SHIELD_RIPPLE_TUNING)
        : EMPTY_RIPPLES;
      updateShieldHexRipples(uniforms, queue, state?.time ?? 0);
      cache.material = shader;
      cache.list = list;
      cache.count = list.length;
      cache.latest = latest;
    }
  });

  type ShieldMaterialProps = ShieldHexMaterialProps &
    Pick<ShieldTransmissionMaterialProps, 'visible'>;
  const Mat =
    getMaterial<ShieldMaterialProps>(`shield:${visuals.materialKind}`) ??
    getMaterial<ShieldMaterialProps>('shield:hex')!;
  const opacity = normalizedShieldFraction(entity.ship.shield, entity.ship.maxShield);

  const visible = opacity >= minShieldThreshold;

  return (
    <mesh
      ref={meshRef}
      geometry={initialGeometry}
      visible={visible}
      renderOrder={SHIELD_RENDER_ORDER}
      frustumCulled={false}
    >
      <Mat hull={entity.ship.hull} team={entity.ship.team} opacity={opacity} visible={visible} />
    </mesh>
  );
}
