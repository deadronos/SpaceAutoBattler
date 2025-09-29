import type {
  AITraits,
  BehaviorProfile,
  EscortAssignment,
  GameState,
  ShipEntity,
  TeamPosture,
} from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';
import {
  quantizeScore,
  computeBandPreferenceBonus,
  computeThreatBonus,
  getSpeedMagnitude,
} from './intent-utils.js';

export function scoreInterceptIntent(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity,
  escortTarget: ShipEntity | null,
  posture: TeamPosture,
  traits: AITraits,
  escortAssignment: EscortAssignment | null,
): number {
  const style = profile.style;
  if (style !== 'escort' && style !== 'brawler' && style !== 'artillery') {
    return quantizeScore(180);
  }

  const distance = ship.transform.position.distanceTo(target.transform.position);
  const desiredMax = profile.desiredRange[1];
  const bandPressure = Math.max(0, distance - desiredMax);

  const targetSpeed = getSpeedMagnitude(target);
  const threatBonus = computeThreatBonus(state, ship.ship.team, target.id);
  const escortBonus = escortAssignment && escortAssignment.threatId === target.id ? 80 : 0;
  const aggression = profile.aggression * traits.aggression;

  const isOpeningSalvo = AI_CONFIG.engagementBoostEnabled && state.time < AI_CONFIG.openingSalvoDuration;
  const aggressionMultiplier = isOpeningSalvo ? AI_CONFIG.openingSalvoAggressionBoost : 1.0;

  let score = 480 + bandPressure * 2 + targetSpeed * 12 + aggression * 108 * aggressionMultiplier + threatBonus + escortBonus;
  if (posture === 'aggressive') score += 100 * aggressionMultiplier;
  if (posture === 'retreat') score -= 110;
  score += computeBandPreferenceBonus(distance, profile.desiredRange[0], desiredMax, profile.bandPreference);
  const interceptIndex = state.blackboard.priorityIndex?.[ship.ship.team];
  if (interceptIndex) {
    const interceptRank = interceptIndex.get(target.id);
    if (interceptRank != null && Number.isFinite(interceptRank)) {
      score += Math.max(0, 120 - interceptRank * 10);
    }
  }
  const focusMap = state.blackboard.focusFire?.[ship.ship.team];
  const interceptFocusLoad = focusMap ? focusMap.get(target.id) ?? 0 : 0;
  score += Math.max(-70, 28 - interceptFocusLoad * 24);
  if (AI_CONFIG.engagementBoostEnabled && profile.engagementBias) {
    score += profile.engagementBias;
  }

  return quantizeScore(score);
}

export function scoreRepositionIntent(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  traits: AITraits,
  posture: TeamPosture,
): number {
  const patience = profile.patience * traits.patience;
  const centroid = state.blackboard.allyCentroid[ship.ship.team];
  if (!target) {
    const centroidDist = ship.transform.position.distanceTo(centroid);
    const desire = profile.desiredRange[0];
    const spacing = Math.max(0, centroidDist - desire * 1.5);
    let base = 220 + spacing * 1.2 + patience * 70;
    if (posture === 'hold') base += 50;
    if (posture === 'retreat') base -= 40;
    return quantizeScore(base);
  }

  const desiredMin = profile.desiredRange[0];
  const desiredMax = profile.desiredRange[1];
  const distance = ship.transform.position.distanceTo(target.transform.position);
  const below = Math.max(0, desiredMin - distance);
  const above = Math.max(0, distance - desiredMax);
  let bandError = Math.abs(distance - (desiredMin + desiredMax) * 0.5);

  let score = 260 + (below + above) * 1.6 + bandError * 0.9 + patience * 80;
  if (profile.style === 'artillery') score += 150;
  if (profile.style === 'kiter') score += 90;
  if (posture === 'retreat') score -= 60;
  score += computeBandPreferenceBonus(distance, desiredMin, desiredMax, profile.bandPreference);
  return quantizeScore(score);
}
