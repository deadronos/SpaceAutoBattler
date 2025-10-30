import type { ShipHull } from '../gameplay.js';
import type { AIInBandStats, AIIntentSnapshot, AIShotHistogram } from './state.js';

export interface AIInBandSummary {
  samples: number;
  satisfied: number;
  ratio: number | null;
}

export interface AIInBandSummaryByHull {
  overall: AIInBandSummary;
  byHull: Record<ShipHull, AIInBandSummary>;
}

export interface AIFirstShotSummary {
  samples: number;
  p50: number | null;
  p90: number | null;
}

export interface AIOpeningAggressionSummary {
  total: number;
  aggressive: number;
  ratio: number | null;
}

export interface AIVerticalSummary {
  samples: number;
  aboveThreshold: number;
  threshold: number;
  ratio: number | null;
}

export interface AIDecisionLatencySummary {
  buckets: [number, number, number, number];
  total: number;
}

export interface AIFocusFireSummary {
  samples: number;
  ratioAvg: number | null;
  ratioMax: number | null;
}

export interface AIHeadingAmplitudeSummary {
  samples: number;
  avg: number | null;
  min: number | null;
  max: number | null;
}

export interface AITieSummary {
  decisions: number;
  fallbacks: number;
  ratio: number | null;
}

export interface AIKpiSummary {
  firstShot: AIFirstShotSummary;
  openingAggression: AIOpeningAggressionSummary;
  inBand: AIInBandSummaryByHull;
  vertical: AIVerticalSummary;
  decisionLatency: AIDecisionLatencySummary;
  focusFire: AIFocusFireSummary;
  headingAmplitude: AIHeadingAmplitudeSummary;
  ties: AITieSummary;
}

export interface AIMetrics {
  totalDecisions: number;
  totalSkipped: number;
  budgetHits: number;
  lastDecisions: number;
  lastSkipped: number;
  lastSliceSize: number;
  lastTotalShips: number;
  verticalSamples: number;
  verticalAboveThreshold: number;
  inBandSamples: number;
  inBandSatisfied: number;
  openingAggressiveIntents: number;
  openingTotalIntents: number;
  tieDecisions: number;
  tieFallbacks: number;
  decisionLatencyBuckets: [number, number, number, number];
  focusFireSamples: number;
  focusFireRatioSum: number;
  focusFireRatioMax: number;
  headingAmplitudeSamples: number;
  headingAmplitudeSum: number;
  headingAmplitudeMin: number;
  headingAmplitudeMax: number;
  firstShotTimes: number[];
  firstShotByShip: Record<number, number>;
  intentTimeline: AIIntentSnapshot[];
  inBandByHull: Record<ShipHull, AIInBandStats>;
  shotDistanceHist: Record<ShipHull, AIShotHistogram>;
  shotDeltaYHist: Record<ShipHull, AIShotHistogram>;
  shotVerticalThreshold: number;
  lastAggregationTick: number;
  kpis: AIKpiSummary;
}
