import { describe, it, expect, beforeEach } from 'vitest';
import { 
  TimeAdapter, 
  RealTimeAdapter, 
  MockTimeAdapter 
} from '../../src/core/adapters/timeAdapter.js';

describe('TimeAdapter', () => {
  describe('MockTimeAdapter', () => {
    let timeAdapter: MockTimeAdapter;

    beforeEach(() => {
      timeAdapter = new MockTimeAdapter(0);
    });

    it('should initialize with correct default values', () => {
      const state = timeAdapter.getState();
      expect(state.time).toBe(0);
      expect(state.paused).toBe(false);
      expect(state.scale).toBe(1.0);
    });

    it('should advance time with step()', () => {
      timeAdapter.step(1000); // 1 second in milliseconds
      expect(timeAdapter.now()).toBe(1000);
      
      timeAdapter.step(500); // 0.5 seconds
      expect(timeAdapter.now()).toBe(1500);
    });

    it('should calculate correct delta time', () => {
      timeAdapter.step(1000);
      const dt1 = timeAdapter.delta(); // Should be 1.0 seconds
      expect(dt1).toBe(1.0);

      timeAdapter.step(500);
      const dt2 = timeAdapter.delta(); // Should be 0.5 seconds
      expect(dt2).toBe(0.5);
    });

    it('should respect time scaling', () => {
      timeAdapter.scale(2.0);
      timeAdapter.step(1000);
      expect(timeAdapter.now()).toBe(2000); // 2x speed

      timeAdapter.scale(0.5);
      timeAdapter.step(1000);
      expect(timeAdapter.now()).toBe(2500); // 0.5x speed from 2000
    });

    it('should pause and resume correctly', () => {
      timeAdapter.step(1000);
      expect(timeAdapter.now()).toBe(1000);

      timeAdapter.pause();
      timeAdapter.step(1000);
      expect(timeAdapter.now()).toBe(1000); // Should not advance when paused

      timeAdapter.resume();
      timeAdapter.step(1000);
      expect(timeAdapter.now()).toBe(2000); // Should advance again
    });

    it('should reset to initial state', () => {
      timeAdapter.step(5000);
      timeAdapter.scale(3.0);
      timeAdapter.pause();

      timeAdapter.reset();

      const state = timeAdapter.getState();
      expect(state.time).toBe(0);
      expect(state.paused).toBe(false);
      expect(state.scale).toBe(1.0);
    });

    it('should handle manual time setting', () => {
      timeAdapter.setTime(42000);
      expect(timeAdapter.now()).toBe(42000);
    });

    it('should throw error for negative time scale', () => {
      expect(() => timeAdapter.scale(-1)).toThrow('Time scale must be non-negative');
    });
  });

  describe('RealTimeAdapter', () => {
    let timeAdapter: RealTimeAdapter;

    beforeEach(() => {
      timeAdapter = new RealTimeAdapter();
    });

    it('should initialize with reasonable values', () => {
      const state = timeAdapter.getState();
      expect(state.time).toBeGreaterThanOrEqual(0);
      expect(state.paused).toBe(false);
      expect(state.scale).toBe(1.0);
    });

    it('should advance time automatically', async () => {
      const time1 = timeAdapter.now();
      
      // Wait a small amount
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const time2 = timeAdapter.now();
      expect(time2).toBeGreaterThan(time1);
    });

    it('should respect scaling', async () => {
      timeAdapter.scale(2.0);
      const time1 = timeAdapter.now();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const time2 = timeAdapter.now();
      const elapsed = time2 - time1;
      
      // With 2x scaling, elapsed time should be roughly 2x real time
      // We can't be too precise due to timing variations
      expect(elapsed).toBeGreaterThan(15); // Should be at least 1.5x the real wait
    });

    it('should pause correctly', async () => {
      const time1 = timeAdapter.now();
      timeAdapter.pause();
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const time2 = timeAdapter.now();
      // For real time adapter, paused time should be very close to the initial time
      expect(Math.abs(time2 - time1)).toBeLessThan(5); // Allow small tolerance
    });

    it('should throw error for negative time scale', () => {
      expect(() => timeAdapter.scale(-1)).toThrow('Time scale must be non-negative');
    });
  });

  describe('Interface compliance', () => {
    it('should implement all required methods', () => {
      const mockAdapter = new MockTimeAdapter();
      const realAdapter = new RealTimeAdapter();

      // Check that both implementations have all required methods
      const requiredMethods = ['now', 'delta', 'scale', 'pause', 'resume', 'getState', 'step', 'reset'];
      
      for (const method of requiredMethods) {
        expect(typeof (mockAdapter as any)[method]).toBe('function');
        expect(typeof (realAdapter as any)[method]).toBe('function');
      }
    });

    it('should maintain consistent state structure', () => {
      const mockAdapter = new MockTimeAdapter();
      const realAdapter = new RealTimeAdapter();

      const mockState = mockAdapter.getState();
      const realState = realAdapter.getState();

      expect(mockState).toHaveProperty('time');
      expect(mockState).toHaveProperty('paused');
      expect(mockState).toHaveProperty('scale');
      expect(mockState).toHaveProperty('lastFrameTime');

      expect(realState).toHaveProperty('time');
      expect(realState).toHaveProperty('paused');
      expect(realState).toHaveProperty('scale');
      expect(realState).toHaveProperty('lastFrameTime');
    });
  });
});