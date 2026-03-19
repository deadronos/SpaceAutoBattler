import { describe, it, expect } from 'vite-plus/test';
import { Quaternion, Vector3 } from 'three';
import type { Collider, GameEntity, GameState, RigidBody } from '../../src/types/index.js';
import {
  createKinematicBodyWithCollider,
  registerColliderHandle,
  unregisterColliderHandle,
} from '../../src/game/utils/physicsFactory.js';

class MockBodyDesc {
  translation: [number, number, number] = [0, 0, 0];
  rotation = { x: 0, y: 0, z: 0, w: 1 };
  ccd = false;

  setTranslation(x: number, y: number, z: number): this {
    this.translation = [x, y, z];
    return this;
  }

  setRotation(rotation: { x: number; y: number; z: number; w: number }): this {
    this.rotation = rotation;
    return this;
  }

  setCcdEnabled(enabled: boolean): this {
    this.ccd = enabled;
    return this;
  }
}

class MockColliderDesc {
  readonly kind: 'ball' | 'capsule';
  readonly radius: number;
  readonly halfHeight?: number;
  activeEvents: number | undefined;
  activeCollisionTypes: number | undefined;
  sensor: boolean | undefined;

  constructor(kind: 'ball' | 'capsule', radius: number, halfHeight?: number) {
    this.kind = kind;
    this.radius = radius;
    this.halfHeight = halfHeight;
  }

  setActiveEvents(value: number): this {
    this.activeEvents = value;
    return this;
  }

  setActiveCollisionTypes(value: number): this {
    this.activeCollisionTypes = value;
    return this;
  }

  setSensor(value: boolean): this {
    this.sensor = value;
    return this;
  }
}

function createMockState(): {
  state: GameState;
  bodyDesc: () => MockBodyDesc;
  colliderDesc: () => MockColliderDesc;
} {
  let latestBody: MockBodyDesc | undefined;
  let latestCollider: MockColliderDesc | undefined;

  const state = {
    rapier: {
      RigidBodyDesc: {
        kinematicPositionBased: () => {
          latestBody = new MockBodyDesc();
          return latestBody;
        },
      },
      ColliderDesc: {
        ball: (radius: number) => {
          latestCollider = new MockColliderDesc('ball', radius);
          return latestCollider;
        },
        capsule: (halfHeight: number, radius: number) => {
          latestCollider = new MockColliderDesc('capsule', radius, halfHeight);
          return latestCollider;
        },
      },
      ActiveEvents: { COLLISION_EVENTS: 1 },
      ActiveCollisionTypes: { ALL: 3 },
    },
    physicsWorld: {
      createRigidBody: (desc: MockBodyDesc) => ({ desc }) as unknown as RigidBody,
      createCollider: (desc: MockColliderDesc) => ({ handle: 42, desc }) as unknown as Collider,
    },
    colliderLookup: new Map<number, GameEntity>(),
  } as unknown as GameState;

  return {
    state,
    bodyDesc: () => latestBody as MockBodyDesc,
    colliderDesc: () => latestCollider as MockColliderDesc,
  };
}

describe('physicsFactory', () => {
  it('creates a kinematic body and collider with provided transforms', () => {
    const { state, bodyDesc, colliderDesc } = createMockState();
    const position = new Vector3(5, 6, 7);
    const rotation = new Quaternion(0.1, 0.2, 0.3, 0.9);

    const { body, collider } = createKinematicBodyWithCollider(state, {
      position,
      rotation,
      collider: { type: 'capsule', halfHeight: 0.8, radius: 0.6 },
      ccd: true,
    });

    expect(body).toBeTruthy();
    expect(collider).toBeTruthy();
    expect(bodyDesc().translation).toEqual([5, 6, 7]);
    expect(bodyDesc().rotation).toEqual({ x: 0.1, y: 0.2, z: 0.3, w: 0.9 });
    expect(bodyDesc().ccd).toBe(true);
    expect(colliderDesc().kind).toBe('capsule');
    expect(colliderDesc().radius).toBe(0.6);
    expect(colliderDesc().halfHeight).toBe(0.8);
    expect(colliderDesc().activeEvents).toBe(1);
    expect(colliderDesc().activeCollisionTypes).toBe(3);
  });

  it('applies overrides and sensor flag when provided', () => {
    const { state, colliderDesc } = createMockState();

    createKinematicBodyWithCollider(state, {
      collider: { type: 'ball', radius: 0.25 },
      sensor: true,
      activeEvents: 9,
      activeCollisionTypes: 12,
    });

    expect(colliderDesc().kind).toBe('ball');
    expect(colliderDesc().radius).toBe(0.25);
    expect(colliderDesc().sensor).toBe(true);
    expect(colliderDesc().activeEvents).toBe(9);
    expect(colliderDesc().activeCollisionTypes).toBe(12);
  });

  it('safely registers and unregisters collider handles', () => {
    const { state } = createMockState();
    const collider = { handle: 77 } as Collider;
    const entity = { id: 1 } as unknown as GameEntity;

    registerColliderHandle(state, collider, entity);
    expect(state.colliderLookup.get(77)).toBe(entity);

    unregisterColliderHandle(state, collider);
    expect(state.colliderLookup.has(77)).toBe(false);
  });

  it('ignores colliders without handles when registering', () => {
    const { state } = createMockState();
    registerColliderHandle(state, null, { id: 2 } as unknown as GameEntity);
    expect(state.colliderLookup.size).toBe(0);
  });
});
