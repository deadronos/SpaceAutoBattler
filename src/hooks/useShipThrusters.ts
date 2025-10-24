import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import {
  Box3,
  Color,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three';
import type { ShipEntity } from '../types/index.js';
import { THRUSTER_GLOW_CONFIG } from '../config/renderer.js';
import { useBloomContext } from '../renderer/BloomProvider.js';
import type { SmoothingConfig } from './useShipInterpolation.js';

export interface ThrusterMaterialEntry {
  material: MeshStandardMaterial | null;
  baseEmissive: Color;
  baseIntensity?: number;
}

export function useShipThrusters(
  scene: Object3D | null,
  entity: ShipEntity,
  smoothing: SmoothingConfig,
): MutableRefObject<ThrusterMaterialEntry[]> {
  const thrusterMaterialsRef = useRef<ThrusterMaterialEntry[]>([]);
  const fallbackGlowMeshesRef = useRef<Mesh[]>([]);
  const thrusterColorRef = useMemo(() => new Color(), []);
  const bloomCtx = useBloomContext();

  useEffect(() => {
    if (!scene) return;

    const engines: Mesh[] = [];
    const thrusters: ThrusterMaterialEntry[] = [];

    const nameMatch = (value: string | undefined): boolean => {
      if (!value) return false;
      const n = value.toLowerCase();
      return n.includes('engine') || n.includes('thruster') || n.includes('exhaust');
    };

    scene.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }

      if (!nameMatch(object.name)) {
        return;
      }

      engines.push(object);

      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!(material instanceof MeshStandardMaterial)) {
          return;
        }

        const baseEmissive = material.emissive.clone();
        const emissiveLuminance =
          baseEmissive.r * 0.299 + baseEmissive.g * 0.587 + baseEmissive.b * 0.114;
        const finalEmissive =
          emissiveLuminance < THRUSTER_GLOW_CONFIG.darkEmissiveThreshold
            ? new Color(THRUSTER_GLOW_CONFIG.defaultEmissiveColor)
            : baseEmissive;

        material.emissive.copy(finalEmissive);
        const baseIntensity = Number.isFinite(material.emissiveIntensity)
          ? material.emissiveIntensity
          : 1;

        thrusters.push({
          material,
          baseEmissive: finalEmissive.clone(),
          baseIntensity,
        });
      });
    });

    if (engines.length === 0) {
      const bounds = new Box3().setFromObject(scene);
      const size = bounds.getSize(new Vector3());
      const anchorCount = THRUSTER_GLOW_CONFIG.anchorsByHull[entity.ship.hull] ?? 1;

      const tailZ = bounds.min.z - THRUSTER_GLOW_CONFIG.tailOffset * size.z;
      const glowSize = THRUSTER_GLOW_CONFIG.glowMeshSize * Math.max(size.x, size.y);

      const hasExtremeValues =
        !Number.isFinite(bounds.min.z) ||
        !Number.isFinite(size.z) ||
        !Number.isFinite(tailZ) ||
        Math.abs(tailZ) > 10000 ||
        Math.abs(bounds.min.z) > 10000;

      if (hasExtremeValues) {
        console.warn(`[Ship] Engine glow extreme values detected:`, {
          shipId: entity.id,
          hull: entity.ship.hull,
          boxMin: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
          boxMax: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
          size: { x: size.x, y: size.y, z: size.z },
          tailOffset: THRUSTER_GLOW_CONFIG.tailOffset,
          computedTailZ: tailZ,
          glowSize,
          anchorCount,
        });
      }

      for (let i = 0; i < anchorCount; i += 1) {
        let x = 0;
        let y = 0;
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
          emissiveIntensity: 1,
          transparent: true,
          opacity: 0.8,
        });

        const glowMesh = new Mesh(geometry, material);
        glowMesh.position.set(x, y, tailZ);
        scene.add(glowMesh);

        const hasExtremeMeshPosition =
          Math.abs(x) > 1000 || Math.abs(y) > 1000 || Math.abs(tailZ) > 1000;
        if (hasExtremeMeshPosition) {
          console.warn(`[Ship] Engine glow mesh extreme position:`, {
            shipId: entity.id,
            hull: entity.ship.hull,
            glowIndex: i,
            position: { x, y, z: tailZ },
            anchorCount,
          });
        }

        engines.push(glowMesh);
        fallbackGlowMeshesRef.current.push(glowMesh);
        thrusters.push({
          material,
          baseEmissive: material.emissive.clone(),
          baseIntensity: material.emissiveIntensity,
        });
      }
    }

    thrusterMaterialsRef.current = thrusters;
    if (bloomCtx) {
      engines.forEach((engine) => bloomCtx.register(engine, { group: 'engines' }));
    }

    return () => {
      if (bloomCtx) {
        engines.forEach((engine) => bloomCtx.unregister(engine));
      }

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
  thrusters: readonly ThrusterMaterialEntry[],
  throttle: number,
  baseIntensity: number,
  range: number,
  thrusterColorRef: Color,
): void {
  for (const entry of thrusters) {
    const material = entry.material;
    if (!material) {
      continue;
    }

    const baseInt = entry.baseIntensity ?? baseIntensity;
    material.emissiveIntensity = baseInt + range * throttle;

    if (material.emissive && typeof material.emissive.copy === 'function') {
      thrusterColorRef.copy(entry.baseEmissive).multiplyScalar(1 + throttle * 0.6);
      material.emissive.copy(thrusterColorRef);
    }
  }
}
