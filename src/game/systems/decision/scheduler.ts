import type { AIMetrics } from '../../../types/index.js';

export interface SchedulerState {
  accumulator: number;
  tickIndex: number;
  cursor: number;
}

export interface SchedulerConfig {
  tickInterval: number;
  maxPerTick: number;
}

export interface SchedulerTickResult {
  tickOccurred: boolean;
  updatedState: SchedulerState;
  shipIndicesToProcess: number[];
  metrics: {
    totalShips: number;
    sliceSize: number;
    decisions: number;
    skipped: number;
    budgetHit: boolean;
  };
}

export function computeSliceParameters(totalShips: number, maxPerTick: number): {
  slices: number;
  sliceSize: number;
} {
  if (totalShips === 0) {
    return { slices: 1, sliceSize: 0 };
  }
  const slices = Math.max(1, Math.ceil(totalShips / Math.max(1, maxPerTick)));
  const sliceSize = Math.min(maxPerTick, Math.ceil(totalShips / slices));
  return { slices, sliceSize };
}

export function computeShipIndicesToProcess(
  totalShips: number,
  cursor: number,
  sliceSize: number,
): number[] {
  if (totalShips === 0 || sliceSize === 0) {
    return [];
  }
  
  const indices: number[] = [];
  const startIndex = cursor % totalShips;
  
  for (let i = 0; i < sliceSize; i += 1) {
    const idx = (startIndex + i) % totalShips;
    indices.push(idx);
  }
  
  return indices;
}

export function advanceCursor(
  currentCursor: number,
  sliceSize: number,
  totalShips: number,
): number {
  if (totalShips === 0) return 0;
  return (currentCursor + sliceSize) % totalShips;
}

export function processSchedulerTick(
  delta: number,
  state: SchedulerState,
  config: SchedulerConfig,
  totalShips: number,
): SchedulerTickResult {
  const updatedState = { ...state };
  updatedState.accumulator += delta;

  // Check if a tick should occur
  if (updatedState.accumulator < config.tickInterval) {
    return {
      tickOccurred: false,
      updatedState,
      shipIndicesToProcess: [],
      metrics: {
        totalShips: 0,
        sliceSize: 0,
        decisions: 0,
        skipped: 0,
        budgetHit: false,
      },
    };
  }

  // Process the tick
  updatedState.accumulator -= config.tickInterval;
  updatedState.tickIndex += 1;

  // Handle empty ship list
  if (totalShips === 0) {
    updatedState.cursor = 0;
    return {
      tickOccurred: true,
      updatedState,
      shipIndicesToProcess: [],
      metrics: {
        totalShips: 0,
        sliceSize: 0,
        decisions: 0,
        skipped: 0,
        budgetHit: false,
      },
    };
  }

  // Compute slice parameters
  const { slices, sliceSize } = computeSliceParameters(totalShips, config.maxPerTick);
  const shipIndicesToProcess = computeShipIndicesToProcess(totalShips, updatedState.cursor, sliceSize);
  updatedState.cursor = advanceCursor(updatedState.cursor, sliceSize, totalShips);

  const budgetHit = slices > 1;

  return {
    tickOccurred: true,
    updatedState,
    shipIndicesToProcess,
    metrics: {
      totalShips,
      sliceSize,
      decisions: 0, // Will be filled in by the evaluation process
      skipped: 0,   // Will be filled in by the evaluation process
      budgetHit,
    },
  };
}

export function updateSchedulerMetrics(
  metrics: AIMetrics,
  schedulerMetrics: SchedulerTickResult['metrics'],
  decisions: number,
  skipped: number
): void {
  metrics.lastTotalShips = schedulerMetrics.totalShips;
  metrics.lastSliceSize = schedulerMetrics.sliceSize;
  metrics.lastDecisions = decisions;
  metrics.lastSkipped = skipped;
  metrics.totalDecisions += decisions;
  metrics.totalSkipped += skipped;
  
  if (schedulerMetrics.budgetHit) {
    metrics.budgetHits += 1;
  }
}