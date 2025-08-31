import { describe, it, expect, beforeEach } from 'vitest';
import { 
  PhysicsAdapter, 
  NoopPhysicsAdapter,
  BodyProps,
  BodyState,
  RaycastHit,
  SweepHit,
  AABB,
  PhysicsEvent
} from '../../src/core/adapters/physicsAdapter.js';

describe('PhysicsAdapter', () => {
  describe('NoopPhysicsAdapter', () => {
    let adapter: NoopPhysicsAdapter;

    beforeEach(() => {
      adapter = new NoopPhysicsAdapter();
    });

    it('should initialize correctly', () => {
      expect(adapter.initDone).toBe(true);
    });

    it('should track step information', () => {
      adapter.step(0.016);
      const info = adapter.getLastStepInfo();
      expect(info.dt).toBe(0.016);
      expect(info.iterations).toBe(1);
      expect(info.substeps).toBe(1);

      adapter.step(0.033, { iterations: 3, substeps: 2 });
      const info2 = adapter.getLastStepInfo();
      expect(info2.dt).toBe(0.033);
      expect(info2.iterations).toBe(3);
      expect(info2.substeps).toBe(2);
    });

    it('should return null for queries', () => {
      const from = { x: 0, y: 0, z: 0 };
      const to = { x: 10, y: 0, z: 0 };
      const hit = adapter.raycast(from, to);
      expect(hit).toBeNull();

      const sweepHit = adapter.sweepSphere(from, 1, { x: 1, y: 0, z: 0 }, 10);
      expect(sweepHit).toBeNull();

      const aabb = { min: { x: -5, y: -5, z: -5 }, max: { x: 5, y: 5, z: 5 } };
      const entities = adapter.overlapAABB(aabb);
      expect(entities).toEqual([]);
    });

    it('should handle body management silently', () => {
      const bodyProps: BodyProps = {
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 1, y: 0, z: 0 },
        mass: 1.0,
        radius: 2.0
      };

      // These should not throw
      adapter.addBody(1, bodyProps);
      adapter.setBodyState(1, { position: { x: 5, y: 0, z: 0 } });
      expect(adapter.getBodyState(1)).toBeNull();
      adapter.removeBody(1);
    });

    it('should handle forces silently', () => {
      const force = { x: 100, y: 0, z: 0 };
      const impulse = { x: 50, y: 0, z: 0 };

      // These should not throw
      adapter.applyForce(1, force);
      adapter.applyImpulse(1, impulse);
    });

    it('should support event subscriptions', () => {
      let eventReceived = false;
      const handler = (event: PhysicsEvent) => {
        eventReceived = true;
      };

      const subscription = adapter.on('collision', handler);
      expect(subscription).toBeDefined();
      expect(typeof subscription.dispose).toBe('function');

      // Clean up
      subscription.dispose();
    });

    it('should dispose cleanly', () => {
      let disposed = false;
      const handler = () => { disposed = true; };
      
      const sub1 = adapter.on('collision', handler);
      const sub2 = adapter.on('sleep', handler);

      adapter.dispose();

      // Disposing the adapter should not crash
      expect(() => sub1.dispose()).not.toThrow();
      expect(() => sub2.dispose()).not.toThrow();
    });
  });

  describe('Interface compliance', () => {
    it('should implement all required methods', () => {
      const adapter = new NoopPhysicsAdapter();

      const requiredMethods = [
        'step', 'getLastStepInfo', 'dispose',
        'raycast', 'sweepSphere', 'overlapAABB',
        'addBody', 'removeBody', 'setBodyState', 'getBodyState',
        'applyImpulse', 'applyForce', 'on'
      ];

      for (const method of requiredMethods) {
        expect(typeof (adapter as any)[method]).toBe('function');
      }

      expect(typeof adapter.initDone).toBe('boolean');
    });

    it('should have correct type structure for BodyProps', () => {
      const bodyProps: BodyProps = {
        position: { x: 1, y: 2, z: 3 },
        velocity: { x: 0, y: 0, z: 0 },
        mass: 10,
        radius: 5,
        isStatic: false,
        collisionMask: 0xFF
      };

      expect(bodyProps.position).toBeDefined();
      expect(bodyProps.velocity).toBeDefined();
      expect(bodyProps.mass).toBe(10);
      expect(bodyProps.radius).toBe(5);
      expect(bodyProps.isStatic).toBe(false);
      expect(bodyProps.collisionMask).toBe(0xFF);
    });

    it('should have correct type structure for BodyState', () => {
      const bodyState: BodyState = {
        position: { x: 1, y: 2, z: 3 },
        velocity: { x: 4, y: 5, z: 6 },
        mass: 10,
        radius: 5
      };

      expect(bodyState.position).toBeDefined();
      expect(bodyState.velocity).toBeDefined();
      expect(bodyState.mass).toBe(10);
      expect(bodyState.radius).toBe(5);
    });

    it('should have correct type structure for RaycastHit', () => {
      const hit: RaycastHit = {
        entityId: 42,
        point: { x: 1, y: 2, z: 3 },
        normal: { x: 0, y: 1, z: 0 },
        distance: 10.5
      };

      expect(hit.entityId).toBe(42);
      expect(hit.point).toBeDefined();
      expect(hit.normal).toBeDefined();
      expect(hit.distance).toBe(10.5);
    });

    it('should have correct type structure for SweepHit', () => {
      const hit: SweepHit = {
        entityId: 42,
        point: { x: 1, y: 2, z: 3 },
        normal: { x: 0, y: 1, z: 0 },
        distance: 10.5,
        time: 0.7
      };

      expect(hit.entityId).toBe(42);
      expect(hit.point).toBeDefined();
      expect(hit.normal).toBeDefined();
      expect(hit.distance).toBe(10.5);
      expect(hit.time).toBe(0.7);
    });

    it('should have correct type structure for AABB', () => {
      const aabb: AABB = {
        min: { x: -10, y: -5, z: -2 },
        max: { x: 10, y: 5, z: 2 }
      };

      expect(aabb.min).toBeDefined();
      expect(aabb.max).toBeDefined();
    });

    it('should have correct type structure for PhysicsEvent', () => {
      const event: PhysicsEvent = {
        type: 'collision',
        entityIds: [1, 2],
        point: { x: 0, y: 0, z: 0 },
        normal: { x: 0, y: 1, z: 0 },
        impulse: 50.0
      };

      expect(event.type).toBe('collision');
      expect(event.entityIds).toEqual([1, 2]);
      expect(event.point).toBeDefined();
      expect(event.normal).toBeDefined();
      expect(event.impulse).toBe(50.0);
    });
  });

  describe('Event system', () => {
    let adapter: NoopPhysicsAdapter;

    beforeEach(() => {
      adapter = new NoopPhysicsAdapter();
    });

    it('should manage event subscriptions correctly', () => {
      const events: PhysicsEvent[] = [];
      
      const sub1 = adapter.on('collision', (e) => events.push(e));
      const sub2 = adapter.on('collision', (e) => events.push(e));

      expect(events).toHaveLength(0);

      // Dispose first subscription
      sub1.dispose();
      
      // Dispose second subscription
      sub2.dispose();
      
      // Should not crash
      expect(() => sub1.dispose()).not.toThrow();
    });

    it('should handle multiple event types', () => {
      const collisionEvents: PhysicsEvent[] = [];
      const sleepEvents: PhysicsEvent[] = [];

      adapter.on('collision', (e) => collisionEvents.push(e));
      adapter.on('sleep', (e) => sleepEvents.push(e));

      // Events are not actively triggered in noop adapter, but subscriptions should work
      expect(collisionEvents).toHaveLength(0);
      expect(sleepEvents).toHaveLength(0);
    });
  });
});