import type { AIIntent, AIPersonality, BehaviorConfig } from '../../config/behaviorConfig.js';

// Simple scoring helpers to support pure decision experiments.
// These are not yet wired into AIController intent selection to avoid behavior changes.

export function scorePursue(params: {
  distanceToEnemy: number | null;
  preferredRange: number;
  settings: BehaviorConfig['globalSettings'];
  personality: AIPersonality;
  isScout: boolean;
  teamUnderAlarm: boolean;
}): number {
  const { distanceToEnemy, preferredRange, settings, personality, isScout, teamUnderAlarm } = params;
  if (distanceToEnemy == null) return (isScout ? 0.5 : 0) + (teamUnderAlarm ? 0.4 : 0);
  let score = 0;
  if (distanceToEnemy < preferredRange * settings.closeRangeMultiplier) score += 1.0;
  else if (distanceToEnemy < preferredRange * settings.mediumRangeMultiplier) score += 0.7;
  score += personality.aggressiveness * 0.5;
  if (isScout) score += 0.5;
  if (teamUnderAlarm) score += 0.6;
  return score;
}

export function scoreEvade(params: {
  distanceToThreat: number | null;
  recentDamage: number;
  damageEvadeThreshold: number;
  withinRecentDamageWindow: boolean;
  settings: BehaviorConfig['globalSettings'];
}): number {
  const { distanceToThreat, recentDamage, damageEvadeThreshold, withinRecentDamageWindow, settings } = params;
  let score = 0;
  if (distanceToThreat != null && distanceToThreat < settings.minimumSafeDistance * settings.closeRangeMultiplier) score += 1.0;
  if (recentDamage >= damageEvadeThreshold && withinRecentDamageWindow) score += 1.0;
  return score;
}

export function scoreRoam(params: {
  hasNearbyFriends: boolean;
  personality: AIPersonality;
}): number {
  const { hasNearbyFriends, personality } = params;
  // Favor roam/patrol when cohesion is low and no friends nearby
  let score = 0.2 + (1 - personality.groupCohesion) * 0.6;
  if (!hasNearbyFriends) score += 0.2;
  return score;
}

export function chooseBestIntent(scores: Partial<Record<AIIntent, number>>): AIIntent {
  const entries = Object.entries(scores) as [AIIntent, number | undefined][];
  let best: { intent: AIIntent; score: number } | null = null;
  for (const [intent, score] of entries) {
    const s = score ?? -Infinity;
    if (!best || s > best.score) best = { intent, score: s };
  }
  return best ? best.intent : 'idle';
}
