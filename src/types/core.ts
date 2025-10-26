import type { World as ECSWorld } from 'miniplex';

type RapierModule = (typeof import('@dimforge/rapier3d-compat'))['default'];
type RapierWorld = RapierModule['World'];
type Collider = RapierModule['Collider'];
type EventQueue = RapierModule['EventQueue'];
type RigidBody = RapierModule['RigidBody'];

export type { RapierModule, RapierWorld, Collider, EventQueue, RigidBody };

export type EntityId = number;

export type Archetype<
  T extends object,
  _C extends readonly string[] = readonly string[],
> = ReturnType<ECSWorld<T>['with']>;
