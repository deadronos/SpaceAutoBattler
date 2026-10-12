import { describe, expect, it } from 'vite-plus/test';
import { createRenderOnlyPhysics } from '../../src/game/physics/renderOnlyStub.js';
import { createGameState } from '../../src/game/createGameState.js';

describe('createRenderOnlyPhysics', () => {
  it('exposes the fixed simulation timestep on integrationParameters', () => {
    const { physicsWorld } = createRenderOnlyPhysics();
    expect(physicsWorld.integrationParameters.dt).toBe(1 / 20);
  });

  it('provides no-op teardown and body-removal hooks that do not throw', () => {
    const { physicsWorld } = createRenderOnlyPhysics();
    const stub = physicsWorld as unknown as {
      free: () => void;
      removeCollider: (...args: unknown[]) => void;
      removeRigidBody: (...args: unknown[]) => void;
    };

    expect(() => stub.free()).not.toThrow();
    expect(() => stub.removeCollider(1, 2)).not.toThrow();
    expect(() => stub.removeRigidBody(3, 4)).not.toThrow();
  });

  it('provides a no-op event queue and a non-null rapier module stand-in', () => {
    const { eventQueue, rapier } = createRenderOnlyPhysics();

    expect(() => eventQueue.free()).not.toThrow();
    expect(rapier).toBeTruthy();
    expect(typeof rapier).toBe('object');
  });

  it('is wired into createGameState({ renderOnly: true })', async () => {
    const state = await createGameState({ renderOnly: true });
    expect(state.physicsWorld.integrationParameters.dt).toBe(1 / 20);
    expect(() => state.eventQueue.free()).not.toThrow();
  });
});
