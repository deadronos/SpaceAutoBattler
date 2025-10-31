import type { Vector3 } from 'three';
import type { ShipEntity } from '../../types/index.js';

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
