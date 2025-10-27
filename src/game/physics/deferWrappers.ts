import type { GameState } from '../../types/index.js';
import type { Collider, KinematicBody } from './types.js';
import { withDeferredEnqueue } from './mutationHelpers.js';

export function deferSetNextKinematicTranslation(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void {
  withDeferredEnqueue(state, 'deferSetNextKinematicTranslation', () => {
    if (!rb) return;
    rb.setNextKinematicTranslation({ x, y, z });
  });
}

export function deferSetNextKinematicRotation(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
  w: number,
): void {
  withDeferredEnqueue(state, 'deferSetNextKinematicRotation', () => {
    if (!rb || typeof rb.setNextKinematicRotation !== 'function') return;
    rb.setNextKinematicRotation({ x, y, z, w });
  });
}

export function deferSetLinvel(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void {
  withDeferredEnqueue(state, 'deferSetLinvel', () => {
    if (!rb || typeof rb.setLinvel !== 'function') return;
    rb.setLinvel({ x, y, z });
  });
}

export function deferSetAngvel(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void {
  withDeferredEnqueue(state, 'deferSetAngvel', () => {
    if (!rb || typeof rb.setAngvel !== 'function') return;
    rb.setAngvel({ x, y, z });
  });
}

export function deferSetMass(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  mass: number,
): void {
  withDeferredEnqueue(state, 'deferSetMass', () => {
    if (!rb || typeof rb.setMass !== 'function') return;
    rb.setMass(mass);
  });
}

export function deferSetLinearDamping(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  damping: number,
): void {
  withDeferredEnqueue(state, 'deferSetLinearDamping', () => {
    if (!rb || typeof rb.setLinearDamping !== 'function') return;
    rb.setLinearDamping(damping);
  });
}

export function deferSetAngularDamping(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  damping: number,
): void {
  withDeferredEnqueue(state, 'deferSetAngularDamping', () => {
    if (!rb || typeof rb.setAngularDamping !== 'function') return;
    rb.setAngularDamping(damping);
  });
}

export function deferSetColliderFriction(
  state: GameState | null | undefined,
  collider: Collider | null | undefined,
  friction: number,
): void {
  withDeferredEnqueue(state, 'deferSetColliderFriction', () => {
    if (!collider || typeof collider.setFriction !== 'function') return;
    collider.setFriction(friction);
  });
}

export function deferSetColliderRestitution(
  state: GameState | null | undefined,
  collider: Collider | null | undefined,
  restitution: number,
): void {
  withDeferredEnqueue(state, 'deferSetColliderRestitution', () => {
    if (!collider || typeof collider.setRestitution !== 'function') return;
    collider.setRestitution(restitution);
  });
}
