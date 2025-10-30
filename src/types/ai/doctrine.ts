import type { Team, ShipHull } from '../gameplay.js';
import type { BehaviorProfile, TeamPosture } from './state.js';

export type DoctrineCardId = 'aggressivePush' | 'elasticDefense' | 'ambush';

export interface DoctrineProfileModifiers {
  aggressionMultiplier?: number;
  patienceMultiplier?: number;
  desiredRangeOffset?: number;
  desiredRangeScale?: number;
  bandPreference?: BehaviorProfile['bandPreference'];
  engagementBiasBonus?: number;
  orbitMultiplier?: number;
}

export interface DoctrineThreatModifiers {
  focusPenaltyMultiplier?: number;
  vipBonusMultiplier?: number;
  distanceScaleMultiplier?: number;
  hullBiasAdd?: Partial<Record<ShipHull, number>>;
}

export interface DoctrineSquadDirectives {
  postureOverride?: TeamPosture;
  escortReserveRatio?: number;
}

export interface DoctrineSensorModifiers {
  detectionMultiplier?: number;
  stealthBonus?: number;
  contactRetentionMultiplier?: number;
}

export interface DoctrineCard {
  id: DoctrineCardId;
  label: string;
  description: string;
  profile?: DoctrineProfileModifiers;
  threat?: DoctrineThreatModifiers;
  squad?: DoctrineSquadDirectives;
  sensor?: DoctrineSensorModifiers;
}

export interface DoctrineRuntimeState {
  cardId: DoctrineCardId;
  expiresAtTick: number | null;
  lastSwitchTick: number;
}

export interface DoctrineState {
  defaultCard: DoctrineCardId;
  teams: Record<Team, DoctrineRuntimeState>;
}
