import { useThree, useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { Vector3 } from 'three';
import type { ShipEntity } from '../../types/index.js';
import { ShipObject } from '../Ship.js';
import { ThrusterInstancedManager } from '../thrusters/ThrusterInstancedManager.js';
import {
  computeLodPartition,
  partitionShipsByDistance,
  partitionsEqual,
  DEFAULT_DISTANCE_THRESHOLD,
  DEFAULT_HYSTERESIS,
  DEFAULT_IMPOSTOR_CAPACITY,
  type LodLevel,
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

  const [partition, setPartition] = useState<LodPartitionResult>(() =>
    computeLodPartition(
      ships,
      camera.position.clone(),
      distanceThreshold,
      hysteresis,
      lodStateRef.current,
    ),
  );
  const partitionRef = useRef(partition);

  useEffect(() => {
    shipsRef.current = ships;
  }, [ships]);

  useEffect(() => {
    thresholdsRef.current = { distanceThreshold, hysteresis };
  }, [distanceThreshold, hysteresis]);

  useEffect(() => {
    partitionRef.current = partition;
  }, [partition]);

  const updatePartition = useCallback((cameraPosition: Vector3) => {
    const next = computeLodPartition(
      shipsRef.current,
      cameraPosition,
      thresholdsRef.current.distanceThreshold,
      thresholdsRef.current.hysteresis,
      lodStateRef.current,
    );
    if (!partitionsEqual(partitionRef.current, next)) {
      partitionRef.current = next;
      setPartition(next);
    }
  }, []);

  useEffect(() => {
    updatePartition(camera.position.clone());
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
