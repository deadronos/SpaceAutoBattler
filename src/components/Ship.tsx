import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { Box3, Color, MathUtils, Quaternion, Sphere, Vector3, SphereGeometry, MeshStandardMaterial, Mesh, type Group } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useGLTF } from '@react-three/drei';
import type { ShipEntity, ShipHull } from '../types/index.js';
import {
  getShieldVisuals,
  HULL_TINT,
  TEAM_COLORS,
  SHIELD_RIPPLE_TUNING,
  resolveRendererMotionConfig,
  THRUSTER_GLOW_CONFIG,
} from '../config/renderer.js';
import { useFrame as useRenderFrame } from '@react-three/fiber';
import { SHIP_MODEL_PATHS } from '../assets/ships.js';
import { getMaterial } from '../renderer/materialRegistry.js';
import { useOptionalGameState } from '../game/context.js';
import { useBloomContext } from '../renderer/BloomProvider.js';
import { useBloomRegistration } from '../renderer/BloomProvider.js';

export function resolveModelPath(modelKey?: string): string {
  const key = (modelKey ?? 'fighter') as keyof typeof SHIP_MODEL_PATHS;
  return SHIP_MODEL_PATHS[key] ?? SHIP_MODEL_PATHS.fighter;
}

export function ShipObject({ entity }: { entity: ShipEntity }): React.ReactElement {
  const group = useRef<Group>(null);
  const state = useOptionalGameState();

  const smoothing = useMemo(() => {
    const cfg = resolveRendererMotionConfig(entity.ship.motion);
    return {
      ...cfg,
      positionLerp: MathUtils.clamp(cfg.positionLerp, 0, 1),
      rotationSlerp: MathUtils.clamp(cfg.rotationSlerp, 0, 1),
      bankLerp: MathUtils.clamp(cfg.bankLerp, 0, 1),
      teleportThresholdSq: Math.max(1, cfg.teleportDistance * cfg.teleportDistance),
    };
  }, [entity.ship.motion]);

  const prevSimPosition = useMemo(() => new Vector3(), []);
  const prevSimRotation = useMemo(() => new Quaternion(), []);
  const currSimPosition = useMemo(() => new Vector3(), []);
  const currSimRotation = useMemo(() => new Quaternion(), []);
  const visualPosition = useMemo(() => new Vector3(), []);
  const visualRotation = useMemo(() => new Quaternion(), []);
  const interpPosition = useMemo(() => new Vector3(), []);
  const interpRotation = useMemo(() => new Quaternion(), []);
  const bankQuaternion = useMemo(() => new Quaternion(), []);
  const forwardAxis = useMemo(() => new Vector3(0, 0, 1), []);
  const finalRotation = useMemo(() => new Quaternion(), []);
  const thrusterColorRef = useMemo(() => new Color(), []);
  const bankValueRef = useRef(0);
  const lastTickIndexRef = useRef(-1);

  const thrusterMaterialsRef = useRef<
    Array<{ material: any; baseEmissive?: Color; baseIntensity?: number }>
  >([]);

  const fallbackGlowMeshesRef = useRef<Mesh[]>([]);

  // Resolve path via helper to ensure it's always defined.
  const modelPath = resolveModelPath(entity.model);
  const hasValidPath = typeof modelPath === 'string' && modelPath.length > 0;

  // Use drei's useGLTF which provides caching and convenience helpers.
  const gltf = hasValidPath ? (useGLTF(modelPath) as GLTF) : null;
  const scene = useMemo(() => (gltf ? gltf.scene.clone(true) : null), [gltf?.scene]);

  useLayoutEffect(() => {
    prevSimPosition.copy(entity.transform.position);
    currSimPosition.copy(entity.transform.position);
    visualPosition.copy(entity.transform.position);
    prevSimRotation.copy(entity.transform.rotation);
    currSimRotation.copy(entity.transform.rotation);
    visualRotation.copy(entity.transform.rotation);
    bankValueRef.current = 0;
    lastTickIndexRef.current = state?.simulation.lastTickIndex ?? 0;
  }, [entity.id, state?.simulation.lastTickIndex]);

  // Register engine-like meshes for selective bloom when available
  const bloomCtx = useBloomContext();
  useEffect(() => {
    if (!scene) return;
    const engines: any[] = [];
    const thrusters: Array<{ material: any; baseEmissive?: Color; baseIntensity?: number }> = [];
    const nameMatch = (s: string | undefined) => {
      if (!s) return false;
      const n = s.toLowerCase();
      return n.includes('engine') || n.includes('thruster') || n.includes('exhaust');
    };
    
    // First pass: detect engine meshes by name
    scene.traverse((obj: any) => {
      if (obj && obj.isMesh) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        if (nameMatch(obj.name)) {
          engines.push(obj);
          mats.forEach((m: any) => {
            if (!m) return;
            
            // Check if emissive is black or very dark
            const baseEmissive = m.emissive && typeof m.emissive.clone === 'function' ? m.emissive.clone() : new Color(0, 0, 0);
            const emissiveLuminance = baseEmissive.r * 0.299 + baseEmissive.g * 0.587 + baseEmissive.b * 0.114;
            
            // Use default emissive color if current one is too dark
            const finalEmissive = emissiveLuminance < THRUSTER_GLOW_CONFIG.darkEmissiveThreshold 
              ? new Color(THRUSTER_GLOW_CONFIG.defaultEmissiveColor) 
              : baseEmissive;
            
            // Set the material's emissive to our enhanced color
            if (m.emissive && typeof m.emissive.copy === 'function') {
              m.emissive.copy(finalEmissive);
            }
            
            thrusters.push({
              material: m,
              baseEmissive: finalEmissive,
              baseIntensity: typeof m.emissiveIntensity === 'number' ? m.emissiveIntensity : undefined,
            });
          });
        }
      }
    });

    // Fallback: create anchor-based glow meshes if no engines found
    if (engines.length === 0) {
      const box = new Box3().setFromObject(scene);
      const size = box.getSize(new Vector3());
      const anchorCount = THRUSTER_GLOW_CONFIG.anchorsByHull[entity.ship.hull] || 1;
      
      // Compute anchor positions at the tail
      const tailZ = box.min.z - THRUSTER_GLOW_CONFIG.tailOffset * size.z;
      const glowSize = THRUSTER_GLOW_CONFIG.glowMeshSize * Math.max(size.x, size.y);

      // Debug logging for engine glow attachment analysis
      const hasExtremeValues = !Number.isFinite(box.min.z) || !Number.isFinite(size.z) || 
        !Number.isFinite(tailZ) || Math.abs(tailZ) > 10000 || Math.abs(box.min.z) > 10000;
      
      if (hasExtremeValues) {
        console.warn(`[Ship] Engine glow extreme values detected:`, {
          shipId: entity.id,
          hull: entity.ship.hull,
          boxMin: { x: box.min.x, y: box.min.y, z: box.min.z },
          boxMax: { x: box.max.x, y: box.max.y, z: box.max.z },
          size: { x: size.x, y: size.y, z: size.z },
          tailOffset: THRUSTER_GLOW_CONFIG.tailOffset,
          computedTailZ: tailZ,
          glowSize: glowSize,
          anchorCount: anchorCount
        });
      }
      
      for (let i = 0; i < anchorCount; i++) {
        // Position anchors symmetrically
        let x = 0, y = 0;
        if (anchorCount === 2) {
          x = (i === 0 ? -1 : 1) * 0.3 * size.x;
        } else if (anchorCount === 4) {
          x = (i % 2 === 0 ? -1 : 1) * 0.25 * size.x;
          y = (i < 2 ? -1 : 1) * 0.15 * size.y;
        } else if (anchorCount === 6) {
          x = (i % 2 === 0 ? -1 : 1) * 0.35 * size.x;
          y = (Math.floor(i / 2) - 1) * 0.2 * size.y;
        }
        
        // Create small glow mesh
        const geometry = new SphereGeometry(glowSize, 8, 6);
        const material = new MeshStandardMaterial({
          color: THRUSTER_GLOW_CONFIG.defaultEmissiveColor,
          emissive: new Color(THRUSTER_GLOW_CONFIG.defaultEmissiveColor),
          emissiveIntensity: 1.0,
          transparent: true,
          opacity: 0.8,
        });
        
        const glowMesh = new Mesh(geometry, material);
        glowMesh.position.set(x, y, tailZ);
        scene.add(glowMesh);

        // Debug logging for individual glow mesh positions
        const hasExtremeMeshPosition = Math.abs(x) > 1000 || Math.abs(y) > 1000 || Math.abs(tailZ) > 1000;
        if (hasExtremeMeshPosition) {
          console.warn(`[Ship] Engine glow mesh extreme position:`, {
            shipId: entity.id,
            hull: entity.ship.hull,
            glowIndex: i,
            position: { x, y, z: tailZ },
            anchorCount: anchorCount
          });
        }
        
        engines.push(glowMesh);
        fallbackGlowMeshesRef.current.push(glowMesh);
        thrusters.push({
          material: material,
          baseEmissive: new Color(THRUSTER_GLOW_CONFIG.defaultEmissiveColor),
          baseIntensity: 1.0,
        });
      }
    }

    thrusterMaterialsRef.current = thrusters;
    if (bloomCtx) engines.forEach((o) => bloomCtx.register(o, { group: 'engines' }));

    return () => {
      if (bloomCtx) engines.forEach((o) => bloomCtx.unregister(o));
      
      // Clean up fallback glow meshes
      fallbackGlowMeshesRef.current.forEach((mesh) => {
        if (mesh.parent) mesh.parent.remove(mesh);
        mesh.geometry.dispose();
        const material = mesh.material;
        if (material && !Array.isArray(material) && typeof material.dispose === 'function') {
          material.dispose();
        }
      });
      fallbackGlowMeshesRef.current = [];
      thrusterMaterialsRef.current = [];
    };
  }, [scene, bloomCtx, entity.ship.hull]);

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

    const sim = state?.simulation;
    const tickIndex = sim?.lastTickIndex ?? lastTickIndexRef.current;

    if (tickIndex !== lastTickIndexRef.current) {
      prevSimPosition.copy(currSimPosition);
      prevSimRotation.copy(currSimRotation);
      currSimPosition.copy(entity.transform.position);
      currSimRotation.copy(entity.transform.rotation);
      lastTickIndexRef.current = tickIndex;

      const distSq = prevSimPosition.distanceToSquared(currSimPosition);
      if (distSq > smoothing.teleportThresholdSq) {
        prevSimPosition.copy(currSimPosition);
        prevSimRotation.copy(currSimRotation);
        visualPosition.copy(currSimPosition);
        visualRotation.copy(currSimRotation);
      }
    } else {
      currSimPosition.copy(entity.transform.position);
      currSimRotation.copy(entity.transform.rotation);
    }

    const alpha = sim ? MathUtils.clamp(sim.alpha, 0, 1) : 1;
    interpPosition.copy(prevSimPosition).lerp(currSimPosition, alpha);
    if (smoothing.positionLerp <= 0) {
      visualPosition.copy(interpPosition);
    } else {
      visualPosition.lerp(interpPosition, smoothing.positionLerp);
    }

    interpRotation.copy(prevSimRotation).slerp(currSimRotation, alpha);
    if (smoothing.rotationSlerp <= 0) {
      visualRotation.copy(interpRotation);
    } else {
      visualRotation.slerp(interpRotation, smoothing.rotationSlerp);
    }

    const motion = entity.ship.motion;
    const bankFactor = motion.visualBankFactor ?? smoothing.bankFactor;
    const maxBankDeg = motion.maxBankDeg ?? smoothing.maxBankDeg;
    const yawRate = entity.ship.angularVelocity.y;
    let bankDeg = yawRate * bankFactor;

    if (motion.maxLateralAcceleration && motion.maxLateralAcceleration > 0) {
      const lateralRatio = MathUtils.clamp(
        entity.ship.lateralAcceleration / motion.maxLateralAcceleration,
        -1,
        1,
      );
      bankDeg += lateralRatio * maxBankDeg * 0.5;
    }

    const targetBankRad = MathUtils.degToRad(MathUtils.clamp(bankDeg, -maxBankDeg, maxBankDeg));
    bankValueRef.current =
      smoothing.bankLerp <= 0
        ? targetBankRad
        : MathUtils.lerp(bankValueRef.current, targetBankRad, smoothing.bankLerp);

    finalRotation.copy(visualRotation);
    const bankRoll = bankValueRef.current;
    if (Math.abs(bankRoll) > 1e-4) {
      bankQuaternion.setFromAxisAngle(forwardAxis, -bankRoll);
      finalRotation.multiply(bankQuaternion);
    }

    ref.position.copy(visualPosition);
    ref.quaternion.copy(finalRotation);
    ref.scale.setScalar(entity.transform.scale);

    const thrusters = thrusterMaterialsRef.current;
    if (thrusters.length > 0) {
      const throttle = MathUtils.clamp(entity.ai?.command?.thrust ?? 0, 0, 1);
      const base = smoothing.thrusterIntensity.base;
      const range = smoothing.thrusterIntensity.range;
      for (const entry of thrusters) {
        const mat = entry.material;
        if (!mat) continue;
        const baseIntensity = entry.baseIntensity ?? base;
        if (typeof mat.emissiveIntensity === 'number') {
          mat.emissiveIntensity = baseIntensity + range * throttle;
        }
        if (entry.baseEmissive && mat.emissive && typeof mat.emissive.copy === 'function') {
          thrusterColorRef.copy(entry.baseEmissive).multiplyScalar(1 + throttle * 0.6);
          mat.emissive.copy(thrusterColorRef);
        }
      }
    }
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
  useBloomRegistration(meshRef, { group: 'shields' });
  const state = useOptionalGameState();
  const [rippleTick, setRippleTick] = useState(0);
  const lastCountRef = useRef<number>(0);
  const lastT0Ref = useRef<number>(-Infinity);

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
    // Non-uniform shield scale (ellipsoid): multiply base radius by per-axis scale
    const vs = getShieldVisuals(entity.ship.hull);
    const sx = Math.max(0.05, vs.shieldScale.x) * r;
    const sy = Math.max(0.05, vs.shieldScale.y) * r;
    const sz = Math.max(0.05, vs.shieldScale.z) * r;
    mesh.scale.set(sx, sy, sz);
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
  // Detect ripple list changes and trigger a render when it happens so uniforms update
  useRenderFrame(() => {
    const list = entity.shieldRipples ?? [];
    const count = list.length;
    const latestT0 = count > 0 ? (list[count - 1].t0 ?? -Infinity) : -Infinity;
    if (count !== lastCountRef.current || latestT0 !== lastT0Ref.current) {
      lastCountRef.current = count;
      lastT0Ref.current = latestT0;
      setRippleTick((n) => (n + 1) & 0xffff);
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
  const rippleQueue = sliced.map((s) => ({ dir: s.dir, t0: s.t0, amp: s.scaledAmp })) as any;
  // debug logging removed

  const kind = getShieldVisuals(entity.ship.hull).materialKind;
  const key = `shield:${kind}`;
  const Mat = (getMaterial<{
    hull: ShipHull; team: any; opacity: number; ripple?: any; simTime?: number;
  }>(key)) ?? getMaterial('shield:hex')!;

  return (
    <mesh ref={meshRef} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[1, 64, 64]} />
      <Mat hull={entity.ship.hull} team={entity.ship.team} opacity={opacity} ripple={rippleQueue} simTime={state?.time ?? 0} />
    </mesh>
  );
}

