import type { AIMetrics } from '../../types/index.js';
import { SHIP_HULLS } from './constants.js';

/**
 * Resets all metrics in the provided object to their initial state.
 *
 * @param {AIMetrics} metrics - The metrics object to reset.
 */
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
  metrics.decisionLatencyBuckets = [0, 0, 0, 0];
  metrics.focusFireSamples = 0;
  metrics.focusFireRatioSum = 0;
  metrics.focusFireRatioMax = 0;
  metrics.headingAmplitudeSamples = 0;
  metrics.headingAmplitudeSum = 0;
  metrics.headingAmplitudeMin = Number.POSITIVE_INFINITY;
  metrics.headingAmplitudeMax = Number.NEGATIVE_INFINITY;
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
  const latencyBuckets = metrics.kpis.decisionLatency.buckets;
  latencyBuckets[0] = 0;
  latencyBuckets[1] = 0;
  latencyBuckets[2] = 0;
  latencyBuckets[3] = 0;
  metrics.kpis.decisionLatency.total = 0;
  metrics.kpis.focusFire.samples = 0;
  metrics.kpis.focusFire.ratioAvg = null;
  metrics.kpis.focusFire.ratioMax = null;
  metrics.kpis.headingAmplitude.samples = 0;
  metrics.kpis.headingAmplitude.avg = null;
  metrics.kpis.headingAmplitude.min = null;
  metrics.kpis.headingAmplitude.max = null;
  metrics.kpis.ties.decisions = 0;
  metrics.kpis.ties.fallbacks = 0;
  metrics.kpis.ties.ratio = null;
  metrics.lastAggregationTick = -1;
}
