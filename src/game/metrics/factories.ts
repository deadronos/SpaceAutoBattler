import type { AIMetrics, AIShotHistogram, ShipHull } from '../../types/index.js';
import {
  DEFAULT_VERTICAL_THRESHOLD,
  SHIP_HULLS,
  SHOT_DELTA_Y_BUCKETS,
  SHOT_DISTANCE_BUCKETS,
} from './constants.js';

export type InBandAccumulator = { samples: number; satisfied: number };
export type InBandSummary = { samples: number; satisfied: number; ratio: number | null };

/**
 * Creates a new histogram with specified buckets.
 *
 * @param {readonly number[]} buckets - The bucket boundaries.
 * @returns {AIShotHistogram} A new, empty histogram.
 */
export function createHistogram(buckets: readonly number[]): AIShotHistogram {
  return {
    buckets,
    counts: Array.from({ length: buckets.length + 1 }, () => 0),
    total: 0,
  };
}

/**
 * Creates a new accumulator for in-band statistics.
 *
 * @returns {InBandAccumulator} A new accumulator.
 */
export function createInBandAccumulator(): InBandAccumulator {
  return { samples: 0, satisfied: 0 };
}

/**
 * Creates a new summary object for in-band statistics.
 *
 * @returns {InBandSummary} A new summary.
 */
export function createInBandSummary(): InBandSummary {
  return { samples: 0, satisfied: 0, ratio: null };
}

/**
 * Creates a default, empty AIMetrics object.
 *
 * @returns {AIMetrics} The initialized metrics object.
 */
export function createDefaultMetrics(): AIMetrics {
  const shotDistanceHist = Object.create(null) as Record<ShipHull, AIShotHistogram>;
  const shotDeltaYHist = Object.create(null) as Record<ShipHull, AIShotHistogram>;
  const inBandByHull = Object.create(null) as Record<ShipHull, InBandAccumulator>;
  const inBandSummaryByHull = Object.create(null) as Record<ShipHull, InBandSummary>;

  for (const hull of SHIP_HULLS) {
    shotDistanceHist[hull] = createHistogram(SHOT_DISTANCE_BUCKETS);
    shotDeltaYHist[hull] = createHistogram(SHOT_DELTA_Y_BUCKETS);
    inBandByHull[hull] = createInBandAccumulator();
    inBandSummaryByHull[hull] = createInBandSummary();
  }

  return {
    totalDecisions: 0,
    totalSkipped: 0,
    budgetHits: 0,
    lastDecisions: 0,
    lastSkipped: 0,
    lastSliceSize: 0,
    lastTotalShips: 0,
    verticalSamples: 0,
    verticalAboveThreshold: 0,
    inBandSamples: 0,
    inBandSatisfied: 0,
    openingAggressiveIntents: 0,
    openingTotalIntents: 0,
    tieDecisions: 0,
    tieFallbacks: 0,
    decisionLatencyBuckets: [0, 0, 0, 0],
    focusFireSamples: 0,
    focusFireRatioSum: 0,
    focusFireRatioMax: 0,
    headingAmplitudeSamples: 0,
    headingAmplitudeSum: 0,
    headingAmplitudeMin: Number.POSITIVE_INFINITY,
    headingAmplitudeMax: Number.NEGATIVE_INFINITY,
    firstShotTimes: [],
    firstShotByShip: {},
    intentTimeline: [],
    inBandByHull,
    shotDistanceHist,
    shotDeltaYHist,
    shotVerticalThreshold: DEFAULT_VERTICAL_THRESHOLD,
    lastAggregationTick: -1,
    kpis: {
      firstShot: { samples: 0, p50: null, p90: null },
      openingAggression: { total: 0, aggressive: 0, ratio: null },
      inBand: {
        overall: { samples: 0, satisfied: 0, ratio: null },
        byHull: inBandSummaryByHull,
      },
      vertical: {
        samples: 0,
        aboveThreshold: 0,
        threshold: DEFAULT_VERTICAL_THRESHOLD,
        ratio: null,
      },
      decisionLatency: { buckets: [0, 0, 0, 0], total: 0 },
      focusFire: { samples: 0, ratioAvg: null, ratioMax: null },
      headingAmplitude: { samples: 0, avg: null, min: null, max: null },
      ties: { decisions: 0, fallbacks: 0, ratio: null },
    },
  };
}

/**
 * Adds a value to a histogram.
 *
 * @param {AIShotHistogram} hist - The histogram to update.
 * @param {number} value - The value to add.
 */
export function addToHistogram(hist: AIShotHistogram, value: number): void {
  hist.total += 1;
  const bucketCount = hist.buckets.length;
  let index = bucketCount;
  for (let i = 0; i < bucketCount; i += 1) {
    if (value < hist.buckets[i]) {
      index = i;
      break;
    }
  }
  hist.counts[index] += 1;
}

/**
 * Calculates a percentile value from a sorted array.
 *
 * @param {number[]} sortedValues - The sorted array of values.
 * @param {number} p - The percentile to calculate (0..1).
 * @returns {number} The value at the specified percentile.
 */
export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const clamped = Math.max(0, Math.min(1, p));
  const index = Math.floor((sortedValues.length - 1) * clamped);
  return sortedValues[index];
}
