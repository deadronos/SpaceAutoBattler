import type {
  AITraits,
  BehaviorProfile,
  EscortAssignment,
  GameState,
  ShipEntity,
  TeamPosture,
} from '../../../types/index.js';
import {
  quantizeScore,
  getDistanceBetween,
  getHpRatio,
  getEffectivePatience,
} from './intent-utils.js';

export function scoreRegroupIntent(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  posture: TeamPosture,
  traits: AITraits,
): number {
  const centroid = state.blackboard.allyCentroid[ship.ship.team];
  const distance = ship.transform.position.distanceTo(centroid);
  const hpRatio = getHpRatio(ship);
  const gate = profile.gates?.hpRetreatPct ?? 0.3;
  const patience = getEffectivePatience(profile, traits);

  if (posture === 'retreat' || hpRatio <= gate + 0.05) {
    let score = 420 + distance * 1.1 + (1 - hpRatio) * 260 + patience * 90;
    if (posture === 'retreat') score += 140;
    return quantizeScore(score);
  }

  if (distance > profile.desiredRange[1] * 2.5) {
    return quantizeScore(260 + distance * 0.8 + patience * 60);
  }

  return quantizeScore(180);
}

export function scoreEscortIntent(
  ship: ShipEntity,
  profile: BehaviorProfile,
  escortTarget: ShipEntity,
  state: GameState,
  traits: AITraits,
  escortAssignment: EscortAssignment | null,
): number {
  const dist = getDistanceBetween(ship, escortTarget);
  const threatId = escortAssignment?.threatId ?? state.blackboard.threatToVip.get(escortTarget.id);
  const threatWeight = threatId != null ? 220 : 0;
  const desiredRadius = escortAssignment?.offset.length() ?? profile.desiredRange[0];
  const bandError = Math.abs(dist - desiredRadius);
  const patience = getEffectivePatience(profile, traits);
  const assignmentBonus = escortAssignment ? 120 : 0;
  return quantizeScore(700 - bandError * 2 + patience * 90 + threatWeight + assignmentBonus);
}
