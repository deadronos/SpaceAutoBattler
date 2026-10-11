import { useThree, useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { Vector3 } from 'three';
import type { ShipEntity } from '../../types/index.js';
import { ShipObject } from '../Ship.js';
import { ThrusterInstancedManager } from '../thrusters/ThrusterInstancedManager.js';
import {
  computeLodPartition,
  createLodPartitionBuffer,
  partitionShipsByDistance,
  partitionShipsByDistanceInto,
  partitionsEqual,
  DEFAULT_DISTANCE_THRESHOLD,
  DEFAULT_HYSTERESIS,
  DEFAULT_IMPOSTOR_CAPACITY,
  type LodLevel,
  type LodPartitionBuffer,
  type LodPartitionResult,
} from './shipLodPartition.js';
import {
  ShipImpostorLayer,
  populateImpostorInstances,
  type PopulateImpostorParams,
} from './ShipImpostorLayer.js';

export interface ShipLODManagerProps {
  ships: readonly ShipEntity[];
  distanceThreshold?: number;
  hysteresis?: number;
  impostorCapacity?: number;
}

// Number of reusable partition buffers. Three is the minimum that lets a frame
// always write into a buffer that is neither the currently committed one (which
// mounted children may still be reading) nor the one already scheduled for the
// next commit, even when React defers the commit past the next `useFrame`.
const LOD_BUFFER_COUNT = 3;

function pickWriteIndex(committedIndex: number, pendingIndex: number | null): number {
  for (let i = 0; i < LOD_BUFFER_COUNT; i += 1) {
    if (i !== committedIndex && i !== pendingIndex) {
      return i;
    }
  }
  return (committedIndex + 1) % LOD_BUFFER_COUNT;
}

export function ShipLODManager({
  ships,
  distanceThreshold = DEFAULT_DISTANCE_THRESHOLD,
  hysteresis = DEFAULT_HYSTERESIS,
  impostorCapacity = DEFAULT_IMPOSTOR_CAPACITY,
}: ShipLODManagerProps): ReactElement {
  const { camera } = useThree();
  const lodStateRef = useRef(new Map<number, LodLevel>());
  const shipsRef = useRef<readonly ShipEntity[]>(ships);
  const thresholdsRef = useRef({ distanceThreshold, hysteresis });
  const buffersRef = useRef<LodPartitionBuffer[]>(
    Array.from({ length: LOD_BUFFER_COUNT }, () => createLodPartitionBuffer()),
  );
  // `committedIndexRef` tracks the buffer referenced by the last committed
  // render; `pendingIndexRef` tracks a buffer handed to `setPartition` whose
  // commit may not have landed yet. Neither may be written in place.
  const committedIndexRef = useRef(0);
  const pendingIndexRef = useRef<number | null>(null);

  const [partition, setPartition] = useState<LodPartitionResult>(() =>
    partitionShipsByDistanceInto(
      ships,
      camera.position,
      distanceThreshold,
      hysteresis,
      lodStateRef.current,
      buffersRef.current[0]!,
    ),
  );

  useEffect(() => {
    shipsRef.current = ships;
  }, [ships]);

  useEffect(() => {
    thresholdsRef.current = { distanceThreshold, hysteresis };
  }, [distanceThreshold, hysteresis]);

  useEffect(() => {
    const index = buffersRef.current.indexOf(partition as LodPartitionBuffer);
    if (index >= 0) {
      committedIndexRef.current = index;
      pendingIndexRef.current = null;
    }
  }, [partition]);

  const updatePartition = useCallback((cameraPosition: Vector3) => {
    const buffers = buffersRef.current;
    const committedIndex = committedIndexRef.current;
    const pendingIndex = pendingIndexRef.current;
    const decidedIndex = pendingIndex ?? committedIndex;
    const writeIndex = pickWriteIndex(committedIndex, pendingIndex);
    const next = partitionShipsByDistanceInto(
      shipsRef.current,
      cameraPosition,
      thresholdsRef.current.distanceThreshold,
      thresholdsRef.current.hysteresis,
      lodStateRef.current,
      buffers[writeIndex]!,
    );
    if (!partitionsEqual(buffers[decidedIndex]!, next)) {
      pendingIndexRef.current = writeIndex;
      setPartition(next);
    }
  }, []);

  useEffect(() => {
    updatePartition(camera.position);
  }, [ships, distanceThreshold, hysteresis, updatePartition, camera]);

  useFrame(() => {
    updatePartition(camera.position);
  });

  return (
    <>
      {partition.nearShips.map((ship) => (
        <ShipObject key={ship.id} entity={ship} />
      ))}
      <ThrusterInstancedManager ships={partition.nearShips} />
      <ShipImpostorLayer ships={partition.farShips} capacity={impostorCapacity} />
    </>
  );
}

export {
  DEFAULT_DISTANCE_THRESHOLD,
  DEFAULT_HYSTERESIS,
  DEFAULT_IMPOSTOR_CAPACITY,
  partitionShipsByDistance,
  computeLodPartition,
  partitionsEqual,
  populateImpostorInstances,
};

export type { LodLevel, LodPartitionResult, PopulateImpostorParams };
