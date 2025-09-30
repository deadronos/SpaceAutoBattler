import type { World as ECSWorld } from 'miniplex';

type RapierModule = (typeof import('@dimforge/rapier3d-compat'))['default'];
type RapierWorld = RapierModule['World'];
type Collider = RapierModule['Collider'];
type EventQueue = RapierModule['EventQueue'];
type RigidBody = RapierModule['RigidBody'];

export type { RapierModule, RapierWorld, Collider, EventQueue, RigidBody };

export type EntityId = number;

/**
 * Minimal representation of the parts of a Miniplex query that the codebase
 * depends on. This avoids pulling in a non-existent `Archetype` export and
 * keeps typing tight for our usage patterns (entities + lifecycle events).
 */
type MiniplexQueryReturn<T> = {
  entities: T[];
};

type LegacyArchetypeShape<T> = MiniplexQueryReturn<T> & {
  onEntityAdded?: {
    add?: (cb: () => void) => void;
    remove?: (cb: () => void) => void;
    subscribe?: (cb: (entity?: T) => void) => void | (() => void) | { unsubscribe: () => void };
  };
  onEntityRemoved?: {
    add?: (cb: () => void) => void;
    remove?: (cb: () => void) => void;
    subscribe?: (cb: (entity?: T) => void) => void | (() => void) | { unsubscribe: () => void };
  };
  [key: string]: unknown;
};

export type Archetype<T, _C extends readonly string[] = readonly string[]> =
  | (ReturnType<ECSWorld<object>['with']> & MiniplexQueryReturn<T>)
  | LegacyArchetypeShape<T>;

export type { MiniplexQueryReturn };
