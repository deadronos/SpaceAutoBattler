import { useMemo } from 'react';
import { Box3, Vector3 } from 'three';
import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SHIP_MODEL_PATHS } from '../../assets/ships.js';
import { extendShipGltfLoader } from '../loaders/gltfDecoders.js';
import type { ShipEntity, ShipHull } from '../../types/index.js';
import { THRUSTER_GLOW_CONFIG } from '../../config/effects.js';
import { sceneHasEngineMeshes } from '../../hooks/useShipThrusters.js';

export type ThrusterAnchorLocals = Map<ShipHull, readonly Vector3[]>;
export type GltfEngineHullMap = ReadonlyMap<ShipHull, boolean>;

function extractAnchorsFromGltf(gltf: GLTF | null, hull: ShipHull): Vector3[] {
  if (!gltf?.scene) return [];
  gltf.scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(gltf.scene);
  const size = box.getSize(new Vector3());
  const count = THRUSTER_GLOW_CONFIG.anchorsByHull[hull] || 1;
  const tailZ = box.min.z - THRUSTER_GLOW_CONFIG.tailOffset * size.z;
  const anchors: Vector3[] = [];
  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    if (count === 2) {
      x = (i === 0 ? -1 : 1) * 0.3 * size.x;
    } else if (count === 4) {
      x = (i % 2 === 0 ? -1 : 1) * 0.25 * size.x;
      y = (i < 2 ? -1 : 1) * 0.15 * size.y;
    } else if (count === 6) {
      x = (i % 2 === 0 ? -1 : 1) * 0.35 * size.x;
      y = (Math.floor(i / 2) - 1) * 0.2 * size.y;
    }
    anchors.push(new Vector3(x, y, tailZ));
  }
  return anchors;
}

function useHullGltfs(): Record<ShipHull, GLTF> {
  const fighter = useGLTF(SHIP_MODEL_PATHS.fighter, true, true, extendShipGltfLoader) as GLTF;
  const corvette = useGLTF(SHIP_MODEL_PATHS.corvette, true, true, extendShipGltfLoader) as GLTF;
  const frigate = useGLTF(SHIP_MODEL_PATHS.frigate, true, true, extendShipGltfLoader) as GLTF;
  const destroyer = useGLTF(SHIP_MODEL_PATHS.destroyer, true, true, extendShipGltfLoader) as GLTF;
  const carrier = useGLTF(SHIP_MODEL_PATHS.carrier, true, true, extendShipGltfLoader) as GLTF;

  return useMemo(
    () => ({ fighter, corvette, frigate, destroyer, carrier }),
    [fighter, corvette, frigate, destroyer, carrier],
  );
}

export function useThrusterAnchors(): ThrusterAnchorLocals {
  const gltfs = useHullGltfs();

  return useMemo(
    () =>
      new Map<ShipHull, Vector3[]>([
        ['fighter', extractAnchorsFromGltf(gltfs.fighter, 'fighter')],
        ['corvette', extractAnchorsFromGltf(gltfs.corvette, 'corvette')],
        ['frigate', extractAnchorsFromGltf(gltfs.frigate, 'frigate')],
        ['destroyer', extractAnchorsFromGltf(gltfs.destroyer, 'destroyer')],
        ['carrier', extractAnchorsFromGltf(gltfs.carrier, 'carrier')],
      ]),
    [gltfs],
  );
}

/**
 * Maps each ship hull to whether its loaded GLTF model already contains
 * dedicated engine/thruster/exhaust meshes.
 */
export function useGltfEngineMeshHulls(): GltfEngineHullMap {
  const gltfs = useHullGltfs();

  return useMemo(
    () =>
      new Map<ShipHull, boolean>([
        ['fighter', sceneHasEngineMeshes(gltfs.fighter?.scene)],
        ['corvette', sceneHasEngineMeshes(gltfs.corvette?.scene)],
        ['frigate', sceneHasEngineMeshes(gltfs.frigate?.scene)],
        ['destroyer', sceneHasEngineMeshes(gltfs.destroyer?.scene)],
        ['carrier', sceneHasEngineMeshes(gltfs.carrier?.scene)],
      ]),
    [gltfs],
  );
}

const FALLBACK_SHIP_SIZE = { x: 2, y: 1, z: 3 } as const;

export function computeThrusterAnchorsWorld(
  ship: ShipEntity,
  locals: readonly Vector3[] | undefined,
  target: Vector3[],
  desiredCount: number,
  tailZFactor: number,
): Vector3[] {
  if (locals && locals.length > 0) {
    const count = Math.min(desiredCount, locals.length);
    for (let i = 0; i < count; i++) {
      const local = locals[i];
      if (!local) continue;
      const targetAnchor = target[i];
      if (!targetAnchor) continue;
      targetAnchor
        .copy(local)
        .multiplyScalar(ship.transform.scale)
        .applyQuaternion(ship.transform.rotation)
        .add(ship.transform.position);
    }
    return target;
  }

  const tailZ = -FALLBACK_SHIP_SIZE.z * tailZFactor;
  for (let i = 0; i < desiredCount; i++) {
    let x = 0;
    let y = 0;
    if (desiredCount === 2) {
      x = (i === 0 ? -1 : 1) * 0.3 * FALLBACK_SHIP_SIZE.x;
    } else if (desiredCount === 4) {
      x = (i % 2 === 0 ? -1 : 1) * 0.25 * FALLBACK_SHIP_SIZE.x;
      y = (i < 2 ? -1 : 1) * 0.15 * FALLBACK_SHIP_SIZE.y;
    } else if (desiredCount === 6) {
      x = (i % 2 === 0 ? -1 : 1) * 0.35 * FALLBACK_SHIP_SIZE.x;
      y = (Math.floor(i / 2) - 1) * 0.2 * FALLBACK_SHIP_SIZE.y;
    }

    const targetAnchor = target[i];
    if (!targetAnchor) continue;

    targetAnchor
      .set(x, y, tailZ)
      .multiplyScalar(ship.transform.scale)
      .applyQuaternion(ship.transform.rotation)
      .add(ship.transform.position);
  }
  return target;
}
