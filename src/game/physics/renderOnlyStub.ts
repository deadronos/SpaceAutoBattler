import type { EventQueue, RapierModule, RapierWorld } from '../../types/index.js';

/**
 * Narrow structural subset of the Rapier physics world the render-only path
 * actually touches. The real `RapierWorld` is a WASM-backed nominal type that
 * cannot be instantiated without initializing Rapier, so the render-only path
 * exposes just these members.
 */
interface RenderOnlyPhysicsWorld {
  integrationParameters: { dt: number };
  free: () => void;
  removeCollider: (...args: unknown[]) => void;
  removeRigidBody: (...args: unknown[]) => void;
}

/** Narrow structural subset of the Rapier event queue used by the render-only path. */
interface RenderOnlyEventQueue {
  free: () => void;
}

/**
 * The render-only stand-ins for the Rapier runtime handles held on `GameState`.
 */
export interface RenderOnlyPhysics {
  physicsWorld: RapierWorld;
  eventQueue: EventQueue;
  rapier: RapierModule;
}

/**
 * Builds inert, render-only replacements for the Rapier physics world, event
 * queue, and module. These keep the deterministic simulation surface intact
 * (fixed timestep, no-op teardown/removal) without loading the Rapier WASM
 * module, which is only needed when the simulation actually runs.
 *
 * @returns {RenderOnlyPhysics} The no-op physics handles for render-only mode.
 */
export function createRenderOnlyPhysics(): RenderOnlyPhysics {
  const physicsWorld: RenderOnlyPhysicsWorld = {
    integrationParameters: {
      dt: 1 / 20,
    },
    free: () => {},
    removeCollider: () => {},
    removeRigidBody: () => {},
  };

  const eventQueue: RenderOnlyEventQueue = {
    free: () => {},
  };

  return {
    physicsWorld: physicsWorld as unknown as RapierWorld,
    eventQueue: eventQueue as unknown as EventQueue,
    rapier: {} as RapierModule,
  };
}
