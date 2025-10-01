import type {
  AITraits,
  BehaviorProfile,
  GameState,
  ShipEntity,
  TeamPosture,
} from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';
import { quantizeScore, computeBandPreferenceBonus, computeThreatBonus } from './intent-utils.js';

export function scoreAttackIntent(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  posture: TeamPosture,
  traits: AITraits,
): number {
  if (!target) return 0;
  const desiredMin = profile.desiredRange[0];
  const desiredMax = profile.desiredRange[1];
  const dist = ship.transform.position.distanceTo(target.transform.position);
  const mid = (desiredMin + desiredMax) * 0.5;
  const bandError = Math.abs(dist - mid);
  const hpRatio = ship.ship.hp / Math.max(1, ship.ship.maxHp);
  const aggression = profile.aggression * traits.aggression;

  const isOpeningSalvo = AI_CONFIG.engagementBoostEnabled && state.time < AI_CONFIG.openingSalvoDuration;
  const aggressionMultiplier = isOpeningSalvo ? AI_CONFIG.openingSalvoAggressionBoost : 1.0;

  let score = 1000 - bandError * 4.6 + aggression * 120 * aggressionMultiplier;
  score += hpRatio * 80;
  if (posture === 'aggressive') score += 90 * aggressionMultiplier;
  if (posture === 'retreat') score -= 120;
  const bias = profile.classBias[target.ship.hull] ?? 0;
  score += bias;
  score += computeBandPreferenceBonus(dist, desiredMin, desiredMax, profile.bandPreference);
  const priorityIndex = state.blackboard.priorityIndex?.[ship.ship.team];
  if (priorityIndex) {
    const rank = priorityIndex.get(target.id);
    if (rank != null && Number.isFinite(rank)) {
      score += Math.max(0, 140 - rank * 12);
    }
  }
  score += computeThreatBonus(state, ship.ship.team, target.id);
  const focusMap = state.blackboard.focusFire?.[ship.ship.team];
  const focusLoad = focusMap ? focusMap.get(target.id) ?? 0 : 0;
  const focusBias = focusLoad === 0 ? 40 : Math.max(-80, 35 - focusLoad * 30);
  score += focusBias;
  if (AI_CONFIG.engagementBoostEnabled && profile.engagementBias) {
    score += profile.engagementBias;
  }
  return quantizeScore(score);
}

export function scoreKiteIntent(
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  posture: TeamPosture,
  traits: AITraits,
): number {
  if (!target) return 100;
  const distance = ship.transform.position.distanceTo(target.transform.position);
  const desiredMin = profile.desiredRange[0];
  const desiredMax = profile.desiredRange[1];
  const aggression = profile.aggression * traits.aggression;
  const hpRatio = ship.ship.hp / Math.max(1, ship.ship.maxHp);
  let score = 320 + (distance - desiredMin) * 1.4 + aggression * 70;
  if (distance < desiredMin) score -= 120;
  if (distance > desiredMax * 1.25) score -= 90;
  if (posture === 'retreat') score += 80;
  if (posture === 'aggressive') score -= 60;
  score += (1 - hpRatio) * 200;
  return quantizeScore(score);
}

export function scoreFleeIntent(
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  posture: TeamPosture,
  traits: AITraits,
): number {
  const hpRatio = ship.ship.hp / Math.max(1, ship.ship.maxHp);
  const gate = profile.gates?.hpRetreatPct ?? 0.2;
  const patience = profile.patience * traits.patience;
  if (hpRatio > gate && posture !== 'retreat') return quantizeScore(150 - patience * 40);
  const threat = target ? ship.transform.position.distanceTo(target.transform.position) : profile.desiredRange[1];
  const nerve = 1 - Math.min(0.6, patience * 0.3);
  const dodge = 1 + (traits.dodge - 1) * 0.5;
  const base = 400 + (gate - hpRatio) * 400 * (1 + patience * 0.1);
  return quantizeScore((base + Math.max(0, 300 - threat) * dodge) * (1 + nerve * 0.25));
}
