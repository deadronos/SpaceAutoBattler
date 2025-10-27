import { useMemo } from 'react';
import { Box3, Vector3 } from 'three';
import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SHIP_MODEL_PATHS } from '../../assets/ships.js';
import type { ShipEntity, ShipHull } from '../../types/index.js';
import { THRUSTER_GLOW_CONFIG } from '../../config/effects.js';

export type ThrusterAnchorLocals = Map<ShipHull, readonly Vector3[]>;

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

export function useThrusterAnchors(): ThrusterAnchorLocals {
  const gltfFighter = useGLTF(SHIP_MODEL_PATHS.fighter) as GLTF;
  const gltfCorvette = useGLTF(SHIP_MODEL_PATHS.corvette) as GLTF;
  const gltfFrigate = useGLTF(SHIP_MODEL_PATHS.frigate) as GLTF;
  const gltfDestroyer = useGLTF(SHIP_MODEL_PATHS.destroyer) as GLTF;
  const gltfCarrier = useGLTF(SHIP_MODEL_PATHS.carrier) as GLTF;

  return useMemo(
    () =>
      new Map<ShipHull, Vector3[]>([
        ['fighter', extractAnchorsFromGltf(gltfFighter, 'fighter')],
        ['corvette', extractAnchorsFromGltf(gltfCorvette, 'corvette')],
        ['frigate', extractAnchorsFromGltf(gltfFrigate, 'frigate')],
        ['destroyer', extractAnchorsFromGltf(gltfDestroyer, 'destroyer')],
        ['carrier', extractAnchorsFromGltf(gltfCarrier, 'carrier')],
      ]),
    [gltfFighter, gltfCorvette, gltfFrigate, gltfDestroyer, gltfCarrier],
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
      target[i]
        .copy(locals[i])
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

    target[i]
      .set(x, y, tailZ)
      .multiplyScalar(ship.transform.scale)
      .applyQuaternion(ship.transform.rotation)
      .add(ship.transform.position);
  }
  return target;
}
