import { useThree, useFrame } from '@react-three/fiber';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';
import type { ShipEntity } from '../../types/index.js';
import { ShipObject } from '../Ship.js';
import { ThrusterInstancedManager } from '../thrusters/ThrusterInstancedManager.js';
import { getInstanceFriendlyMaterial } from '../../renderer/materialRegistry.js';
import { TEAM_COLORS } from '../../config/renderer.js';
import { createSaturationWarningState, warnOnSaturation } from '../layers/saturationWarning.js';

export interface ShipLODManagerProps {
  ships: readonly ShipEntity[];
  distanceThreshold?: number;
  hysteresis?: number;
  impostorCapacity?: number;
}

export type LodLevel = 'near' | 'far';

export const DEFAULT_DISTANCE_THRESHOLD = 8000;
export const DEFAULT_HYSTERESIS = 80;
export const DEFAULT_IMPOSTOR_CAPACITY = 256;

export interface LodPartitionResult {
  nearShips: ShipEntity[];
  farShips: ShipEntity[];
}

function classifyLod(
  distance: number,
  previous: LodLevel | undefined,
  threshold: number,
  hysteresis: number,
): LodLevel {
  if (previous === 'far') {
    return distance < threshold - hysteresis ? 'near' : 'far';
  }
  if (previous === 'near') {
    return distance > threshold + hysteresis ? 'far' : 'near';
  }
  return distance > threshold ? 'far' : 'near';
}

export function partitionShipsByDistance(
  ships: readonly ShipEntity[],
  cameraPosition: Vector3,
  threshold: number,
  hysteresis: number,
  previous: Map<number, LodLevel>,
): LodPartitionResult {
  const nearShips: ShipEntity[] = [];
  const farShips: ShipEntity[] = [];

  const activeIds = new Set<number>();

  for (const ship of ships) {
    activeIds.add(ship.id);
    const previousLevel = previous.get(ship.id);
    const distance = ship.transform.position.distanceTo(cameraPosition);
    const level = classifyLod(distance, previousLevel, threshold, hysteresis);
    previous.set(ship.id, level);
    if (level === 'near') {
      nearShips.push(ship);
    } else {
      farShips.push(ship);
    }
  }

  for (const id of previous.keys()) {
    if (!activeIds.has(id)) {
      previous.delete(id);
    }
  }

  return { nearShips, farShips };
}

export function computeLodPartition(
  ships: readonly ShipEntity[],
  cameraPosition: Vector3,
  threshold: number,
  hysteresis: number,
  previous: Map<number, LodLevel>,
): LodPartitionResult {
  return partitionShipsByDistance(ships, cameraPosition, threshold, hysteresis, previous);
}

export function partitionsEqual(a: LodPartitionResult, b: LodPartitionResult): boolean {
  if (a.nearShips.length !== b.nearShips.length || a.farShips.length !== b.farShips.length) {
    return false;
  }
  for (let i = 0; i < a.nearShips.length; i += 1) {
    if (a.nearShips[i] !== b.nearShips[i]) {
      return false;
    }
  }
  for (let i = 0; i < a.farShips.length; i += 1) {
    if (a.farShips[i] !== b.farShips[i]) {
      return false;
    }
  }
  return true;
}

export interface PopulateImpostorParams {
  ships: readonly ShipEntity[];
  capacity: number;
  cameraQuaternion: Quaternion;
  mesh: InstancedMesh | null;
  temp: {
    matrix: Matrix4;
    scale: Vector3;
    quat: Quaternion;
    pos: Vector3;
    color: Color;
  };
}

export function populateImpostorInstances({
  ships,
  capacity,
  cameraQuaternion,
  mesh,
  temp,
}: PopulateImpostorParams): { count: number; saturated: boolean } {
  if (!mesh) {
    return { count: 0, saturated: false };
  }

  let index = 0;
  let saturated = false;

  for (const ship of ships) {
    if (index >= capacity) {
      saturated = true;
      break;
    }

    temp.pos.copy(ship.transform.position);
    const scale = Math.max(ship.transform.scale * 6, 4);
    temp.scale.setScalar(scale);
    temp.quat.copy(cameraQuaternion);
    temp.matrix.compose(temp.pos, temp.quat, temp.scale);
    mesh.setMatrixAt(index, temp.matrix);

    const teamColor = TEAM_COLORS[ship.ship.team] ?? '#a0a0a0';
    temp.color.set(teamColor);
    mesh.setColorAt(index, temp.color);

    index += 1;
  }

  mesh.count = index;
  mesh.visible = index > 0;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  return { count: index, saturated };
}
interface ShipImpostorLayerProps {
  ships: readonly ShipEntity[];
  capacity: number;
}

function ShipImpostorLayer({ ships, capacity }: ShipImpostorLayerProps): React.ReactElement {
  const meshRef = useRef<InstancedMesh>(null);
  const warningStateRef = useRef(createSaturationWarningState());
  const frameRef = useRef(0);
  const geometry = useMemo(() => new PlaneGeometry(1, 1, 1, 1), []);
  const materialInfo = useMemo(
    () =>
      getInstanceFriendlyMaterial('ship:impostor', {
        requireInstanceColor: true,
        fallbackKey: 'thruster:glow',
      }),
    [],
  );
  const temp = useMemo(() => ({
    matrix: new Matrix4(),
    scale: new Vector3(),
    quat: new Quaternion(),
    pos: new Vector3(),
    color: new Color('#6fc3ff'),
  }), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!mesh.instanceColor) {
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
      // Initialize all instance colors to a neutral base color so that
      // shaders never receive undefined / NaN values for unused indices.
      const base = new Color('#a0a0a0');
      for (let i = 0; i < capacity; i += 1) {
        mesh.setColorAt(i, base);
      }
      mesh.instanceColor.needsUpdate = true;
    }
    return () => {
      mesh.instanceColor = null;
    };
  }, [capacity]);

  useEffect(() => () => {
    geometry.dispose();
  }, [geometry]);

  useEffect(() => () => {
    materialInfo.material.dispose();
  }, [materialInfo.material]);

  useFrame(({ camera }) => {
    frameRef.current += 1;
    const frameId = frameRef.current;

    const result = populateImpostorInstances({
      ships,
      capacity,
      cameraQuaternion: camera.quaternion,
      mesh: meshRef.current,
      temp,
    });

    warnOnSaturation({
      saturated: result.saturated,
      frameId,
      state: warningStateRef.current,
      message: '[ShipImpostorLayer] Capacity saturated, clamping distant ship impostors.',
    });
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, materialInfo.material, capacity]}
      matrixAutoUpdate={false}
      frustumCulled={false}
      visible={false}
    />
  );
}

export function ShipLODManager({
  ships,
  distanceThreshold = DEFAULT_DISTANCE_THRESHOLD,
  hysteresis = DEFAULT_HYSTERESIS,
  impostorCapacity = DEFAULT_IMPOSTOR_CAPACITY,
}: ShipLODManagerProps): React.ReactElement {
  const { camera } = useThree();
  const lodStateRef = useRef(new Map<number, LodLevel>());
  const shipsRef = useRef<readonly ShipEntity[]>(ships);
  const thresholdsRef = useRef({ distanceThreshold, hysteresis });

  const [partition, setPartition] = useState<LodPartitionResult>(() =>
    computeLodPartition(ships, camera.position.clone(), distanceThreshold, hysteresis, lodStateRef.current),
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

  const updatePartition = useCallback(
    (cameraPosition: Vector3) => {
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
    },
    [],
  );

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


