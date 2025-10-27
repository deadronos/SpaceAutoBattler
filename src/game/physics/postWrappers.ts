import type { GameState } from '../../types/index.js';
import type { Collider, KinematicBody } from './types.js';
import { withPostEnqueue } from './mutationHelpers.js';

export function postSetNextKinematicTranslation(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void {
  withPostEnqueue(state, 'postSetNextKinematicTranslation', () => {
    if (!rb) return;
    rb.setNextKinematicTranslation({ x, y, z });
  });
}

export function postSetNextKinematicRotation(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
  w: number,
): void {
  withPostEnqueue(state, 'postSetNextKinematicRotation', () => {
    if (!rb || typeof rb.setNextKinematicRotation !== 'function') return;
    rb.setNextKinematicRotation({ x, y, z, w });
  });
}

export function postSetLinvel(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void {
  withPostEnqueue(state, 'postSetLinvel', () => {
    if (!rb || typeof rb.setLinvel !== 'function') return;
    rb.setLinvel({ x, y, z });
  });
}

export function postSetAngvel(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void {
  withPostEnqueue(state, 'postSetAngvel', () => {
    if (!rb || typeof rb.setAngvel !== 'function') return;
    rb.setAngvel({ x, y, z });
  });
}

export function postSetMass(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  mass: number,
): void {
  withPostEnqueue(state, 'postSetMass', () => {
    if (!rb || typeof rb.setMass !== 'function') return;
    rb.setMass(mass);
  });
}

export function postSetLinearDamping(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  damping: number,
): void {
  withPostEnqueue(state, 'postSetLinearDamping', () => {
    if (!rb || typeof rb.setLinearDamping !== 'function') return;
    rb.setLinearDamping(damping);
  });
}

export function postSetAngularDamping(
  state: GameState | null | undefined,
  rb: KinematicBody | null | undefined,
  damping: number,
): void {
  withPostEnqueue(state, 'postSetAngularDamping', () => {
    if (!rb || typeof rb.setAngularDamping !== 'function') return;
    rb.setAngularDamping(damping);
  });
}

export function postSetColliderFriction(
  state: GameState | null | undefined,
  collider: Collider | null | undefined,
  friction: number,
): void {
  withPostEnqueue(state, 'postSetColliderFriction', () => {
    if (!collider || typeof collider.setFriction !== 'function') return;
    collider.setFriction(friction);
  });
}

export function postSetColliderRestitution(
  state: GameState | null | undefined,
  collider: Collider | null | undefined,
  restitution: number,
): void {
  withPostEnqueue(state, 'postSetColliderRestitution', () => {
    if (!collider || typeof collider.setRestitution !== 'function') return;
    collider.setRestitution(restitution);
  });
}
