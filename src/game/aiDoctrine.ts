import type {
  AIManagerState,
  DoctrineCard,
  DoctrineCardId,
  DoctrineProfileModifiers,
  DoctrineState,
  DoctrineThreatModifiers,
  DoctrineSquadDirectives,
  DoctrineSensorModifiers,
  BehaviorProfile,
  GameState,
  ShipEntity,
  Team,
} from '../types/index.js';
import { clamp01 } from '../utils/math.js';

const DEFAULT_CARD: DoctrineCardId = 'elasticDefense';

export const DOCTRINE_CARDS: Record<DoctrineCardId, DoctrineCard> = {
  aggressivePush: {
    id: 'aggressivePush',
    label: 'Aggressive Push',
    description: 'Drive forward, collapsing range bands and forcing decisive engagements.',
    profile: {
      aggressionMultiplier: 1.25,
      patienceMultiplier: 0.8,
      desiredRangeOffset: -20,
      bandPreference: 'inner',
      engagementBiasBonus: 12,
      orbitMultiplier: 0.85,
    },
    threat: {
      focusPenaltyMultiplier: 0.7,
      vipBonusMultiplier: 1.1,
      distanceScaleMultiplier: 0.85,
      hullBiasAdd: { carrier: 1.5, destroyer: 0.8 },
    },
    squad: {
      postureOverride: 'aggressive',
      escortReserveRatio: 0.4,
    },
    sensor: {
      detectionMultiplier: 1.1,
      contactRetentionMultiplier: 1.15,
    },
  },
  elasticDefense: {
    id: 'elasticDefense',
    label: 'Elastic Defense',
    description: 'Hold the line and absorb pressure while prioritising protection duties.',
    profile: {
      aggressionMultiplier: 0.9,
      patienceMultiplier: 1.2,
      desiredRangeOffset: 10,
      engagementBiasBonus: 4,
      bandPreference: 'mid',
    },
    threat: {
      focusPenaltyMultiplier: 1.2,
      vipBonusMultiplier: 1.4,
      distanceScaleMultiplier: 0.95,
    },
    squad: {
      postureOverride: 'hold',
      escortReserveRatio: 1,
    },
    sensor: {
      detectionMultiplier: 1,
      contactRetentionMultiplier: 0.9,
    },
  },
  ambush: {
    id: 'ambush',
    label: 'Ambush',
    description: 'Lie in wait, leveraging stealth and spacing to catch enemies unaware.',
    profile: {
      aggressionMultiplier: 0.95,
      patienceMultiplier: 1.3,
      desiredRangeOffset: 30,
      engagementBiasBonus: 6,
      bandPreference: 'outer',
      orbitMultiplier: 1.1,
    },
    threat: {
      focusPenaltyMultiplier: 0.9,
      vipBonusMultiplier: 1,
      distanceScaleMultiplier: 1.1,
      hullBiasAdd: { frigate: 0.4, destroyer: 0.6 },
    },
    squad: {
      postureOverride: 'hold',
      escortReserveRatio: 0.6,
    },
    sensor: {
      detectionMultiplier: 0.92,
      stealthBonus: 0.2,
      contactRetentionMultiplier: 0.6,
    },
  },
};

export function createDefaultDoctrineState(): DoctrineState {
  return {
    defaultCard: DEFAULT_CARD,
    teams: {
      blue: { cardId: DEFAULT_CARD, expiresAtTick: null, lastSwitchTick: 0 },
      red: { cardId: DEFAULT_CARD, expiresAtTick: null, lastSwitchTick: 0 },
    },
  };
}

export function ensureDoctrineState(manager: AIManagerState): DoctrineState {
  if (!manager.doctrine) {
    manager.doctrine = createDefaultDoctrineState();
  }
  return manager.doctrine;
}

export function getActiveDoctrineCard(
  manager: AIManagerState | undefined,
  team: Team,
): DoctrineCard {
  if (!manager) return DOCTRINE_CARDS[DEFAULT_CARD];
  const doctrine = ensureDoctrineState(manager);
  const runtime = doctrine.teams[team];
  return DOCTRINE_CARDS[runtime.cardId] ?? DOCTRINE_CARDS[DEFAULT_CARD];
}

export function getDoctrineProfileModifiers(
  manager: AIManagerState | undefined,
  team: Team,
): DoctrineProfileModifiers | undefined {
  return getActiveDoctrineCard(manager, team).profile;
}

export function getDoctrineThreatModifiers(
  manager: AIManagerState | undefined,
  team: Team,
): DoctrineThreatModifiers | undefined {
  return getActiveDoctrineCard(manager, team).threat;
}

export function getDoctrineSquadDirectives(
  manager: AIManagerState | undefined,
  team: Team,
): DoctrineSquadDirectives | undefined {
  return getActiveDoctrineCard(manager, team).squad;
}

export function getDoctrineSensorModifiers(
  manager: AIManagerState | undefined,
  team: Team,
): DoctrineSensorModifiers | undefined {
  return getActiveDoctrineCard(manager, team).sensor;
}

export function activateDoctrine(
  state: GameState,
  team: Team,
  cardId: DoctrineCardId,
  durationSeconds?: number,
): void {
  const manager = state.ai;
  const doctrine = ensureDoctrineState(manager);
  const runtime = doctrine.teams[team];
  runtime.cardId = DOCTRINE_CARDS[cardId] ? cardId : doctrine.defaultCard;
  runtime.lastSwitchTick = manager.tickIndex;
  if (durationSeconds != null) {
    const ticks = Math.max(1, Math.round(durationSeconds / Math.max(manager.tickInterval, 1e-3)));
    runtime.expiresAtTick = manager.tickIndex + ticks;
  } else {
    runtime.expiresAtTick = null;
  }
}

export function updateDoctrineTimers(state: GameState): void {
  const manager = state.ai;
  const doctrine = ensureDoctrineState(manager);
  const tick = manager.tickIndex;
  for (const team of ['blue', 'red'] as const) {
    const runtime = doctrine.teams[team];
    if (runtime.expiresAtTick != null && runtime.expiresAtTick <= tick) {
      runtime.cardId = doctrine.defaultCard;
      runtime.expiresAtTick = null;
      runtime.lastSwitchTick = tick;
    }
  }
}

function clampRange(min: number, max: number): readonly [number, number] {
  let adjustedMin = Math.max(5, min);
  let adjustedMax = Math.max(adjustedMin + 10, max);
  return [adjustedMin, adjustedMax] as const;
}

export function applyDoctrineToProfile(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
): BehaviorProfile {
  const manager = state.ai;
  const card = getActiveDoctrineCard(manager, ship.ship.team);
  const mods = card.profile;
  if (!mods) return profile;

  let changed = false;
  let aggression = profile.aggression;
  if (mods.aggressionMultiplier != null) {
    aggression = clamp01(profile.aggression * mods.aggressionMultiplier);
    changed ||= Math.abs(aggression - profile.aggression) > 1e-6;
  }

  let patience = profile.patience;
  if (mods.patienceMultiplier != null) {
    patience = clamp01(profile.patience * mods.patienceMultiplier);
    changed ||= Math.abs(patience - profile.patience) > 1e-6;
  }

  let orbit = profile.orbit;
  if (mods.orbitMultiplier != null) {
    orbit = profile.orbit * mods.orbitMultiplier;
    changed ||= Math.abs(orbit - profile.orbit) > 1e-6;
  }

  const currentRange = profile.desiredRange;
  let minRange = currentRange[0];
  let maxRange = currentRange[1];
  if (mods.desiredRangeOffset != null) {
    minRange += mods.desiredRangeOffset;
    maxRange += mods.desiredRangeOffset;
    changed = true;
  }
  if (mods.desiredRangeScale != null && mods.desiredRangeScale !== 1) {
    const center = (minRange + maxRange) * 0.5;
    const halfSpan = Math.max(1, (maxRange - minRange) * 0.5 * mods.desiredRangeScale);
    minRange = center - halfSpan;
    maxRange = center + halfSpan;
    changed = true;
  }
  const adjustedRange = clampRange(minRange, maxRange);
  if (adjustedRange[0] !== currentRange[0] || adjustedRange[1] !== currentRange[1]) {
    changed = true;
  }

  let engagementBias = profile.engagementBias ?? 0;
  if (mods.engagementBiasBonus != null && mods.engagementBiasBonus !== 0) {
    engagementBias += mods.engagementBiasBonus;
    changed = true;
  }

  const bandPreference = mods.bandPreference ?? profile.bandPreference;
  if (mods.bandPreference && mods.bandPreference !== profile.bandPreference) {
    changed = true;
  }

  if (!changed) {
    return profile;
  }

  const next: BehaviorProfile = {
    ...profile,
    aggression,
    patience,
    orbit,
    desiredRange: adjustedRange,
    engagementBias,
  };
  if (bandPreference) {
    next.bandPreference = bandPreference;
  }
  return next;
}
