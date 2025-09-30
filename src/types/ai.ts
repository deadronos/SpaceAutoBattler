import type { Vector3 } from 'three';
import type { EntityId } from './core.js';
import type { Team, ShipHull } from './gameplay.js';

export type AIIntent =
  | 'Attack'
  | 'Kite'
  | 'Escort'
  | 'Intercept'
  | 'Flee'
  | 'Regroup'
  | 'Reposition';

export interface AICommand {
  heading: Vector3;
  thrust: number;
  /** Optional lateral strafe input in range [-1, 1]. */
  strafe?: number;
  firePrimary: boolean;
  orbit?: number;
  targetId?: EntityId;
  ttl: number;
}

export interface AITraits {
  aggression: number;
  patience: number;
  dodge: number;
}

export interface AIState {
  profileId: string;
  intent: AIIntent;
  nextThinkAt: number;
  cooldowns: {
    dodgeAt: number;
    burstAt: number;
  };
  lod: 0 | 1 | 2;
  traitSeed: number;
  traits: AITraits;
  targetId?: EntityId;
  lastScore?: number;
  command: AICommand;
  stickinessUntil: number;
  stickinessHeading: Vector3;
  stickinessTargetId?: EntityId;
  desiredRange?: readonly [number, number];
}

export interface BehaviorProfile {
  desiredRange: readonly [number, number];
  orbit: number;
  aggression: number;
  patience: number;
  dodgeFreq: number;
  classBias: Partial<Record<ShipHull, number>>;
  style: 'brawler' | 'kiter' | 'artillery' | 'escort';
  gates?: {
    ammoMin?: number;
    hpRetreatPct?: number;
  };
  verticalManeuver: number;
  elevationPreference?: 'above' | 'below' | 'follow';
  bandPreference?: 'outer' | 'mid' | 'inner';
  engagementBias?: number;
}

export type TeamPosture = 'aggressive' | 'hold' | 'retreat';

export interface AIBlackboard {
  tickIndex: number;
  teamPosture: Record<Team, TeamPosture>;
  allyCentroid: Record<Team, Vector3>;
  nearestEnemy: Map<EntityId, EntityId>;
  threatToVip: Map<EntityId, EntityId>;
  tmpVectors: Vector3[];
  strengthRatio: Record<Team, number>;
  teamPriority: Record<Team, PrioritisedTarget[]>;
  priorityIndex: Record<Team, Map<EntityId, number>>;
  focusFire: Record<Team, Map<EntityId, number>>;
  teamCounts?: Record<Team, number>;
  // Vertical dispersion tracking for validation (optional for backward compatibility)
  verticalDispersion?: {
    headingYSamples: number[];
    positionYSamples: number[];
    lastUpdateTick: number;
  };
}

export interface AITeamAssignments {
  escorts: Map<EntityId, EscortAssignment>;
}

export interface EscortAssignment {
  vipId: EntityId;
  offset: Vector3;
  threatId?: EntityId;
}

export interface AIIntentSnapshot {
  tick: number;
  time: number;
  counts: Partial<Record<AIIntent, number>>;
  total: number;
}

export interface PrioritisedTarget {
  id: EntityId;
  threat: number;
  distanceSq: number;
  focusLoad: number;
}

export type AIInterruptReason = 'hp-drop' | 'target-lost' | 'vip-threat' | 'manual';

export interface IntentInterruptEvent {
  shipId: EntityId;
  reason: AIInterruptReason;
  tick: number;
  sourceId?: EntityId;
}

export interface AIInterruptState {
  cooldownTick: Map<string, number>;
  damageThisTick: Map<EntityId, number>;
  lastDamageTick: number;
  vipThreatAssignments: Map<EntityId, EntityId>;
}

export interface AIShotHistogram {
  buckets: readonly number[];
  counts: number[];
  total: number;
}

export interface AIInBandStats {
  samples: number;
  satisfied: number;
}

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

export interface AIManagerState {
  enabled: boolean;
  tickInterval: number;
  maxPerTick: number;
  accumulator: number;
  tickIndex: number;
  cursor: number;
  slices: number;
  assignments: AITeamAssignments;
  metrics: AIMetrics;
  interrupts?: IntentInterruptEvent[];
  interruptState?: AIInterruptState;
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
