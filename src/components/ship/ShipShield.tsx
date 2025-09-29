import type React from 'react';
import { useRef, useState, useEffect } from 'react';
import { MathUtils, Color, type Mesh } from 'three';
import { useFrame } from '@react-three/fiber';
import type { ShipEntity, ShipHull } from '../../types/index.js';
import { getShieldVisuals, SHIELD_RIPPLE_TUNING, TEAM_COLORS, HULL_TINT } from '../../config/renderer.js';
import { getMaterial } from '../../renderer/materialRegistry.js';
import { useOptionalGameState } from '../../game/context.js';
import { useBloomRegistration } from '../../renderer/BloomProvider.js';
import type { HullMaterial } from './ShipModel.js';
import { applyHullTint } from './ShipModel.js';

export const SHIELD_RENDER_ORDER = 20;

const FALLBACK_SHIELD_RADIUS_BY_HULL: Record<ShipHull, number> = {
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

export function ShieldBubble({ entity, radius, hullMaterialsRef }: ShieldBubbleProps): React.ReactElement {
  const meshRef = useRef<Mesh>(null);
  useBloomRegistration(meshRef, { group: 'shields' });
  const state = useOptionalGameState();
  const [rippleTick, setRippleTick] = useState(0);
  const lastCountRef = useRef<number>(0);
  const lastT0Ref = useRef<number>(-Infinity);
  const minShieldThreshold = 0.01;

  const computeShieldFraction = () => {
    const maxShield = entity.ship.maxShield;
    const shield = entity.ship.shield;

    if (!Number.isFinite(maxShield) || maxShield <= 0) {
      if (maxShield !== 0) {
        console.warn(`[ShieldBubble] Ship ${entity.id} (${entity.ship.hull}) has invalid maxShield:`, maxShield);
      }
      return 0;
    }
    if (!Number.isFinite(shield)) {
      console.warn(`[ShieldBubble] Ship ${entity.id} (${entity.ship.hull}) has invalid shield:`, shield);
      return 0;
    }

    const ratio = shield / maxShield;
    if (!Number.isFinite(ratio)) {
      console.warn(`[ShieldBubble] Ship ${entity.id} (${entity.ship.hull}) computed invalid ratio:`, { shield, maxShield, ratio });
      return 0;
    }

    const fraction = MathUtils.clamp(ratio, 0, 1);

    if (fraction >= minShieldThreshold && fraction < 1.0) {
      console.debug(`[ShieldBubble] Ship ${entity.id} (${entity.ship.hull}) shield fraction: ${fraction.toFixed(3)} (${shield}/${maxShield})`);
    }

    return fraction;
  };

  const [shieldFraction, setShieldFraction] = useState(() => computeShieldFraction());
  const shieldFractionRef = useRef(shieldFraction);
  const shieldVisibleRef = useRef(shieldFraction >= minShieldThreshold);

  useEffect(() => {
    shieldFractionRef.current = shieldFraction;
    shieldVisibleRef.current = shieldFraction >= minShieldThreshold;
  }, [shieldFraction, minShieldThreshold]);

  useFrame(() => {
    const nextFraction = computeShieldFraction();
    const nextVisible = nextFraction >= minShieldThreshold;
    const prevFraction = shieldFractionRef.current;
    const fractionDelta = Math.abs(nextFraction - prevFraction);

    let finalFraction = nextFraction;
    if (nextFraction === 0 && entity.ship.shield > 0 && entity.ship.maxShield > 0) {
      const backupFraction = Math.max(0, Math.min(1, entity.ship.shield / entity.ship.maxShield));
      if (Number.isFinite(backupFraction) && backupFraction > 0) {
        console.warn(`[ShieldBubble] Using backup calculation for ship ${entity.id} (${entity.ship.hull}):`, {
          computed: nextFraction,
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
  });

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    
    const r = radius ?? FALLBACK_SHIELD_RADIUS_BY_HULL[entity.ship.hull] ?? 2.0;
    const vs = getShieldVisuals(entity.ship.hull);
    const sx = Math.max(0.05, vs.shieldScale.x) * r;
    const sy = Math.max(0.05, vs.shieldScale.y) * r;
    const sz = Math.max(0.05, vs.shieldScale.z) * r;
    mesh.scale.set(sx, sy, sz);
  });

  useFrame(() => {
    const mats = hullMaterialsRef?.current;
    if (!mats || mats.length === 0) return;
    
    const shieldFrac = entity.ship.shield / Math.max(1, entity.ship.maxShield);
    const teamColor = entity.ship.team === 'blue' ? new Color(TEAM_COLORS.blue) : new Color(TEAM_COLORS.red);
    
    applyHullTint(mats, shieldFrac, teamColor, HULL_TINT.tintThreshold, HULL_TINT.tintStrength);
  });

  useFrame(() => {
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
    if (entity.ship.shield > 0 && entity.ship.maxShield > 0) {
      const expectedFraction = entity.ship.shield / entity.ship.maxShield;
      if (expectedFraction >= minShieldThreshold) {
        console.warn(`[ShieldBubble] Shield bubble should be visible but isn't for ship ${entity.id} (${entity.ship.hull}):`, {
          shield: entity.ship.shield,
          maxShield: entity.ship.maxShield,
          expectedFraction: expectedFraction.toFixed(3),
          computedFraction: shieldFraction.toFixed(3),
          threshold: minShieldThreshold
        });
      }
    }
    return <></>;
  }

  const ripples = entity.shieldRipples ?? [];
  const maxRipples = SHIELD_RIPPLE_TUNING.maxRipples ?? 3;
  const scaled = ripples.map((r: any) => ({
    ...r,
    scaledAmp: Math.min(1.6, 0.25 + (r.amp ?? 0) * (SHIELD_RIPPLE_TUNING.ampScale ?? 1.9))
  }));
  
  const minAmp = SHIELD_RIPPLE_TUNING.minRenderAmp ?? 0.02;
  const significant = scaled.filter((s: any) => s.scaledAmp >= minAmp);
  
  const windowSec = SHIELD_RIPPLE_TUNING.coalesceWindow ?? 0.06;
  const coalesced: typeof significant = [];
  for (const s of significant) {
    if (coalesced.length === 0) {
      coalesced.push({ ...s });
      continue;
    }
    const last = coalesced[coalesced.length - 1];
    if ((s.t0 ?? 0) - (last.t0 ?? 0) <= windowSec) {
      last.scaledAmp = Math.min(1.6, last.scaledAmp + s.scaledAmp * 0.6);
      last.t0 = Math.min(last.t0 ?? s.t0, s.t0 ?? last.t0);
    } else {
      coalesced.push({ ...s });
    }
  }
  
  const sliced = coalesced.slice(Math.max(0, coalesced.length - maxRipples));
  const rippleQueue = sliced.map((s: any) => ({ dir: s.dir, t0: s.t0, amp: s.scaledAmp })) as any;

  const kind = getShieldVisuals(entity.ship.hull).materialKind;
  const key = `shield:${kind}`;
  const Mat = (getMaterial<{
    hull: ShipHull; team: any; opacity: number; ripple?: any; simTime?: number;
  }>(key)) ?? getMaterial('shield:hex')!;

  return (
    <mesh ref={meshRef} renderOrder={SHIELD_RENDER_ORDER} frustumCulled={false}>
      <sphereGeometry args={[1, 64, 64]} />
      <Mat hull={entity.ship.hull} team={entity.ship.team} opacity={opacity} ripple={rippleQueue} simTime={state?.time ?? 0} />
    </mesh>
  );
}
