import type { AIMetrics } from '../../../types/index.js';

export interface SchedulerState {
  accumulator: number;
  tickIndex: number;
  cursor: number;
}

export interface SchedulerConfig {
  tickInterval: number;
  maxPerTick: number;
  maxCatchUpTicks?: number;
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
    ticksCaughtUp: number;
    ticksDropped: number;
  };
}

export function computeSliceParameters(
  totalShips: number,
  maxPerTick: number,
): {
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

/**
 * Processes a tick of the AI scheduler.
 * Determines how many and which ships should think this frame.
 * Implements bounded catch-up: if accumulator has backlog, process multiple ticks
 * up to maxCatchUpTicks to avoid frame-time dependent behavior.
 *
 * @param {number} delta - The time delta.
 * @param {SchedulerState} state - The current scheduler state.
 * @param {SchedulerConfig} config - The scheduler configuration.
 * @param {number} totalShips - Total number of active ships.
 * @returns {SchedulerTickResult} The result including ship indices to process.
 */
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
        ticksCaughtUp: 0,
        ticksDropped: 0,
      },
    };
  }

  // Bounded catch-up: process multiple ticks if backlog exists
  const maxCatchUpTicks = config.maxCatchUpTicks ?? 3;
  let ticksCaughtUp = 0;
  let ticksDropped = 0;
  const allShipIndices = new Set<number>();

  // Process ticks while we have backlog and haven't hit max iterations
  while (updatedState.accumulator >= config.tickInterval && ticksCaughtUp < maxCatchUpTicks) {
    updatedState.accumulator -= config.tickInterval;
    updatedState.tickIndex += 1;
    ticksCaughtUp += 1;

    // Handle empty ship list
    if (totalShips === 0) {
      updatedState.cursor = 0;
      continue;
    }

    // Compute slice parameters for this tick
    const { slices, sliceSize } = computeSliceParameters(totalShips, config.maxPerTick);
    const shipIndices = computeShipIndicesToProcess(
      totalShips,
      updatedState.cursor,
      sliceSize,
    );

    // Collect all ship indices (use Set to avoid duplicates)
    for (const idx of shipIndices) {
      allShipIndices.add(idx);
    }

    updatedState.cursor = advanceCursor(updatedState.cursor, sliceSize, totalShips);
  }

  // If still have backlog after max iterations, count dropped ticks
  while (updatedState.accumulator >= config.tickInterval) {
    updatedState.accumulator -= config.tickInterval;
    ticksDropped += 1;
  }

  // Handle empty ship list case (fallback if no ships were processed during catch-up)
  if (totalShips === 0) {
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
        ticksCaughtUp,
        ticksDropped,
      },
    };
  }

  // Convert set to array for ship indices to process
  const shipIndicesToProcess = Array.from(allShipIndices).sort((a, b) => a - b);

  // Compute final slice parameters for metrics
  const { slices, sliceSize } = computeSliceParameters(totalShips, config.maxPerTick);
  const budgetHit = slices > 1;

  return {
    tickOccurred: true,
    updatedState,
    shipIndicesToProcess,
    metrics: {
      totalShips,
      sliceSize,
      decisions: 0, // Will be filled in by the evaluation process
      skipped: 0, // Will be filled in by the evaluation process
      budgetHit,
      ticksCaughtUp,
      ticksDropped,
    },
  };
}

/**
 * Updates metrics based on scheduler results.
 *
 * @param {AIMetrics} metrics - The metrics object to update.
 * @param {SchedulerTickResult['metrics']} schedulerMetrics - Metrics from the scheduler tick.
 * @param {number} decisions - Number of decisions made.
 * @param {number} skipped - Number of ships skipped.
 */
export function updateSchedulerMetrics(
  metrics: AIMetrics,
  schedulerMetrics: SchedulerTickResult['metrics'],
  decisions: number,
  skipped: number,
): void {
  metrics.lastTotalShips = schedulerMetrics.totalShips;
  metrics.lastSliceSize = schedulerMetrics.sliceSize;
  metrics.lastDecisions = decisions;
  metrics.lastSkipped = skipped;
  metrics.lastTicksCaughtUp = schedulerMetrics.ticksCaughtUp;
  metrics.lastTicksDropped = schedulerMetrics.ticksDropped;
  metrics.totalDecisions += decisions;
  metrics.totalSkipped += skipped;
  metrics.totalTicksCaughtUp += schedulerMetrics.ticksCaughtUp;
  metrics.totalTicksDropped += schedulerMetrics.ticksDropped;

  if (schedulerMetrics.budgetHit) {
    metrics.budgetHits += 1;
  }
}
