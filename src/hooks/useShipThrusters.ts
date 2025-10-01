import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, Color, MathUtils, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import type { ShipEntity } from '../types/index.js';
import { THRUSTER_GLOW_CONFIG } from '../config/renderer.js';
import { useBloomContext } from '../renderer/BloomProvider.js';
import type { SmoothingConfig } from './useShipInterpolation.js';

export interface ThrusterMaterial {
  material: any;
  baseEmissive?: Color;
  baseIntensity?: number;
}

export function useShipThrusters(
  scene: any | null,
  entity: ShipEntity,
  smoothing: SmoothingConfig,
): React.MutableRefObject<ThrusterMaterial[]> {
  const thrusterMaterialsRef = useRef<ThrusterMaterial[]>([]);
  const fallbackGlowMeshesRef = useRef<Mesh[]>([]);
  const thrusterColorRef = useMemo(() => new Color(), []);
  const bloomCtx = useBloomContext();

  useEffect(() => {
    if (!scene) return;

    const engines: any[] = [];
    const thrusters: ThrusterMaterial[] = [];
    
    const nameMatch = (s: string | undefined) => {
      if (!s) return false;
      const n = s.toLowerCase();
      return n.includes('engine') || n.includes('thruster') || n.includes('exhaust');
    };

    scene.traverse((obj: any) => {
      if (obj && obj.isMesh) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        if (nameMatch(obj.name)) {
          engines.push(obj);
          mats.forEach((m: any) => {
            if (!m) return;

            const baseEmissive = m.emissive && typeof m.emissive.clone === 'function' ? m.emissive.clone() : new Color(0, 0, 0);
            const emissiveLuminance = baseEmissive.r * 0.299 + baseEmissive.g * 0.587 + baseEmissive.b * 0.114;

            const finalEmissive = emissiveLuminance < THRUSTER_GLOW_CONFIG.darkEmissiveThreshold
              ? new Color(THRUSTER_GLOW_CONFIG.defaultEmissiveColor)
              : baseEmissive;

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

    if (engines.length === 0) {
      const box = new Box3().setFromObject(scene);
      const size = box.getSize(new Vector3());
      const anchorCount = THRUSTER_GLOW_CONFIG.anchorsByHull[entity.ship.hull] || 1;

      const tailZ = box.min.z - THRUSTER_GLOW_CONFIG.tailOffset * size.z;
      const glowSize = THRUSTER_GLOW_CONFIG.glowMeshSize * Math.max(size.x, size.y);

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
  }, [scene, bloomCtx, entity.ship.hull, entity.id]);

  useFrame(() => {
    const thrusters = thrusterMaterialsRef.current;
    if (thrusters.length > 0) {
      const throttle = MathUtils.clamp(entity.ai?.command?.thrust ?? 0, 0, 1);
      updateThrusterIntensity(
        thrusters,
        throttle,
        smoothing.thrusterIntensity.base,
        smoothing.thrusterIntensity.range,
        thrusterColorRef,
      );
    }
  });

  return thrusterMaterialsRef;
}

export function updateThrusterIntensity(
  thrusters: ThrusterMaterial[],
  throttle: number,
  baseIntensity: number,
  range: number,
  thrusterColorRef: Color,
): void {
  for (const entry of thrusters) {
    const mat = entry.material;
    if (!mat) continue;
    
    const baseInt = entry.baseIntensity ?? baseIntensity;
    if (typeof mat.emissiveIntensity === 'number') {
      mat.emissiveIntensity = baseInt + range * throttle;
    }
    
    if (entry.baseEmissive && mat.emissive && typeof mat.emissive.copy === 'function') {
      thrusterColorRef.copy(entry.baseEmissive).multiplyScalar(1 + throttle * 0.6);
      mat.emissive.copy(thrusterColorRef);
    }
  }
}