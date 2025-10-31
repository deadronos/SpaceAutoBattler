import type { GameState } from '../../types/index.js';
import type { Collider, KinematicBody } from './types.js';
import { withDeferredEnqueue, withPostEnqueue } from './mutationHelpers.js';

/**
 * Generic physics wrapper factory
 * 
 * This module provides a generic way to create both deferred and post-physics mutation wrappers,
 * eliminating code duplication between deferWrappers.ts and postWrappers.ts.
 */

type EnqueueFn = typeof withDeferredEnqueue | typeof withPostEnqueue;

/**
 * Creates a wrapper function for kinematic translation operations
 */
function createTranslationWrapper(
  enqueue: EnqueueFn,
  prefix: string,
): (
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
) => void {
  return (state, rb, x, y, z) => {
    enqueue(state, `${prefix}SetNextKinematicTranslation`, () => {
      if (!rb) return;
      rb.setNextKinematicTranslation({ x, y, z });
    });
  };
}

/**
 * Creates a wrapper function for kinematic rotation operations
 */
function createRotationWrapper(
  enqueue: EnqueueFn,
  prefix: string,
): (
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
  w: number,
) => void {
  return (state, rb, x, y, z, w) => {
    enqueue(state, `${prefix}SetNextKinematicRotation`, () => {
      if (!rb || typeof rb.setNextKinematicRotation !== 'function') return;
      rb.setNextKinematicRotation({ x, y, z, w });
    });
  };
}

/**
 * Creates a wrapper function for linear velocity operations
 */
function createLinvelWrapper(
  enqueue: EnqueueFn,
  prefix: string,
): (
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
) => void {
  return (state, rb, x, y, z) => {
    enqueue(state, `${prefix}SetLinvel`, () => {
      if (!rb || typeof rb.setLinvel !== 'function') return;
      rb.setLinvel({ x, y, z });
    });
  };
}

/**
 * Creates a wrapper function for angular velocity operations
 */
function createAngvelWrapper(
  enqueue: EnqueueFn,
  prefix: string,
): (
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
) => void {
  return (state, rb, x, y, z) => {
    enqueue(state, `${prefix}SetAngvel`, () => {
      if (!rb || typeof rb.setAngvel !== 'function') return;
      rb.setAngvel({ x, y, z });
    });
  };
}

/**
 * Creates a wrapper function for mass operations
 */
function createMassWrapper(
  enqueue: EnqueueFn,
  prefix: string,
): (
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  mass: number,
) => void {
  return (state, rb, mass) => {
    enqueue(state, `${prefix}SetMass`, () => {
      if (!rb || typeof rb.setMass !== 'function') return;
      rb.setMass(mass);
    });
  };
}

/**
 * Creates a wrapper function for linear damping operations
 */
function createLinearDampingWrapper(
  enqueue: EnqueueFn,
  prefix: string,
): (
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  damping: number,
) => void {
  return (state, rb, damping) => {
    enqueue(state, `${prefix}SetLinearDamping`, () => {
      if (!rb || typeof rb.setLinearDamping !== 'function') return;
      rb.setLinearDamping(damping);
    });
  };
}

/**
 * Creates a wrapper function for angular damping operations
 */
function createAngularDampingWrapper(
  enqueue: EnqueueFn,
  prefix: string,
): (
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  damping: number,
) => void {
  return (state, rb, damping) => {
    enqueue(state, `${prefix}SetAngularDamping`, () => {
      if (!rb || typeof rb.setAngularDamping !== 'function') return;
      rb.setAngularDamping(damping);
    });
  };
}

/**
 * Creates a wrapper function for collider friction operations
 */
function createColliderFrictionWrapper(
  enqueue: EnqueueFn,
  prefix: string,
): (
  state: GameState | null | undefined,
  collider: Collider | null | undefined,
  friction: number,
) => void {
  return (state, collider, friction) => {
    enqueue(state, `${prefix}SetColliderFriction`, () => {
      if (!collider || typeof collider.setFriction !== 'function') return;
      collider.setFriction(friction);
    });
  };
}

/**
 * Creates a wrapper function for collider restitution operations
 */
function createColliderRestitutionWrapper(
  enqueue: EnqueueFn,
  prefix: string,
): (
  state: GameState | null | undefined,
  collider: Collider | null | undefined,
  restitution: number,
) => void {
  return (state, collider, restitution) => {
    enqueue(state, `${prefix}SetColliderRestitution`, () => {
      if (!collider || typeof collider.setRestitution !== 'function') return;
      collider.setRestitution(restitution);
    });
  };
}

// Export deferred wrappers
export const deferSetNextKinematicTranslation = createTranslationWrapper(
  withDeferredEnqueue,
  'defer',
);
export const deferSetNextKinematicRotation = createRotationWrapper(withDeferredEnqueue, 'defer');
export const deferSetLinvel = createLinvelWrapper(withDeferredEnqueue, 'defer');
export const deferSetAngvel = createAngvelWrapper(withDeferredEnqueue, 'defer');
export const deferSetMass = createMassWrapper(withDeferredEnqueue, 'defer');
export const deferSetLinearDamping = createLinearDampingWrapper(withDeferredEnqueue, 'defer');
export const deferSetAngularDamping = createAngularDampingWrapper(withDeferredEnqueue, 'defer');
export const deferSetColliderFriction = createColliderFrictionWrapper(withDeferredEnqueue, 'defer');
export const deferSetColliderRestitution = createColliderRestitutionWrapper(
  withDeferredEnqueue,
  'defer',
);

// Export post-physics wrappers
export const postSetNextKinematicTranslation = createTranslationWrapper(withPostEnqueue, 'post');
export const postSetNextKinematicRotation = createRotationWrapper(withPostEnqueue, 'post');
export const postSetLinvel = createLinvelWrapper(withPostEnqueue, 'post');
export const postSetAngvel = createAngvelWrapper(withPostEnqueue, 'post');
export const postSetMass = createMassWrapper(withPostEnqueue, 'post');
export const postSetLinearDamping = createLinearDampingWrapper(withPostEnqueue, 'post');
export const postSetAngularDamping = createAngularDampingWrapper(withPostEnqueue, 'post');
export const postSetColliderFriction = createColliderFrictionWrapper(withPostEnqueue, 'post');
export const postSetColliderRestitution = createColliderRestitutionWrapper(withPostEnqueue, 'post');
