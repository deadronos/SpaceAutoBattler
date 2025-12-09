import type { AIMetrics, ShipHull } from '../../types/index.js';
import { SHIP_HULLS } from './constants.js';
import { percentile } from './factories.js';

/**
 * Aggregates raw metrics into Key Performance Indicators (KPIs).
 * Should be called periodically or at the end of a session.
 *
 * @param {AIMetrics} metrics - The metrics object to aggregate.
 * @param {number} tick - The current game tick.
 */
export function aggregateKpis(metrics: AIMetrics, tick: number): void {
  if (!metrics.firstShotTimes) metrics.firstShotTimes = [];
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

  for (const hull of SHIP_HULLS as readonly ShipHull[]) {
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

  const latencyBuckets = metrics.decisionLatencyBuckets;
  const latencyTotal =
    latencyBuckets[0] + latencyBuckets[1] + latencyBuckets[2] + latencyBuckets[3];
  metrics.kpis.decisionLatency.buckets = [
    latencyBuckets[0],
    latencyBuckets[1],
    latencyBuckets[2],
    latencyBuckets[3],
  ];
  metrics.kpis.decisionLatency.total = latencyTotal;

  metrics.kpis.focusFire.samples = metrics.focusFireSamples;
  if (metrics.focusFireSamples > 0) {
    const avg = metrics.focusFireRatioSum / metrics.focusFireSamples;
    metrics.kpis.focusFire.ratioAvg = Math.min(1, Math.max(0, avg));
    metrics.kpis.focusFire.ratioMax = Math.min(1, Math.max(0, metrics.focusFireRatioMax));
  } else {
    metrics.kpis.focusFire.ratioAvg = null;
    metrics.kpis.focusFire.ratioMax = null;
  }

  metrics.kpis.headingAmplitude.samples = metrics.headingAmplitudeSamples;
  if (metrics.headingAmplitudeSamples > 0) {
    const avg = metrics.headingAmplitudeSum / metrics.headingAmplitudeSamples;
    metrics.kpis.headingAmplitude.avg = avg;
    const min = metrics.headingAmplitudeMin;
    const max = metrics.headingAmplitudeMax;
    metrics.kpis.headingAmplitude.min = Number.isFinite(min) ? min : null;
    metrics.kpis.headingAmplitude.max = Number.isFinite(max) ? max : null;
  } else {
    metrics.kpis.headingAmplitude.avg = null;
    metrics.kpis.headingAmplitude.min = null;
    metrics.kpis.headingAmplitude.max = null;
  }

  metrics.kpis.ties.decisions = metrics.tieDecisions;
  metrics.kpis.ties.fallbacks = metrics.tieFallbacks;
  metrics.kpis.ties.ratio =
    metrics.totalDecisions > 0 ? metrics.tieDecisions / metrics.totalDecisions : null;

  metrics.lastAggregationTick = tick;
}
