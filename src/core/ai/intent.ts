import type { GameState, Ship } from '../../types/index.js';
import type { AIPersonality } from '../../config/behaviorConfig.js';
import { getEffectivePersonality } from '../../config/behaviorConfig.js';
import { scoreEvade as deScoreEvade } from './decisionEngine.js';
import { findNearestEnemy } from './targeting.js';

export function calculatePreferredRange(state: GameState, ship: Ship, personality?: AIPersonality): number {
  const p = personality ?? getEffectivePersonality(state.behaviorConfig!, ship.class, ship.team);
  const baseRange = state.behaviorConfig!.globalSettings.separationDistance;
  return baseRange * (p.preferredRangeMultiplier ?? 1);
}

export function reevaluateIntent(state: GameState, ship: Ship, personality: AIPersonality): void {
  const ai = ship.aiState!;
  const cfg = state.behaviorConfig!;
  const recentDamage = ai.recentDamage || 0;
  const lastDamageTime = ai.lastDamageTime || 0;
  const timeSinceLastDamage = state.time - lastDamageTime;
  const withinDamageWindow = timeSinceLastDamage <= cfg.globalSettings.evadeRecentDamageWindowSeconds;
  const shouldEvadeFromDamage = recentDamage >= cfg.globalSettings.damageEvadeThreshold && withinDamageWindow;
  if (state.time < ai.intentEndTime && !shouldEvadeFromDamage) return;

  let newIntent = 'idle' as Ship['aiState']['currentIntent'];
  if (shouldEvadeFromDamage) {
    newIntent = 'evade' as any;
  } else {
    // Minimal parity: aggressive pursues when enemy nearby, else patrol
    const nearest = findNearestEnemy(state, ship);
    newIntent = nearest ? 'pursue' as any : 'patrol' as any;
    if (cfg.globalSettings.useDecisionEngineEvadeGate) {
      const distanceToThreat = nearest ? Math.hypot(nearest.pos.x - ship.pos.x, nearest.pos.y - ship.pos.y, nearest.pos.z - ship.pos.z) : null;
      const score = deScoreEvade({ distanceToThreat, recentDamage, damageEvadeThreshold: cfg.globalSettings.damageEvadeThreshold, withinRecentDamageWindow: withinDamageWindow, settings: cfg.globalSettings });
      if (score >= 1.0) newIntent = 'evade' as any;
    }
  }
  ai.currentIntent = newIntent as any;
  ai.lastIntentReevaluation = state.time;
}
