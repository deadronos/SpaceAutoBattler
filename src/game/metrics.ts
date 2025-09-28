import type { AIIntent, AIMetrics, AIShotHistogram, ShipHull } from '../types/index.js';

export const SHIP_HULLS: readonly ShipHull[] = [
  'fighter',
  'corvette',
  'frigate',
  'destroyer',
  'carrier',
];

export const SHOT_DISTANCE_BUCKETS = [150, 300, 450, 600] as const;
export const SHOT_DELTA_Y_BUCKETS = [50, 100, 150, 200, 300] as const;
const MAX_INTENT_TIMELINE_ENTRIES = 512;
export const DEFAULT_VERTICAL_THRESHOLD = 100;

type InBandAccumulator = { samples: number; satisfied: number };
type InBandSummary = { samples: number; satisfied: number; ratio: number | null };

function createHistogram(buckets: readonly number[]): AIShotHistogram {
  return {
    buckets,
    counts: Array.from({ length: buckets.length + 1 }, () => 0),
    total: 0,
  };
}

function createInBandAccumulator(): InBandAccumulator {
  return { samples: 0, satisfied: 0 };
}

function createInBandSummary(): InBandSummary {
  return { samples: 0, satisfied: 0, ratio: null };
}

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
    },
  };
}

export function resetMetrics(metrics: AIMetrics): void {
  metrics.totalDecisions = 0;
  metrics.totalSkipped = 0;
  metrics.budgetHits = 0;
  metrics.lastDecisions = 0;
  metrics.lastSkipped = 0;
  metrics.lastSliceSize = 0;
  metrics.lastTotalShips = 0;
  metrics.verticalSamples = 0;
  metrics.verticalAboveThreshold = 0;
  metrics.inBandSamples = 0;
  metrics.inBandSatisfied = 0;
  metrics.openingAggressiveIntents = 0;
  metrics.openingTotalIntents = 0;
  metrics.tieDecisions = 0;
  metrics.tieFallbacks = 0;
  metrics.firstShotTimes.length = 0;
  metrics.firstShotByShip = {};
  metrics.intentTimeline.length = 0;

  for (const hull of SHIP_HULLS) {
    const distanceHist = metrics.shotDistanceHist[hull];
    distanceHist.total = 0;
    distanceHist.counts.fill(0);

    const deltaHist = metrics.shotDeltaYHist[hull];
    deltaHist.total = 0;
    deltaHist.counts.fill(0);

    const inBand = metrics.inBandByHull[hull];
    inBand.samples = 0;
    inBand.satisfied = 0;

    const summary = metrics.kpis.inBand.byHull[hull];
    summary.samples = 0;
    summary.satisfied = 0;
    summary.ratio = null;
  }

  metrics.kpis.firstShot.samples = 0;
  metrics.kpis.firstShot.p50 = null;
  metrics.kpis.firstShot.p90 = null;
  metrics.kpis.openingAggression.total = 0;
  metrics.kpis.openingAggression.aggressive = 0;
  metrics.kpis.openingAggression.ratio = null;
  metrics.kpis.inBand.overall.samples = 0;
  metrics.kpis.inBand.overall.satisfied = 0;
  metrics.kpis.inBand.overall.ratio = null;
  metrics.kpis.vertical.samples = 0;
  metrics.kpis.vertical.aboveThreshold = 0;
  metrics.kpis.vertical.ratio = null;
  metrics.kpis.vertical.threshold = metrics.shotVerticalThreshold;
  metrics.lastAggregationTick = -1;
}

export function recordIntentMetrics(
  metrics: AIMetrics,
  tick: number,
  time: number,
  intent: AIIntent,
  isOpeningWindow: boolean,
): void {
  let snapshot = metrics.intentTimeline.at(-1) ?? null;
  if (!snapshot || snapshot.tick !== tick) {
    snapshot = { tick, time, counts: {}, total: 0 };
    metrics.intentTimeline.push(snapshot);
    if (metrics.intentTimeline.length > MAX_INTENT_TIMELINE_ENTRIES) {
      metrics.intentTimeline.shift();
    }
  }

  snapshot.total += 1;
  snapshot.counts[intent] = (snapshot.counts[intent] ?? 0) + 1;

  metrics.openingTotalIntents += 1;
  if (isOpeningWindow && (intent === 'Attack' || intent === 'Intercept')) {
    metrics.openingAggressiveIntents += 1;
  }
}

export function recordBandSample(metrics: AIMetrics, hull: ShipHull, satisfied: boolean): void {
  metrics.inBandSamples += 1;
  if (satisfied) metrics.inBandSatisfied += 1;

  const perHull = metrics.inBandByHull[hull];
  perHull.samples += 1;
  if (satisfied) perHull.satisfied += 1;
}

export function recordShotMetrics(
  metrics: AIMetrics,
  params: {
    shipId: number;
    hull: ShipHull;
    time: number;
    distance?: number;
    deltaY?: number;
  },
): void {
  if (!(params.shipId in metrics.firstShotByShip)) {
    metrics.firstShotByShip[params.shipId] = params.time;
    metrics.firstShotTimes.push(params.time);
  }

  if (typeof params.distance === 'number' && !Number.isNaN(params.distance)) {
    addToHistogram(metrics.shotDistanceHist[params.hull], params.distance);
  }

  if (typeof params.deltaY === 'number' && !Number.isNaN(params.deltaY)) {
    const absDeltaY = Math.abs(params.deltaY);
    addToHistogram(metrics.shotDeltaYHist[params.hull], absDeltaY);
    metrics.verticalSamples += 1;
    if (absDeltaY >= metrics.shotVerticalThreshold) {
      metrics.verticalAboveThreshold += 1;
    }
  }
}

export function aggregateKpis(metrics: AIMetrics, tick: number): void {
  if (metrics.firstShotTimes.length > 0) {
    const sorted = [...metrics.firstShotTimes].sort((a, b) => a - b);
    metrics.kpis.firstShot.samples = sorted.length;
    metrics.kpis.firstShot.p50 = percentile(sorted, 0.5);
    metrics.kpis.firstShot.p90 = percentile(sorted, 0.9);
  } else {
    metrics.kpis.firstShot.samples = 0;
    metrics.kpis.firstShot.p50 = null;
    metrics.kpis.firstShot.p90 = null;
  }

  metrics.kpis.openingAggression.total = metrics.openingTotalIntents;
  metrics.kpis.openingAggression.aggressive = metrics.openingAggressiveIntents;
  metrics.kpis.openingAggression.ratio =
    metrics.openingTotalIntents > 0
      ? metrics.openingAggressiveIntents / metrics.openingTotalIntents
      : null;

  metrics.kpis.inBand.overall.samples = metrics.inBandSamples;
  metrics.kpis.inBand.overall.satisfied = metrics.inBandSatisfied;
  metrics.kpis.inBand.overall.ratio =
    metrics.inBandSamples > 0 ? metrics.inBandSatisfied / metrics.inBandSamples : null;

  for (const hull of SHIP_HULLS) {
    const stats = metrics.inBandByHull[hull];
    const summary = metrics.kpis.inBand.byHull[hull];
    summary.samples = stats.samples;
    summary.satisfied = stats.satisfied;
    summary.ratio = stats.samples > 0 ? stats.satisfied / stats.samples : null;
  }

  metrics.kpis.vertical.samples = metrics.verticalSamples;
  metrics.kpis.vertical.aboveThreshold = metrics.verticalAboveThreshold;
  metrics.kpis.vertical.threshold = metrics.shotVerticalThreshold;
  metrics.kpis.vertical.ratio =
    metrics.verticalSamples > 0 ? metrics.verticalAboveThreshold / metrics.verticalSamples : null;

  metrics.lastAggregationTick = tick;
}

function addToHistogram(hist: AIShotHistogram, value: number): void {
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

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const clamped = Math.max(0, Math.min(1, p));
  const index = Math.floor((sortedValues.length - 1) * clamped);
  return sortedValues[index];
}
