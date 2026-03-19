import { describe, it, expect } from 'vite-plus/test';
import {
  computeSliceParameters,
  computeShipIndicesToProcess,
  advanceCursor,
  processSchedulerTick,
  updateSchedulerMetrics,
  type SchedulerState,
  type SchedulerConfig,
} from '../../src/game/systems/decision/scheduler.js';

describe('Scheduler', () => {
  describe('computeSliceParameters', () => {
    it('handles empty ship list', () => {
      const result = computeSliceParameters(0, 10);
      expect(result).toEqual({ slices: 1, sliceSize: 0 });
    });

    it('computes slices correctly when ships fit in budget', () => {
      const result = computeSliceParameters(5, 10);
      expect(result).toEqual({ slices: 1, sliceSize: 5 });
    });

    it('computes slices correctly when ships exceed budget', () => {
      const result = computeSliceParameters(15, 10);
      expect(result).toEqual({ slices: 2, sliceSize: 8 });
    });

    it('handles edge case with maxPerTick of 1', () => {
      const result = computeSliceParameters(5, 1);
      expect(result).toEqual({ slices: 5, sliceSize: 1 });
    });

    it('handles zero maxPerTick gracefully', () => {
      const result = computeSliceParameters(10, 0);
      expect(result).toEqual({ slices: 10, sliceSize: 0 });
    });
  });

  describe('computeShipIndicesToProcess', () => {
    it('returns empty array for zero ships', () => {
      const result = computeShipIndicesToProcess(0, 0, 5);
      expect(result).toEqual([]);
    });

    it('returns empty array for zero slice size', () => {
      const result = computeShipIndicesToProcess(10, 0, 0);
      expect(result).toEqual([]);
    });

    it('returns consecutive indices from start', () => {
      const result = computeShipIndicesToProcess(10, 0, 3);
      expect(result).toEqual([0, 1, 2]);
    });

    it('wraps around at end of ship list', () => {
      const result = computeShipIndicesToProcess(5, 3, 3);
      expect(result).toEqual([3, 4, 0]);
    });

    it('handles slice size larger than ship count', () => {
      const result = computeShipIndicesToProcess(3, 1, 5);
      expect(result).toEqual([1, 2, 0, 1, 2]);
    });
  });

  describe('advanceCursor', () => {
    it('advances cursor by slice size', () => {
      const result = advanceCursor(2, 3, 10);
      expect(result).toBe(5);
    });

    it('wraps cursor at end of ship list', () => {
      const result = advanceCursor(8, 3, 10);
      expect(result).toBe(1);
    });

    it('handles zero ships', () => {
      const result = advanceCursor(5, 3, 0);
      expect(result).toBe(0);
    });

    it('handles exact wraparound', () => {
      const result = advanceCursor(7, 3, 10);
      expect(result).toBe(0);
    });
  });

  describe('processSchedulerTick', () => {
    const mockConfig: SchedulerConfig = {
      tickInterval: 100,
      maxPerTick: 5,
    };

    it('does not tick when accumulator is below threshold', () => {
      const state: SchedulerState = {
        accumulator: 50,
        tickIndex: 10,
        cursor: 2,
      };

      const result = processSchedulerTick(30, state, mockConfig, 8);

      expect(result.tickOccurred).toBe(false);
      expect(result.updatedState.accumulator).toBe(80);
      expect(result.updatedState.tickIndex).toBe(10);
      expect(result.updatedState.cursor).toBe(2);
      expect(result.shipIndicesToProcess).toEqual([]);
      expect(result.metrics.ticksCaughtUp).toBe(0);
      expect(result.metrics.ticksDropped).toBe(0);
    });

    it('processes tick when accumulator reaches threshold', () => {
      const state: SchedulerState = {
        accumulator: 80,
        tickIndex: 10,
        cursor: 2,
      };

      const result = processSchedulerTick(30, state, mockConfig, 8);

      expect(result.tickOccurred).toBe(true);
      expect(result.updatedState.accumulator).toBe(10); // 80 + 30 - 100
      expect(result.updatedState.tickIndex).toBe(11);
      expect(result.shipIndicesToProcess).toEqual([2, 3, 4, 5]);
      expect(result.metrics.totalShips).toBe(8);
      expect(result.metrics.sliceSize).toBe(4);
      expect(result.metrics.budgetHit).toBe(true); // 4 < 8
      expect(result.metrics.ticksCaughtUp).toBe(1);
      expect(result.metrics.ticksDropped).toBe(0);
      // Cursor should advance by sliceSize (4) from starting position (2)
      expect(result.updatedState.cursor).toBe(6);
    });

    it('handles empty ship list', () => {
      const state: SchedulerState = {
        accumulator: 150,
        tickIndex: 5,
        cursor: 3,
      };

      const result = processSchedulerTick(50, state, mockConfig, 0);

      expect(result.tickOccurred).toBe(true);
      expect(result.updatedState.accumulator).toBe(0); // 150 + 50 - 200 (two ticks)
      expect(result.updatedState.tickIndex).toBe(7); // 5 + 2
      expect(result.updatedState.cursor).toBe(0);
      expect(result.shipIndicesToProcess).toEqual([]);
      expect(result.metrics.budgetHit).toBe(false);
      expect(result.metrics.ticksCaughtUp).toBe(2);
      expect(result.metrics.ticksDropped).toBe(0);
    });

    it('does not set budget hit when all ships fit in slice', () => {
      const state: SchedulerState = {
        accumulator: 90,
        tickIndex: 1,
        cursor: 0,
      };

      const result = processSchedulerTick(20, state, mockConfig, 3);

      expect(result.tickOccurred).toBe(true);
      expect(result.metrics.totalShips).toBe(3);
      expect(result.metrics.sliceSize).toBe(3);
      expect(result.metrics.budgetHit).toBe(false); // 3 >= 3
      expect(result.metrics.ticksCaughtUp).toBe(1);
      expect(result.metrics.ticksDropped).toBe(0);
    });

    it('catches up on backlog when accumulator has multiple ticks', () => {
      const state: SchedulerState = {
        accumulator: 150,
        tickIndex: 5,
        cursor: 0,
      };

      const result = processSchedulerTick(100, state, mockConfig, 8);

      expect(result.tickOccurred).toBe(true);
      expect(result.updatedState.accumulator).toBe(50); // 150 + 100 - 200 (two ticks)
      expect(result.updatedState.tickIndex).toBe(7); // 5 + 2
      expect(result.metrics.ticksCaughtUp).toBe(2);
      expect(result.metrics.ticksDropped).toBe(0);
      // Should process ships from multiple ticks
      expect(result.shipIndicesToProcess.length).toBeGreaterThan(0);
    });

    it('bounds catch-up to maxCatchUpTicks', () => {
      const state: SchedulerState = {
        accumulator: 0,
        tickIndex: 0,
        cursor: 0,
      };

      const result = processSchedulerTick(500, state, mockConfig, 8);

      expect(result.tickOccurred).toBe(true);
      expect(result.updatedState.tickIndex).toBe(3); // max 3 ticks caught up
      expect(result.metrics.ticksCaughtUp).toBe(3);
      expect(result.metrics.ticksDropped).toBe(2); // 500 / 100 = 5 ticks total, 3 caught up, 2 dropped
      expect(result.updatedState.accumulator).toBe(0); // All ticks consumed
    });

    it('catches up with custom maxCatchUpTicks', () => {
      const customConfig: SchedulerConfig = {
        tickInterval: 100,
        maxPerTick: 5,
        maxCatchUpTicks: 5,
      };

      const state: SchedulerState = {
        accumulator: 0,
        tickIndex: 0,
        cursor: 0,
      };

      const result = processSchedulerTick(500, state, customConfig, 8);

      expect(result.tickOccurred).toBe(true);
      expect(result.updatedState.tickIndex).toBe(5); // 5 ticks caught up
      expect(result.metrics.ticksCaughtUp).toBe(5);
      expect(result.metrics.ticksDropped).toBe(0);
      expect(result.updatedState.accumulator).toBe(0);
    });

    it('processes unique ships across multiple catch-up ticks', () => {
      const state: SchedulerState = {
        accumulator: 0,
        tickIndex: 0,
        cursor: 0,
      };

      const result = processSchedulerTick(200, state, mockConfig, 6);

      expect(result.tickOccurred).toBe(true);
      expect(result.metrics.ticksCaughtUp).toBe(2);
      // With 6 ships and maxPerTick=5, each tick processes 3 ships
      // Two ticks should process all 6 ships (no duplicates due to Set usage)
      expect(result.shipIndicesToProcess.length).toBeLessThanOrEqual(6);
      // Verify indices are sorted
      for (let i = 1; i < result.shipIndicesToProcess.length; i++) {
        expect(result.shipIndicesToProcess[i]).toBeGreaterThan(result.shipIndicesToProcess[i - 1]);
      }
    });

    it('advances cursor correctly during catch-up', () => {
      const state: SchedulerState = {
        accumulator: 0,
        tickIndex: 0,
        cursor: 0,
      };

      const result = processSchedulerTick(200, state, mockConfig, 8);

      expect(result.tickOccurred).toBe(true);
      expect(result.metrics.ticksCaughtUp).toBe(2);
      // With 8 ships and maxPerTick=5, each tick processes 4 ships
      // After 2 ticks starting at cursor 0, cursor should be at (0 + 4 + 4) % 8 = 0
      expect(result.updatedState.cursor).toBe(0);
    });
  });

  describe('updateSchedulerMetrics', () => {
    it('updates metrics correctly', () => {
      const metrics = {
        lastTotalShips: 0,
        lastSliceSize: 0,
        lastDecisions: 0,
        lastSkipped: 0,
        lastTicksCaughtUp: 0,
        lastTicksDropped: 0,
        totalDecisions: 100,
        totalSkipped: 20,
        totalTicksCaughtUp: 5,
        totalTicksDropped: 2,
        budgetHits: 5,
      } as any;

      const schedulerMetrics = {
        totalShips: 10,
        sliceSize: 6,
        decisions: 0, // Not used in this function
        skipped: 0, // Not used in this function
        budgetHit: true,
        ticksCaughtUp: 2,
        ticksDropped: 1,
      };

      updateSchedulerMetrics(metrics, schedulerMetrics, 4, 2);

      expect(metrics.lastTotalShips).toBe(10);
      expect(metrics.lastSliceSize).toBe(6);
      expect(metrics.lastDecisions).toBe(4);
      expect(metrics.lastSkipped).toBe(2);
      expect(metrics.lastTicksCaughtUp).toBe(2);
      expect(metrics.lastTicksDropped).toBe(1);
      expect(metrics.totalDecisions).toBe(104);
      expect(metrics.totalSkipped).toBe(22);
      expect(metrics.totalTicksCaughtUp).toBe(7);
      expect(metrics.totalTicksDropped).toBe(3);
      expect(metrics.budgetHits).toBe(6);
    });

    it('does not increment budget hits when no budget hit', () => {
      const metrics = {
        budgetHits: 3,
        totalTicksCaughtUp: 0,
        totalTicksDropped: 0,
      } as any;

      const schedulerMetrics = {
        budgetHit: false,
        ticksCaughtUp: 1,
        ticksDropped: 0,
      } as any;

      updateSchedulerMetrics(metrics, schedulerMetrics, 5, 1);

      expect(metrics.budgetHits).toBe(3);
      expect(metrics.totalTicksCaughtUp).toBe(1);
      expect(metrics.totalTicksDropped).toBe(0);
    });
  });
});
