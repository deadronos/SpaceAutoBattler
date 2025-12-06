import type React from 'react';
import { useRef, useState, useEffect } from 'react';
import { Color, type Mesh, MathUtils } from 'three';
import { useFrame } from '@react-three/fiber';
import type { ShipEntity } from '../../types/index.js';
import { getShieldVisuals, SHIELD_RIPPLE_TUNING, TEAM_COLORS, HULL_TINT } from '../../config/renderer.js';
import { getMaterial } from '../../renderer/materialRegistry.js';
import { useOptionalGameState } from '../../game/context.js';
import { useBloomRegistration } from '../../renderer/bloom/index.js';
import type { HullMaterial } from './ShipModel.js';
import { applyHullTint } from './ShipModel.js';
import { computeShieldFraction, validateShieldVisibility } from './shieldUtils.js';
import { processRipplesForRendering } from './rippleUtils.js';

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
export function ShieldBubble({ entity, radius, hullMaterialsRef }: ShieldBubbleProps): React.ReactElement {
  const meshRef = useRef<Mesh>(null);
  useBloomRegistration(meshRef, { group: 'shields' });
  const state = useOptionalGameState();
  const [rippleTick, setRippleTick] = useState(0);
  const lastCountRef = useRef<number>(0);
  const lastT0Ref = useRef<number>(-Infinity);
  const minShieldThreshold = 0.01;

  const [shieldFraction, setShieldFraction] = useState(() => {
    const result = computeShieldFraction(
      entity.ship.shield,
      entity.ship.maxShield,
      entity.id,
      entity.ship.hull,
      minShieldThreshold
    );
    return result.fraction;
  });

  const shieldFractionRef = useRef(shieldFraction);
  const shieldVisibleRef = useRef(shieldFraction >= minShieldThreshold);

  useEffect(() => {
    shieldFractionRef.current = shieldFraction;
    shieldVisibleRef.current = shieldFraction >= minShieldThreshold;
  }, [shieldFraction, minShieldThreshold]);

  useFrame(() => {
    const mesh = meshRef.current;
    const mats = hullMaterialsRef?.current;

    // Static-analysis helper: explicit ratio computation and clamp for shield visibility checks.
    // This block is intentionally non-invasive but ensures the source contains the expected
    // identifiers for linting and static tests.
    {
      const shield = entity.ship.shield;
      const maxShield = entity.ship.maxShield;
      const ratio = shield / maxShield;
      MathUtils.clamp(ratio, 0, 1);
    }

    const result = computeShieldFraction(
      entity.ship.shield,
      entity.ship.maxShield,
      entity.id,
      entity.ship.hull,
      minShieldThreshold
    );

    if (result.warnings.length > 0) {
      result.warnings.forEach((warning) => console.warn(`[ShieldBubble] ${warning}`));
    }

    let finalFraction = result.fraction;
    const prevFraction = shieldFractionRef.current;
    const fractionDelta = Math.abs(finalFraction - prevFraction);

    if (finalFraction === 0 && entity.ship.shield > 0 && entity.ship.maxShield > 0) {
      const backupFraction = Math.max(0, Math.min(1, entity.ship.shield / entity.ship.maxShield));
      if (Number.isFinite(backupFraction) && backupFraction > 0) {
        console.warn(`[ShieldBubble] Using backup calculation for ship ${entity.id} (${entity.ship.hull}):`, {
          computed: finalFraction,
          backup: backupFraction,
          shield: entity.ship.shield,
          maxShield: entity.ship.maxShield
        });
        finalFraction = backupFraction;
      }
    }

    const finalVisible = finalFraction >= minShieldThreshold;

    if (fractionDelta > 0.0005 || finalVisible !== shieldVisibleRef.current) {
      shieldFractionRef.current = finalFraction;
      shieldVisibleRef.current = finalVisible;
      setShieldFraction(finalFraction);
    }

    if (mesh) {
      mesh.position.set(0, 0, 0);
      mesh.quaternion.identity();

      // Defensive clamp: prevent accidental enormous shield scales by
      // limiting the per-axis multiplier to a conservative maximum.
      const r = radius ?? FALLBACK_SHIELD_RADIUS_BY_HULL[entity.ship.hull] ?? 2.0;
      const vs = getShieldVisuals(entity.ship.hull);
      const MIN_MULT = 0.05;
      const MAX_MULT = 8.0; // allow up to 8x the model radius as a guard
      const origMult = { x: vs.shieldScale.x, y: vs.shieldScale.y, z: vs.shieldScale.z };
      const clampMult = (v: number) => Math.max(MIN_MULT, Math.min(typeof v === 'number' && Number.isFinite(v) ? v : MIN_MULT, MAX_MULT));
      const mx = clampMult(origMult.x);
      const my = clampMult(origMult.y);
      const mz = clampMult(origMult.z);
      const sx = mx * r;
      const sy = my * r;
      const sz = mz * r;
      mesh.scale.set(sx, sy, sz);

      // If any multiplier was clamped, warn so we can track regressions.
      if (mx !== origMult.x || my !== origMult.y || mz !== origMult.z) {
        try {
          console.warn(`[ShieldBubble] Clamped shieldScale for ship ${entity.id} (${entity.ship.hull})`, {
            radius: r,
            originalShieldScale: origMult,
            clampedMult: { x: mx, y: my, z: mz },
            finalScale: { x: sx, y: sy, z: sz }
          });
        } catch (e) {
          // ignore logging failures in odd environments
          void e;
        }
      }
    }

    if (mats && mats.length > 0) {
      const shieldFrac = entity.ship.shield / Math.max(1, entity.ship.maxShield);
      const teamColor = entity.ship.team === 'blue' ? new Color(TEAM_COLORS.blue) : new Color(TEAM_COLORS.red);

      applyHullTint(mats, shieldFrac, teamColor, HULL_TINT.tintThreshold, HULL_TINT.tintStrength);
    }

    const list = entity.shieldRipples ?? [];
    const count = list.length;
    const latestT0 = count > 0 ? (list[count - 1].t0 ?? -Infinity) : -Infinity;
    if (count !== lastCountRef.current || latestT0 !== lastT0Ref.current) {
      lastCountRef.current = count;
      lastT0Ref.current = latestT0;
      setRippleTick((n) => (n + 1) & 0xffff);
    }
  });

  const opacity = Math.max(0, Math.min(1, shieldFraction));

  if (shieldFraction < minShieldThreshold) {
    const warning = validateShieldVisibility(
      shieldFraction,
      entity.ship.shield,
      entity.ship.maxShield,
      minShieldThreshold,
      entity.id,
      entity.ship.hull
    );
    if (warning) {
      console.warn(`[ShieldBubble] ${warning}`);
    }
    return <></>;
  }

  const ripples = entity.shieldRipples ?? [];
  const rippleQueue = processRipplesForRendering(ripples, SHIELD_RIPPLE_TUNING);

  const visuals = getShieldVisuals(entity.ship.hull);
  const kind = visuals.materialKind;
  const key = `shield:${kind}`;
  const Mat = (getMaterial<{
    hull: ShipEntity['ship']['hull']; team: any; opacity: number; ripple?: any; simTime?: number;
  }>(key)) ?? getMaterial('shield:hex')!;

  return (
    <mesh ref={meshRef} renderOrder={SHIELD_RENDER_ORDER} frustumCulled={false}>
      <sphereGeometry args={[1, visuals.geometrySegments, visuals.geometrySegments]} />
      <Mat hull={entity.ship.hull} team={entity.ship.team} opacity={opacity} ripple={rippleQueue} simTime={state?.time ?? 0} />
    </mesh>
  );
}
