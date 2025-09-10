import type { Vector3, EntityId } from '../../types/index.js';

/**
 * Physics body properties for creating new bodies
 */
export interface BodyProps {
  position: Vector3;
  velocity?: Vector3;
  mass?: number;
  radius?: number;
  isStatic?: boolean;
  collisionMask?: number;
}

/**
 * Physics body state for querying/updating
 */
export interface BodyState {
  position: Vector3;
  velocity: Vector3;
  mass: number;
  radius: number;
}

/**
 * Raycast hit result
 */
export interface RaycastHit {
  entityId: EntityId;
  point: Vector3;
  normal: Vector3;
  distance: number;
}

/**
 * Sweep hit result for moving objects
 */
export interface SweepHit {
  entityId: EntityId;
  point: Vector3;
  normal: Vector3;
  distance: number;
  time: number; // [0,1] time along sweep
}

/**
 * Axis-aligned bounding box
 */
export interface AABB {
  min: Vector3;
  max: Vector3;
}

/**
 * Physics event types
 */
export interface PhysicsEvent {
  type: 'collision' | 'sleep' | 'wake';
  entityIds: EntityId[];
  point?: Vector3;
  normal?: Vector3;
  impulse?: number;
}

/**
 * Disposable interface for event subscriptions
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Enhanced PhysicsAdapter providing comprehensive physics operations
 * for simulation determinism, queries, and body management.
 */
export interface PhysicsAdapter {
  initDone: boolean;
  world?: unknown;

  // Core simulation
  step(dt: number, opts?: { iterations?: number; substeps?: number }): void;
  getLastStepInfo(): { dt: number; iterations: number; substeps: number };
  dispose(): void;

  // Collision and overlap queries
  raycast(from: Vector3, to: Vector3, mask?: number): RaycastHit | null;
  sweepSphere(
    center: Vector3,
    radius: number,
    dir: Vector3,
    maxDist: number,
    mask?: number,
  ): SweepHit | null;
  overlapAABB(aabb: AABB, mask?: number): EntityId[];

  // Body management
  addBody(entityId: EntityId, props: BodyProps): void;
  removeBody(entityId: EntityId): void;
  setBodyState(entityId: EntityId, state: Partial<BodyState>): void;
  getBodyState(entityId: EntityId): BodyState | null;

  // Forces and impulses
  applyImpulse(entityId: EntityId, impulse: Vector3): void;
  applyForce(entityId: EntityId, force: Vector3): void;

  // Events
  on(event: 'collision' | 'sleep' | 'wake', handler: (e: PhysicsEvent) => void): Disposable;
}

/**
 * No-op physics adapter for tests and headless runs.
 */
export class NoopPhysicsAdapter implements PhysicsAdapter {
  initDone = true;
  private lastStep = { dt: 0, iterations: 0, substeps: 0 };
  private eventHandlers = new Map<string, ((e: PhysicsEvent) => void)[]>();

  step(dt: number, opts?: { iterations?: number; substeps?: number }): void {
    this.lastStep = {
      dt,
      iterations: opts?.iterations ?? 1,
      substeps: opts?.substeps ?? 1,
    };
  }

  getLastStepInfo() {
    return { ...this.lastStep };
  }

  dispose(): void {
    this.eventHandlers.clear();
  }

  raycast(_from: Vector3, _to: Vector3, _mask?: number): RaycastHit | null {
    return null;
  }

  sweepSphere(
    _center: Vector3,
    _radius: number,
    _dir: Vector3,
    _maxDist: number,
    _mask?: number,
  ): SweepHit | null {
    return null;
  }

  overlapAABB(_aabb: AABB, _mask?: number): EntityId[] {
    return [];
  }

  addBody(_entityId: EntityId, _props: BodyProps): void {}
  removeBody(_entityId: EntityId): void {}
  setBodyState(_entityId: EntityId, _state: Partial<BodyState>): void {}
  getBodyState(_entityId: EntityId): BodyState | null {
    return null;
  }

  applyImpulse(_entityId: EntityId, _impulse: Vector3): void {}
  applyForce(_entityId: EntityId, _force: Vector3): void {}

  on(event: 'collision' | 'sleep' | 'wake', handler: (e: PhysicsEvent) => void): Disposable {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);

    return {
      dispose: () => {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
          const index = handlers.indexOf(handler);
          if (index >= 0) {
            handlers.splice(index, 1);
          }
        }
      },
    };
  }
}
