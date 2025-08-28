import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Mock Worker for testing
class MockWorker {
  private messageHandler: ((e: any) => void) | null = null;
  private messages: any[] = [];

  addEventListener(type: string, handler: (e: any) => void) {
    if (type === 'message') {
      this.messageHandler = handler;
    }
  }

  postMessage(message: any) {
    this.messages.push(message);
    // Simulate worker processing
    setTimeout(() => this.processMessage(message), 0);
  }

  private processMessage(message: any) {
    if (!this.messageHandler) return;

    const { type, payload } = message;

    switch (type) {
      case 'init-physics':
        this.messageHandler({ data: { type: 'init-physics-done', ok: true } });
        break;
      case 'update-ships':
        this.messageHandler({ data: { type: 'update-ships-done' } });
        break;
      case 'step-physics':
        // Simulate physics step with some basic transforms
        const transforms = payload?.ships?.map((ship: any) => ({
          shipId: ship.id,
          pos: { x: ship.pos.x + 1, y: ship.pos.y + 1, z: ship.pos.z + 1 },
          vel: { x: ship.vel.x, y: ship.vel.y, z: ship.vel.z }
        })) || [];
        this.messageHandler({ data: { type: 'step-physics-done', transforms } });
        break;
    }
  }

  getMessages() {
    return this.messages;
  }
}

describe('Physics Worker Integration', () => {
  let mockWorker: MockWorker;
  let mockState: any;

  beforeEach(() => {
    mockWorker = new MockWorker();
    mockState = {
      ships: [
        { id: 1, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 } },
        { id: 2, pos: { x: 10, y: 10, z: 10 }, vel: { x: 1, y: 1, z: 1 } }
      ]
    };
  });

  describe('Worker Message Protocol', () => {
    it('should initialize physics worker', async () => {
      let initComplete = false;
      let workerReady = false;

      mockWorker.addEventListener('message', (ev) => {
        const { type, ok } = ev.data || {};
        if (type === 'init-physics-done') {
          workerReady = !!ok;
          initComplete = true;
        }
      });

      mockWorker.postMessage({ type: 'init-physics' });

      // Wait for async message processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(initComplete).toBe(true);
      expect(workerReady).toBe(true);
    });

    it('should handle ship updates', async () => {
      let updateComplete = false;

      mockWorker.addEventListener('message', (ev) => {
        const { type } = ev.data || {};
        if (type === 'update-ships-done') {
          updateComplete = true;
        }
      });

      mockWorker.postMessage({
        type: 'update-ships',
        payload: { ships: mockState.ships }
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(updateComplete).toBe(true);
    });

    it('should step physics and return transforms', async () => {
      let stepComplete = false;
      let receivedTransforms: any[] = [];

      mockWorker.addEventListener('message', (ev) => {
        const { type, transforms } = ev.data || {};
        if (type === 'step-physics-done') {
          stepComplete = true;
          receivedTransforms = transforms || [];
        }
      });

      mockWorker.postMessage({
        type: 'step-physics',
        payload: { dt: 0.016, ships: mockState.ships }
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(stepComplete).toBe(true);
      expect(receivedTransforms).toHaveLength(2);
      expect(receivedTransforms[0]).toHaveProperty('shipId', 1);
      expect(receivedTransforms[0]).toHaveProperty('pos');
      expect(receivedTransforms[0]).toHaveProperty('vel');
    });
  });

  describe('GameState Transform Updates', () => {
    it('should update ship positions from worker transforms', () => {
      const transforms = [
        { shipId: 1, pos: { x: 1, y: 1, z: 1 }, vel: { x: 0.1, y: 0.1, z: 0.1 } },
        { shipId: 2, pos: { x: 11, y: 11, z: 11 }, vel: { x: 1.1, y: 1.1, z: 1.1 } }
      ];

      // Simulate the message handler logic from main.ts
      for (const transform of transforms) {
        const ship = mockState.ships.find((s: any) => s.id === transform.shipId);
        if (ship) {
          ship.pos.x = transform.pos.x;
          ship.pos.y = transform.pos.y;
          ship.pos.z = transform.pos.z;
          ship.vel.x = transform.vel.x;
          ship.vel.y = transform.vel.y;
          ship.vel.z = transform.vel.z;
        }
      }

      expect(mockState.ships[0].pos.x).toBe(1);
      expect(mockState.ships[0].pos.y).toBe(1);
      expect(mockState.ships[0].pos.z).toBe(1);
      expect(mockState.ships[0].vel.x).toBe(0.1);

      expect(mockState.ships[1].pos.x).toBe(11);
      expect(mockState.ships[1].pos.y).toBe(11);
      expect(mockState.ships[1].pos.z).toBe(11);
      expect(mockState.ships[1].vel.x).toBe(1.1);
    });

    it('should handle missing ships gracefully', () => {
      const transforms = [
        { shipId: 1, pos: { x: 1, y: 1, z: 1 }, vel: { x: 0.1, y: 0.1, z: 0.1 } },
        { shipId: 999, pos: { x: 99, y: 99, z: 99 }, vel: { x: 9.9, y: 9.9, z: 9.9 } } // Non-existent ship
      ];

      const originalShipCount = mockState.ships.length;

      // Simulate the message handler logic
      for (const transform of transforms) {
        const ship = mockState.ships.find((s: any) => s.id === transform.shipId);
        if (ship) {
          ship.pos.x = transform.pos.x;
          ship.pos.y = transform.pos.y;
          ship.pos.z = transform.pos.z;
          ship.vel.x = transform.vel.x;
          ship.vel.y = transform.vel.y;
          ship.vel.z = transform.vel.z;
        }
      }

      // Should update existing ship but ignore non-existent one
      expect(mockState.ships[0].pos.x).toBe(1);
      expect(mockState.ships).toHaveLength(originalShipCount);
    });
  });

  describe('Physics Stepper Shim', () => {
    it('should send ship data to worker on step', async () => {
      let stepperReady = false;
      let stepper: any = null;

      // Simulate the physics stepper creation from main.ts
      mockWorker.addEventListener('message', (ev) => {
        const { type, ok } = ev.data || {};
        if (type === 'init-physics-done') {
          stepperReady = !!ok;
          stepper = {
            initDone: false,
            step(dt: number) {
              const shipData = mockState.ships.map((ship: any) => ({
                id: ship.id,
                pos: { ...ship.pos },
                vel: { ...ship.vel }
              }));

              mockWorker.postMessage({ type: 'update-ships', payload: { ships: shipData } });
              mockWorker.postMessage({ type: 'step-physics', payload: { dt } });
            },
            dispose() {
              mockWorker.postMessage({ type: 'dispose-physics' });
            },
          };

          setTimeout(() => {
            if (stepper) stepper.initDone = stepperReady;
          }, 200);
        }
      });

      mockWorker.postMessage({ type: 'init-physics' });

      await new Promise(resolve => setTimeout(resolve, 250));

      expect(stepperReady).toBe(true);
      expect(stepper).toBeTruthy();
      expect(stepper.initDone).toBe(true);

      // Test stepping
      stepper.step(0.016);

      const messages = mockWorker.getMessages();
      expect(messages).toContainEqual({
        type: 'update-ships',
        payload: { ships: expect.any(Array) }
      });
      expect(messages).toContainEqual({
        type: 'step-physics',
        payload: { dt: 0.016 }
      });
    });
  });
});