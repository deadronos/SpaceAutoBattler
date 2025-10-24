import { describe, it, expect } from 'vitest';
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
      expect(result.updatedState.cursor).toBe(6); // (2 + 4) % 8
      expect(result.shipIndicesToProcess).toEqual([2, 3, 4, 5]);
      expect(result.metrics.totalShips).toBe(8);
      expect(result.metrics.sliceSize).toBe(4);
      expect(result.metrics.budgetHit).toBe(true); // 4 < 8
    });

    it('handles empty ship list', () => {
      const state: SchedulerState = {
        accumulator: 150,
        tickIndex: 5,
        cursor: 3,
      };

      const result = processSchedulerTick(50, state, mockConfig, 0);

      expect(result.tickOccurred).toBe(true);
      expect(result.updatedState.accumulator).toBe(100); // 150 + 50 - 100
      expect(result.updatedState.tickIndex).toBe(6);
      expect(result.updatedState.cursor).toBe(0);
      expect(result.shipIndicesToProcess).toEqual([]);
      expect(result.metrics.budgetHit).toBe(false);
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
    });
  });

  describe('updateSchedulerMetrics', () => {
    it('updates metrics correctly', () => {
      const metrics = {
        lastTotalShips: 0,
        lastSliceSize: 0,
        lastDecisions: 0,
        lastSkipped: 0,
        totalDecisions: 100,
        totalSkipped: 20,
        budgetHits: 5,
      } as any;

      const schedulerMetrics = {
        totalShips: 10,
        sliceSize: 6,
        decisions: 0, // Not used in this function
        skipped: 0, // Not used in this function
        budgetHit: true,
      };

      updateSchedulerMetrics(metrics, schedulerMetrics, 4, 2);

      expect(metrics.lastTotalShips).toBe(10);
      expect(metrics.lastSliceSize).toBe(6);
      expect(metrics.lastDecisions).toBe(4);
      expect(metrics.lastSkipped).toBe(2);
      expect(metrics.totalDecisions).toBe(104);
      expect(metrics.totalSkipped).toBe(22);
      expect(metrics.budgetHits).toBe(6);
    });

    it('does not increment budget hits when no budget hit', () => {
      const metrics = {
        budgetHits: 3,
      } as any;

      const schedulerMetrics = {
        budgetHit: false,
      } as any;

      updateSchedulerMetrics(metrics, schedulerMetrics, 5, 1);

      expect(metrics.budgetHits).toBe(3);
    });
  });
});
