import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, cleanup, render } from '@testing-library/react';
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

const { frameCallbacks, camera, thrusterShipsCalls, impostorShipsCalls } = vi.hoisted(() => ({
  frameCallbacks: [] as Array<() => void>,
  camera: { position: { x: 0, y: 0, z: 0 } },
  thrusterShipsCalls: [] as Array<readonly ShipEntity[]>,
  impostorShipsCalls: [] as Array<readonly ShipEntity[]>,
}));

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ camera }),
  useFrame: (fn: () => void) => {
    frameCallbacks.push(fn);
  },
}));

vi.mock('../../../src/components/Ship.js', () => ({
  ShipObject: () => null,
}));

vi.mock('../../../src/components/thrusters/ThrusterInstancedManager.js', () => ({
  ThrusterInstancedManager: (props: { ships: readonly ShipEntity[] }) => {
    thrusterShipsCalls.push(props.ships);
    return null;
  },
}));

vi.mock('../../../src/components/lod/ShipImpostorLayer.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/components/lod/ShipImpostorLayer.js')>();
  return {
    ...actual,
    ShipImpostorLayer: (props: { ships: readonly ShipEntity[] }) => {
      impostorShipsCalls.push(props.ships);
      return null;
    },
  };
});

import { ShipLODManager } from '../../../src/components/lod/ShipLODManager.js';
import {
  createLodPartitionBuffer,
  partitionShipsByDistance,
  partitionShipsByDistanceInto,
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
    ships[1]!.transform.position.set(470, 0, 0);
    const second = partitionShipsByDistance(ships, camera, 500, 50, previous);
    expect(second.farShips.map((s) => s.id)).toContain(2);

    // Move clearly near; should flip now
    ships[1]!.transform.position.set(300, 0, 0);
    const third = partitionShipsByDistance(ships, camera, 500, 50, previous);
    expect(third.nearShips.map((s) => s.id)).toContain(2);
  });
});

describe('partitionShipsByDistanceInto', () => {
  it('creates an empty reusable buffer', () => {
    const buffer = createLodPartitionBuffer();
    expect(buffer.nearShips).toEqual([]);
    expect(buffer.farShips).toEqual([]);
    expect(buffer.activeIds.size).toBe(0);
  });

  it('reuses the same buffer, arrays and Set across calls without reallocating', () => {
    const buffer = createLodPartitionBuffer();
    const nearRef = buffer.nearShips;
    const farRef = buffer.farShips;
    const idsRef = buffer.activeIds;
    const previous = new Map<number, 'near' | 'far'>();
    const camera = new Vector3(0, 0, 0);
    const ships = [createShip(1, 100), createShip(2, 800)];

    const first = partitionShipsByDistanceInto(ships, camera, 500, 50, previous, buffer);
    expect(first).toBe(buffer);
    expect(buffer.nearShips).toBe(nearRef);
    expect(buffer.farShips).toBe(farRef);
    expect(buffer.activeIds).toBe(idsRef);
    expect(first.nearShips.map((s) => s.id)).toEqual([1]);
    expect(first.farShips.map((s) => s.id)).toEqual([2]);

    const second = partitionShipsByDistanceInto(ships, camera, 500, 50, previous, buffer);
    expect(second).toBe(buffer);
    expect(buffer.nearShips).toBe(nearRef);
    expect(buffer.farShips).toBe(farRef);
    expect(buffer.activeIds).toBe(idsRef);
  });

  it('clears stale cohort entries when ships move between cohorts', () => {
    const buffer = createLodPartitionBuffer();
    const nearRef = buffer.nearShips;
    const previous = new Map<number, 'near' | 'far'>();
    const camera = new Vector3(0, 0, 0);
    const nearShip = createShip(1, 100);
    const farShip = createShip(2, 800);

    const first = partitionShipsByDistanceInto(
      [nearShip, farShip],
      camera,
      500,
      50,
      previous,
      buffer,
    );
    expect(first.nearShips.map((s) => s.id)).toEqual([1]);

    // Ship 1 moves far; the reused near array must drop the stale entry.
    nearShip.transform.position.set(900, 0, 0);
    const second = partitionShipsByDistanceInto(
      [nearShip, farShip],
      camera,
      500,
      50,
      previous,
      buffer,
    );
    expect(second.nearShips).toBe(nearRef);
    expect(second.nearShips).toHaveLength(0);
    expect(second.farShips.map((s) => s.id).sort()).toEqual([1, 2]);
  });

  it('matches the pure partitionShipsByDistance result for identical inputs', () => {
    const camera = new Vector3(0, 0, 0);
    const ships = [
      createShip(1, 100),
      createShip(2, 470),
      createShip(3, 800),
      createShip(4, 0, { position: new Vector3(-200, 50, 30) }),
    ];

    const pure = partitionShipsByDistance(
      ships,
      camera,
      500,
      50,
      new Map<number, 'near' | 'far'>(),
    );
    const buffer = createLodPartitionBuffer();
    const into = partitionShipsByDistanceInto(
      ships,
      camera,
      500,
      50,
      new Map<number, 'near' | 'far'>(),
      buffer,
    );

    expect(into.nearShips.map((s) => s.id)).toEqual(pure.nearShips.map((s) => s.id));
    expect(into.farShips.map((s) => s.id)).toEqual(pure.farShips.map((s) => s.id));
    expect(partitionsEqual(into, pure)).toBe(true);
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

  it('classifies a ship across the world as far at the default threshold', () => {
    const camera = new Vector3(0, 600, 1600);
    const central = createShip(1, 0, { position: new Vector3(0, 0, 0) });
    const farCorner = createShip(2, 0, { position: new Vector3(-4000, 0, -4000) });

    const partition = computeLodPartition(
      [central, farCorner],
      camera,
      DEFAULT_DISTANCE_THRESHOLD,
      DEFAULT_HYSTERESIS,
      new Map<number, 'near' | 'far'>(),
    );

    expect(partition.nearShips.map((s) => s.id)).toEqual([1]);
    expect(partition.farShips.map((s) => s.id)).toEqual([2]);
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
    expect(position.distanceTo(ships[0]!.transform.position)).toBeLessThan(1e-6);
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

describe('ShipLODManager buffer reuse', () => {
  afterEach(() => {
    cleanup();
    frameCallbacks.length = 0;
    thrusterShipsCalls.length = 0;
    impostorShipsCalls.length = 0;
    camera.position.x = 0;
    camera.position.y = 0;
    camera.position.z = 0;
  });

  it('does not mutate the committed partition arrays when a frame writes a new partition', () => {
    const ships = [createShip(1, 100), createShip(2, 800)];
    render(
      React.createElement(ShipLODManager, {
        ships,
        distanceThreshold: 500,
        hysteresis: 50,
      }),
    );

    const committedNear = thrusterShipsCalls.at(-1)!;
    const committedFar = impostorShipsCalls.at(-1)!;
    expect(committedNear.map((s) => s.id)).toEqual([1]);
    expect(committedFar.map((s) => s.id)).toEqual([2]);

    // Two frame updates in one batch: React defers the commit of the first flip,
    // so the second frame runs while the first flip's buffer is still pending.
    // A scheme that writes into the "non-active" buffer would clobber the arrays
    // the still-mounted children reference; a scheme that only writes into a
    // buffer that is neither committed nor pending leaves them untouched.
    act(() => {
      camera.position.x = 800; // ship 2 near, ship 1 far
      for (const cb of frameCallbacks) cb();
      camera.position.x = 5000; // both far
      for (const cb of frameCallbacks) cb();
    });

    // Arrays captured from the previously committed render are unchanged.
    expect(committedNear.map((s) => s.id)).toEqual([1]);
    expect(committedFar.map((s) => s.id)).toEqual([2]);

    // The latest committed render reflects the newest partition (both far).
    expect(thrusterShipsCalls.at(-1)!.map((s) => s.id)).toEqual([]);
    expect(
      impostorShipsCalls
        .at(-1)!
        .map((s) => s.id)
        .sort(),
    ).toEqual([1, 2]);
  });
});
