import type { ShipHull } from '../gameplay.js';
import type { AIInBandStats, AIIntentSnapshot, AIShotHistogram } from './state.js';

/**
 * Summary of range-keeping performance.
 */
export interface AIInBandSummary {
  /** Total samples. */
  samples: number;
  /** Samples within band. */
  satisfied: number;
  /** Ratio of satisfied/samples. */
  ratio: number | null;
}

/**
 * Range-keeping summary broken down by hull type.
 */
export interface AIInBandSummaryByHull {
  /** Overall summary across all hulls. */
  overall: AIInBandSummary;
  /** Per-hull summaries. */
  byHull: Record<ShipHull, AIInBandSummary>;
}

/**
 * Statistics on time to first shot.
 */
export interface AIFirstShotSummary {
  /** Number of samples. */
  samples: number;
  /** Median time to first shot. */
  p50: number | null;
  /** 90th percentile time to first shot. */
  p90: number | null;
}

/**
 * Statistics on opening move aggression.
 */
export interface AIOpeningAggressionSummary {
  /** Total opening moves recorded. */
  total: number;
  /** Number of aggressive opening moves. */
  aggressive: number;
  /** Ratio of aggressive/total. */
  ratio: number | null;
}

/**
 * Statistics on vertical maneuver usage.
 */
export interface AIVerticalSummary {
  /** Total samples. */
  samples: number;
  /** Samples above the vertical threshold. */
  aboveThreshold: number;
  /** The threshold value used. */
  threshold: number;
  /** Ratio of aboveThreshold/samples. */
  ratio: number | null;
}

/**
 * Statistics on AI decision making latency.
 */
export interface AIDecisionLatencySummary {
  /** Histogram buckets for latency. */
  buckets: [number, number, number, number];
  /** Total decisions recorded. */
  total: number;
}

/**
 * Statistics on focus fire coordination.
 */
export interface AIFocusFireSummary {
  /** Number of samples. */
  samples: number;
  /** Average focus fire ratio. */
  ratioAvg: number | null;
  /** Maximum focus fire ratio observed. */
  ratioMax: number | null;
}

/**
 * Statistics on heading changes/amplitude.
 */
export interface AIHeadingAmplitudeSummary {
  /** Number of samples. */
  samples: number;
  /** Average amplitude. */
  avg: number | null;
  /** Minimum amplitude. */
  min: number | null;
  /** Maximum amplitude. */
  max: number | null;
}

/**
 * Statistics on decision ties and fallbacks.
 */
export interface AITieSummary {
  /** Total decisions made. */
  decisions: number;
  /** Number of fallback decisions due to ties. */
  fallbacks: number;
  /** Ratio of fallbacks/decisions. */
  ratio: number | null;
}

/**
 * Key Performance Indicators for the AI system.
 */
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

/**
 * Comprehensive metrics data structure collected by the AI system.
 */
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
