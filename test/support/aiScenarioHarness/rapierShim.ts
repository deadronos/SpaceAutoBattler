import { Quaternion, Vector3 } from 'three';

/**
 * Rapier/physics shim objects for AI scenario harness.
 * These provide minimal physics stub implementations for testing.
 */

export function createRigidBodyShim(
  position: Vector3,
  rotation: Quaternion,
  velocity?: readonly [number, number, number],
) {
  const vel = velocity ? new Vector3(...velocity) : new Vector3();
  const angvelVar = { x: 0, y: 0, z: 0 };
  return {
    setNextKinematicTranslation: ({ x, y, z }: { x: number; y: number; z: number }) => {
      position.set(x, y, z);
    },
    setNextKinematicRotation: ({ x, y, z, w }: { x: number; y: number; z: number; w: number }) => {
      rotation.set(x, y, z, w);
    },
    setLinvel: ({ x, y, z }: { x: number; y: number; z: number }) => {
      vel.set(x, y, z);
    },
    setAngvel: ({ x, y, z }: { x: number; y: number; z: number }) => {
      // shim: store angular velocity in a closure variable for test inspection
      angvelVar.x = x;
      angvelVar.y = y;
      angvelVar.z = z;
    },
    translation: () => ({ x: position.x, y: position.y, z: position.z }),
    rotation: () => ({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }),
    linvel: () => ({ x: vel.x, y: vel.y, z: vel.z }),
    angvel: () => ({ ...angvelVar }),
  };
}

export function createPhysicsWorldShim() {
  return {
    createRigidBody: (desc: {
      translation: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number; w: number };
    }) => ({
      translation: () => ({ ...desc.translation }),
      rotation: () => ({ ...desc.rotation }),
      setNextKinematicTranslation: () => undefined,
      setNextKinematicRotation: () => undefined,
      setLinvel: () => undefined,
      setAngvel: () => undefined,
    }),
    createCollider: (desc: { radius?: number }, body: unknown) => ({
      handle: Math.random(),
      radius: desc.radius ?? 0,
      body,
    }),
  } as never;
}

export function createRapierShim() {
  return {
    RigidBodyDesc: {
      kinematicPositionBased: () => ({
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        setTranslation(x: number, y: number, z: number) {
          this.translation = { x, y, z };
          return this;
        },
        setRotation(rotation: { x: number; y: number; z: number; w: number }) {
          this.rotation = { ...rotation };
          return this;
        },
      }),
    },
    ColliderDesc: {
      ball: (radius: number) => ({
        radius,
        setActiveEvents() {
          return this;
        },
        setActiveCollisionTypes() {
          return this;
        },
      }),
    },
    ActiveEvents: { COLLISION_EVENTS: 0 },
    ActiveCollisionTypes: { ALL: 0 },
  } as never;
}
