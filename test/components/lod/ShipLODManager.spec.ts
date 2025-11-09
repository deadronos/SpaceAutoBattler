import { describe, expect, it } from 'vitest';
import {
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';
import type { ShipEntity, Team } from '../../../src/types/index.js';
import {
  partitionShipsByDistance,
  computeLodPartition,
  partitionsEqual,
  DEFAULT_DISTANCE_THRESHOLD,
  DEFAULT_HYSTERESIS,
} from '../../../src/components/lod/shipLodPartition.js';
import { populateImpostorInstances } from '../../../src/components/lod/ShipImpostorLayer.js';

function createShip(
  id: number,
  distance: number,
  options: { position?: Vector3; scale?: number; team?: Team } = {},
): ShipEntity {
  const position = options.position ? options.position.clone() : new Vector3(distance, 0, 0);
  const scale = options.scale ?? 1;
  const team = (options.team ?? 'alliance') as Team;

  return {
    id,
    rigidBody: null as any,
    collider: null as any,
    transform: {
      position,
      rotation: new Quaternion(),
      scale,
    },
    ship: {
      team,
      hull: 'fighter',
      hp: 10,
      maxHp: 10,
      shield: 0,
      maxShield: 0,
      cooldown: 0,
      fireRate: 0,
      damage: 0,
      projectileSpeed: 0,
      range: 0,
      speed: 0,
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      lateralAcceleration: 0,
      motion: { maxSpeed: 0, turnRate: 0, acceleration: 0 },
      effects: [],
      xp: 0,
      level: 1,
      xpToNext: 1,
      damageType: 'kinetic',
      levelBonuses: {} as any,
      subsystems: {} as any,
      armor: 0,
      captain: undefined,
    },
    muzzleFlashes: [],
  } as unknown as ShipEntity;
}

describe('partitionShipsByDistance', () => {
  it('classifies ships with hysteresis to avoid flicker', () => {
    const camera = new Vector3(0, 0, 0);
    const previous = new Map<number, 'near' | 'far'>();
    const ships = [createShip(1, 100), createShip(2, 800)];

    const first = partitionShipsByDistance(ships, camera, 500, 50, previous);
    expect(first.nearShips.map((s) => s.id)).toEqual([1]);
    expect(first.farShips.map((s) => s.id)).toEqual([2]);

    // Move the far ship just inside the hysteresis band; should remain far
    ships[1].transform.position.set(470, 0, 0);
    const second = partitionShipsByDistance(ships, camera, 500, 50, previous);
    expect(second.farShips.map((s) => s.id)).toContain(2);

    // Move clearly near; should flip now
    ships[1].transform.position.set(300, 0, 0);
    const third = partitionShipsByDistance(ships, camera, 500, 50, previous);
    expect(third.nearShips.map((s) => s.id)).toContain(2);
  });
});

describe('computeLodPartition', () => {
  it('promotes ships to the near cohort when the camera approaches', () => {
    const ships = [createShip(1, 0), createShip(2, 1200)];
    const lodState = new Map<number, 'near' | 'far'>();
    const cameraFar = new Vector3(0, 0, 2200);
    const farPartition = computeLodPartition(ships, cameraFar, 900, 80, lodState);
    expect(farPartition.nearShips).toHaveLength(0);

    const cameraNear = new Vector3(0, 0, 400);
    const nearPartition = computeLodPartition(ships, cameraNear, 900, 80, lodState);
    expect(nearPartition.nearShips.map((s) => s.id)).toEqual([1]);
    expect(partitionsEqual(farPartition, nearPartition)).toBe(false);
  });

  it('classifies close ships as near for the default camera and threshold', () => {
    const ships = [createShip(1, 0), createShip(2, 300)];
    const cameraDefault = new Vector3(0, 600, 1600);
    const partition = computeLodPartition(
      ships,
      cameraDefault,
      DEFAULT_DISTANCE_THRESHOLD,
      DEFAULT_HYSTERESIS,
      new Map<number, 'near' | 'far'>(),
    );
    const nearIds = partition.nearShips.map((s) => s.id).sort();
    expect(nearIds).toEqual([1, 2]);
  });
});

describe('populateImpostorInstances', () => {
  it('updates instance transforms and keeps the mesh visible', () => {
    const ships = [createShip(1, 0)];
    const geometry = new PlaneGeometry(1, 1, 1, 1);
    const material = new MeshBasicMaterial();
    const mesh = new InstancedMesh(geometry, material, 4);
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(4 * 3), 3);

    const temp = {
      matrix: new Matrix4(),
      scale: new Vector3(),
      quat: new Quaternion(),
      pos: new Vector3(),
      color: new Color('#ffffff'),
    };

    const result = populateImpostorInstances({
      ships,
      capacity: 4,
      cameraQuaternion: new Quaternion(),
      mesh,
      temp,
    });

    expect(result.count).toBe(1);
    expect(result.saturated).toBe(false);
    expect(mesh.visible).toBe(true);

    const matrix = new Matrix4();
    mesh.getMatrixAt(0, matrix);
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    matrix.decompose(position, rotation, scale);
    expect(position.distanceTo(ships[0].transform.position)).toBeLessThan(1e-6);
    expect(rotation.equals(new Quaternion())).toBe(true);

    geometry.dispose();
    material.dispose();
  });

  it('reports saturation when capacity is exceeded', () => {
    const ships = [createShip(1, 0), createShip(2, 10)];
    const geometry = new PlaneGeometry(1, 1, 1, 1);
    const material = new MeshBasicMaterial();
    const mesh = new InstancedMesh(geometry, material, 1);
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(3), 3);

    const temp = {
      matrix: new Matrix4(),
      scale: new Vector3(),
      quat: new Quaternion(),
      pos: new Vector3(),
      color: new Color('#ffffff'),
    };

    const result = populateImpostorInstances({
      ships,
      capacity: 1,
      cameraQuaternion: new Quaternion(),
      mesh,
      temp,
    });

    expect(result.count).toBe(1);
    expect(result.saturated).toBe(true);
    expect(mesh.count).toBe(1);
    expect(mesh.visible).toBe(true);

    geometry.dispose();
    material.dispose();
  });
});
