import type { Team, ShipHull } from '../gameplay.js';
import type { BehaviorProfile, TeamPosture } from './state.js';

/** Identifier for predefined doctrine cards. */
export type DoctrineCardId = 'aggressivePush' | 'elasticDefense' | 'ambush';

/**
 * Modifiers applied to individual AI behavior profiles by a doctrine.
 */
export interface DoctrineProfileModifiers {
  /** Multiplier for aggression trait. */
  aggressionMultiplier?: number;
  /** Multiplier for patience trait. */
  patienceMultiplier?: number;
  /** Offset added to desired engagement range. */
  desiredRangeOffset?: number;
  /** Multiplier applied to desired engagement range. */
  desiredRangeScale?: number;
  /** Overridden band preference (inner/mid/outer). */
  bandPreference?: BehaviorProfile['bandPreference'];
  /** Bonus added to engagement bias score. */
  engagementBiasBonus?: number;
  /** Multiplier for orbit distance. */
  orbitMultiplier?: number;
}

/**
 * Modifiers influencing how the AI perceives and prioritizes threats.
 */
export interface DoctrineThreatModifiers {
  /** Multiplier for focus fire score penalty. */
  focusPenaltyMultiplier?: number;
  /** Multiplier for VIP target priority score. */
  vipBonusMultiplier?: number;
  /** Multiplier for distance factor in threat calculation. */
  distanceScaleMultiplier?: number;
  /** Additive bias for specific hull types in threat scoring. */
  hullBiasAdd?: Partial<Record<ShipHull, number>>;
}

/**
 * Directives affecting squad-level organization and posture.
 */
export interface DoctrineSquadDirectives {
  /** Overrides the team's default posture. */
  postureOverride?: TeamPosture;
  /** Ratio of ships kept in reserve for escort duties. */
  escortReserveRatio?: number;
}

/**
 * Modifiers applied to sensor performance and logic.
 */
export interface DoctrineSensorModifiers {
  /** Multiplier for sensor detection range. */
  detectionMultiplier?: number;
  /** Bonus applied to stealth rating. */
  stealthBonus?: number;
  /** Multiplier for duration contacts are retained after signal loss. */
  contactRetentionMultiplier?: number;
}

/**
 * Definition of a doctrine card that can be selected to alter team behavior.
 */
export interface DoctrineCard {
  /** Unique identifier for the card. */
  id: DoctrineCardId;
  /** Display name of the doctrine. */
  label: string;
  /** Description of the doctrine's effects. */
  description: string;
  /** Profile modifiers applied by this doctrine. */
  profile?: DoctrineProfileModifiers;
  /** Threat scoring modifiers applied by this doctrine. */
  threat?: DoctrineThreatModifiers;
  /** Squad organization directives. */
  squad?: DoctrineSquadDirectives;
  /** Sensor system modifiers. */
  sensor?: DoctrineSensorModifiers;
}

/**
 * Runtime state for a team's active doctrine.
 */
export interface DoctrineRuntimeState {
  /** The currently active doctrine card ID. */
  cardId: DoctrineCardId;
  /** Game tick when the current doctrine expires (null if permanent). */
  expiresAtTick: number | null;
  /** Game tick when the doctrine was last changed. */
  lastSwitchTick: number;
}

/**
 * Overall state of the doctrine system.
 */
export interface DoctrineState {
  /** The default doctrine card ID to fall back to. */
  defaultCard: DoctrineCardId;
  /** Doctrine state for each team. */
  teams: Record<Team, DoctrineRuntimeState>;
}
