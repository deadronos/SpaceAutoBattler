import type { AIIntent, AIMetrics, ShipHull } from '../../types/index.js';
import { MAX_INTENT_TIMELINE_ENTRIES } from './constants.js';
import { addToHistogram } from './factories.js';

export function recordIntentMetrics(
  metrics: AIMetrics,
  tick: number,
  time: number,
  intent: AIIntent,
  isOpeningWindow: boolean,
): void {
  if (!metrics.intentTimeline) metrics.intentTimeline = [];
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
