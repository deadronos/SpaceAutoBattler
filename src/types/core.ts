import type { World as ECSWorld } from 'miniplex';

import type {
  World as RapierWorld,
  Collider,
  EventQueue,
  RigidBody,
} from '@dimforge/rapier3d-compat';
export type RapierModule = typeof import('@dimforge/rapier3d-compat');

export type { RapierWorld, Collider, EventQueue, RigidBody };

export type EntityId = number;

export type Archetype<
  T extends object,
  _C extends readonly string[] = readonly string[],
> = ReturnType<ECSWorld<T>['with']>;
