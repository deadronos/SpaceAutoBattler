import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type React from 'react';
import { Box3, Color, Sphere, type Group, type Mesh } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useGLTF } from '@react-three/drei';
import type { ShipEntity, ShipHull } from '../types/index.js';
import { getShieldVisuals, HULL_TINT, TEAM_COLORS, SHIELD_RIPPLE_TUNING } from '../config/renderer.js';
import { useFrame as useRenderFrame } from '@react-three/fiber';
import { SHIP_MODEL_PATHS } from '../assets/ships.js';
import { getMaterial } from '../renderer/materialRegistry.js';

export function resolveModelPath(modelKey?: string): string {
  const key = (modelKey ?? 'fighter') as keyof typeof SHIP_MODEL_PATHS;
  return SHIP_MODEL_PATHS[key] ?? SHIP_MODEL_PATHS.fighter;
}

export function ShipObject({ entity }: { entity: ShipEntity }): React.ReactElement {
  const group = useRef<Group>(null);

  // Resolve path via helper to ensure it's always defined.
  const modelPath = resolveModelPath(entity.model);
  const hasValidPath = typeof modelPath === 'string' && modelPath.length > 0;

  // Use drei's useGLTF which provides caching and convenience helpers.
  const gltf = hasValidPath ? (useGLTF(modelPath) as GLTF) : null;
  const scene = useMemo(() => (gltf ? gltf.scene.clone(true) : null), [gltf?.scene]);

  // Collect mesh materials from the cloned scene so we can apply a subtle
  // team-color tint when the ship has no shields. We keep the original
  // material colors so we can restore them when shields return.
  const hullMaterialsRef = useRef<Array<{ material: any; originalColor: Color }>>([]);
  useEffect(() => {
    hullMaterialsRef.current = [];
    if (!scene) return;
    scene.traverse((obj: any) => {
      // Three.js Mesh objects have isMesh flag
      if (obj && obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m: any) => {
          if (m && m.color && typeof m.color.clone === 'function') {
            const entry: any = { material: m, originalColor: m.color.clone() };
            if (m.emissive && typeof m.emissive.clone === 'function') entry.originalEmissive = m.emissive.clone();
            hullMaterialsRef.current.push(entry);
          }
        });
      }
    });
  }, [scene]);

  // Compute a per-model bounding radius to size the shield bubble properly.
  const fallbackRadiusByHull: Record<ShipHull, number> = {
    fighter: 1.6,
    corvette: 2.1,
    frigate: 2.8,
    destroyer: 3.4,
    carrier: 4.4,
  };

  const modelRadius = useMemo(() => {
    // If scene not loaded, return a conservative fallback based on hull.
    if (!scene) return fallbackRadiusByHull[entity.ship.hull] ?? 2.0;
    const box = new Box3().setFromObject(scene);
    const sphere = new Sphere();
    box.getBoundingSphere(sphere);
    // Slight margin so the bubble sits outside the hull — configurable per hull.
    const { margin } = getShieldVisuals(entity.ship.hull);
    return sphere.radius * margin;
  }, [scene, entity.ship.hull]);

  useFrame(() => {
    const ref = group.current;
    if (!ref) return;
    ref.position.copy(entity.transform.position);
    ref.quaternion.copy(entity.transform.rotation);
    ref.scale.setScalar(entity.transform.scale);
  });

  // Ship object no longer renders turret gizmos or flashes; these are handled by TurretObject or projectile visuals.

  if (scene) {
    return (
      <group ref={group} dispose={null}>
        <primitive object={scene} />
        <ShieldBubble entity={entity} radius={modelRadius} hullMaterialsRef={hullMaterialsRef} />
      </group>
    );
  }

  // Fallback: render a simple placeholder if the model path is invalid.
  return (
    <group ref={group} dispose={null}>
      <mesh castShadow receiveShadow>
        <coneGeometry args={[0.6, 1.6, 6]} />
        <meshStandardMaterial color={entity.ship.team === 'blue' ? new Color(TEAM_COLORS.blue) : new Color(TEAM_COLORS.red)} />
      </mesh>
      <ShieldBubble entity={entity} radius={modelRadius} />
    </group>
  );
}

function ShieldBubble({ entity, radius, hullMaterialsRef }: { entity: ShipEntity; radius?: number; hullMaterialsRef?: React.MutableRefObject<Array<{ material: any; originalColor: Color }>> }): React.ReactElement {
  const meshRef = useRef<Mesh>(null);

  useRenderFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // Anchor to parent ship: local origin with identity rotation.
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    const fallbackByHull: Record<ShipHull, number> = {
      fighter: 1.8,
      corvette: 2.3,
      frigate: 3.0,
      destroyer: 3.7,
      carrier: 4.6,
    };
    const r = radius ?? fallbackByHull[entity.ship.hull] ?? 2.0;
    mesh.scale.setScalar(r);
  });
  // Apply subtle hull tint when shields are gone so the ship is still team-identifiable.
  useRenderFrame(() => {
    const mats = hullMaterialsRef?.current;
    if (!mats || mats.length === 0) return;
    // Threshold under which we consider shields 'gone' for tinting purposes.
    const shieldFraction = entity.ship.shield / Math.max(1, entity.ship.maxShield);
  const applyTint = shieldFraction <= HULL_TINT.tintThreshold;
  const teamColor = entity.ship.team === 'blue' ? new Color(TEAM_COLORS.blue) : new Color(TEAM_COLORS.red);
    for (const entry of mats) {
      const m = entry.material;
      if (!m || !m.color) continue;
      if (applyTint) {
  // Weak tint: lerp original color towards teamColor by configured strength
  const t = HULL_TINT.tintStrength;
        const target = entry.originalColor.clone().lerp(teamColor, t);
        m.color.copy(target);
        // If material has emissive, slightly tint it too (but subtle)
        if (m.emissive && typeof m.emissive.copy === 'function') {
          m.emissive.copy(target).multiplyScalar(0.08);
        }
      } else {
        // Restore original color
        m.color.copy(entry.originalColor);
        if (m.emissive && entry.material.emissive) {
          // Try to restore emissive to a dimmed version of original if we recorded it; otherwise clear
          if ((entry as any).originalEmissive) {
            m.emissive.copy((entry as any).originalEmissive);
          } else {
            m.emissive.setHex(0x000000);
          }
        }
      }
    }
  });
  // Derived props for material
  const s = entity.ship.shield / Math.max(1, entity.ship.maxShield);
  const opacity = Math.max(0, Math.min(1, s));
  const ripples = entity.shieldRipples ?? [];
  // Pass up to `maxRipples` latest ripples (oldest first in the array we send)
  const maxRipples = SHIELD_RIPPLE_TUNING.maxRipples ?? 3;
  const startIndex = Math.max(0, ripples.length - maxRipples);
  // Filter and aggregate:
  // - Scale amp using configured ampScale, drop ripples below minRenderAmp
  // - If many tiny ripples occur in quick succession, coalesce them into a single stronger ripple
  const scaled = ripples.map((r) => ({ ...r, scaledAmp: Math.min(1.6, 0.25 + (r.amp ?? 0) * (SHIELD_RIPPLE_TUNING.ampScale ?? 1.9)) }));
  const minAmp = SHIELD_RIPPLE_TUNING.minRenderAmp ?? 0.02;
  // Keep ripples above threshold
  const significant = scaled.filter((s) => s.scaledAmp >= minAmp);
  // Coalesce ripples that are very close in time by summing amp (clamped)
  const windowSec = SHIELD_RIPPLE_TUNING.coalesceWindow ?? 0.06;
  const coalesced: typeof significant = [];
  for (const s of significant) {
    if (coalesced.length === 0) {
      coalesced.push({ ...s });
      continue;
    }
    const last = coalesced[coalesced.length - 1];
  if ((s.t0 ?? 0) - (last.t0 ?? 0) <= windowSec) {
      // merge into last
      last.scaledAmp = Math.min(1.6, last.scaledAmp + s.scaledAmp * 0.6);
      // keep earliest t0 for ordering
      last.t0 = Math.min(last.t0 ?? s.t0, s.t0 ?? last.t0);
    } else {
      coalesced.push({ ...s });
    }
  }
  // Only keep the latest `maxRipples` entries
  const sliced = coalesced.slice(Math.max(0, coalesced.length - maxRipples));
  const rippleQueue = sliced.map((s) => ({ dir: s.dir, t0: s.t0, amp: s.scaledAmp }));
  // debug logging removed

  const kind = getShieldVisuals(entity.ship.hull).materialKind;
  const key = `shield:${kind}`;
  const Mat = (getMaterial<{
    hull: ShipHull; team: any; opacity: number; ripple?: any;
  }>(key)) ?? getMaterial('shield:hex')!;

  return (
    <mesh ref={meshRef} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[1, 64, 64]} />
      <Mat hull={entity.ship.hull} team={entity.ship.team} opacity={opacity} ripple={rippleQueue} />
    </mesh>
  );
}
