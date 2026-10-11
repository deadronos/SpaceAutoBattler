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
  const buffersRef = useRef<[LodPartitionBuffer, LodPartitionBuffer]>([
    createLodPartitionBuffer(),
    createLodPartitionBuffer(),
  ]);
  const activeBufferRef = useRef(0);

  const [partition, setPartition] = useState<LodPartitionResult>(() =>
    partitionShipsByDistanceInto(
      ships,
      camera.position,
      distanceThreshold,
      hysteresis,
      lodStateRef.current,
      buffersRef.current[0],
    ),
  );

  useEffect(() => {
    shipsRef.current = ships;
  }, [ships]);

  useEffect(() => {
    thresholdsRef.current = { distanceThreshold, hysteresis };
  }, [distanceThreshold, hysteresis]);

  const updatePartition = useCallback((cameraPosition: Vector3) => {
    const activeIndex = activeBufferRef.current;
    const nextIndex = activeIndex === 0 ? 1 : 0;
    const next = partitionShipsByDistanceInto(
      shipsRef.current,
      cameraPosition,
      thresholdsRef.current.distanceThreshold,
      thresholdsRef.current.hysteresis,
      lodStateRef.current,
      buffersRef.current[nextIndex]!,
    );
    if (!partitionsEqual(buffersRef.current[activeIndex]!, next)) {
      activeBufferRef.current = nextIndex;
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
