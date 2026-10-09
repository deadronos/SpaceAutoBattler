import type { AIIntent } from './state.js';

/**
 * Snapshot of AI intents at a specific time for metrics/debugging.
 */
export interface AIIntentSnapshot {
  /** Game tick of the snapshot. */
  tick: number;
  /** Game time of the snapshot. */
  time: number;
  /** Counts of ships in each intent state. */
  counts: Partial<Record<AIIntent, number>>;
  /** Total number of ships tracked. */
  total: number;
}

/**
 * Histogram data for shot statistics.
 */
export interface AIShotHistogram {
  /** Bucket boundaries. */
  buckets: readonly number[];
  /** Counts per bucket. */
  counts: number[];
  /** Total number of shots recorded. */
  total: number;
}

/**
 * Statistics for range-keeping behavior.
 */
export interface AIInBandStats {
  /** Total number of samples. */
  samples: number;
  /** Number of samples within desired range. */
  satisfied: number;
}
