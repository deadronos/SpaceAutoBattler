import { useThree, useFrame } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef } from 'react';
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

const DEFAULT_DISTANCE_THRESHOLD = 650;
const DEFAULT_HYSTERESIS = 80;
const DEFAULT_IMPOSTOR_CAPACITY = 256;

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
  const tempMatrix = useMemo(() => new Matrix4(), []);
  const tempScale = useMemo(() => new Vector3(), []);
  const tempColor = useMemo(() => new Color('#6fc3ff'), []);
  const tempQuat = useMemo(() => new Quaternion(), []);
  const tempPos = useMemo(() => new Vector3(), []);

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
    const mesh = meshRef.current;
    if (!mesh) return;

    let index = 0;
    let saturated = false;

    for (const ship of ships) {
      if (index >= capacity) {
        saturated = true;
        break;
      }

      tempPos.copy(ship.transform.position);
      const scale = Math.max(ship.transform.scale * 6, 4);
      tempScale.setScalar(scale);
      tempQuat.copy(camera.quaternion);
      tempMatrix.compose(tempPos, tempQuat, tempScale);
      mesh.setMatrixAt(index, tempMatrix);

      const teamColor = TEAM_COLORS[ship.ship.team] ?? '#a0a0a0';
      tempColor.set(teamColor);
      mesh.setColorAt(index, tempColor);

      index += 1;
    }

    mesh.count = index;
    mesh.visible = index > 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    warnOnSaturation({
      saturated,
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

  const cameraSnapshot = useMemo(
    () => camera.position.clone(),
    [camera.position.x, camera.position.y, camera.position.z],
  );

  const partition = useMemo(
    () =>
      partitionShipsByDistance(
        ships,
        cameraSnapshot,
        distanceThreshold,
        hysteresis,
        lodStateRef.current,
      ),
    [ships, cameraSnapshot, distanceThreshold, hysteresis],
  );

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

