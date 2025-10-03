import { Vector3 } from 'three';
import type {
  BehaviorProfile,
  EscortAssignment,
  GameState,
  ShipEntity,
  EntityId,
} from '../../../types/index.js';
import { hashToInt } from './utils.js';
import { computeInterceptHeadingVector, TEMP_REL_POS, TEMP_POS } from './intent-utils.js';

export interface CommandResult {
  thrust: number;
  firePrimary: boolean;
  targetId?: EntityId;
  distanceToTarget: number | null;
}

export function computeInterceptCommand(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  heading: Vector3,
): CommandResult {
  if (target) {
    computeInterceptHeadingVector(ship, target, heading);
    const distance = ship.transform.position.distanceTo(target.transform.position);
    return {
      thrust: 1,
      firePrimary: distance <= ship.ship.range * 1.15,
      targetId: target.id,
      distanceToTarget: distance,
    };
  } else {
    heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
    return {
      thrust: 0.8,
      firePrimary: false,
      targetId: undefined,
      distanceToTarget: null,
    };
  }
}

export function computeRepositionCommand(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  heading: Vector3,
): CommandResult {
  if (target) {
    heading.copy(target.transform.position).sub(ship.transform.position);
    let distance = heading.length();
    if (distance > 1e-5) {
      heading.divideScalar(distance);
      const tangent = TEMP_REL_POS.set(-heading.z, 0, heading.x);
      const hash = hashToInt(ship.id ^ (state.ai.tickIndex * 491));
      if (tangent.lengthSq() > 1e-5) {
        tangent.normalize();
        if (hash & 1) tangent.negate();
        heading.multiplyScalar(0.6).addScaledVector(tangent, 0.4).normalize();
      }
    } else {
      heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
      distance = 0;
    }
    const distanceToTarget = ship.transform.position.distanceTo(target.transform.position);
    const desiredMin = profile.desiredRange[0];
    const desiredMax = profile.desiredRange[1];
    let shouldFire = distance <= ship.ship.range;
    let thrust: number;
    if (distance > desiredMax * 1.05) {
      thrust = 0.95;
    } else if (distance < desiredMin * 0.95) {
      heading.negate();
      heading.normalize();
      thrust = 0.6;
      shouldFire = false;
    } else {
      thrust = profile.style === 'artillery' ? 0.3 : 0.45;
      if (shouldFire) {
        shouldFire = distance >= desiredMin && distance <= desiredMax;
      }
    }
    return {
      thrust,
      firePrimary: shouldFire,
      targetId: target.id,
      distanceToTarget,
    };
  } else {
    const centroid = state.blackboard.allyCentroid[ship.ship.team];
    heading.copy(centroid).sub(ship.transform.position);
    if (heading.lengthSq() < 1e-5) {
      heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
    } else {
      heading.normalize();
    }
    return {
      thrust: 0.55,
      firePrimary: false,
      targetId: undefined,
      distanceToTarget: null,
    };
  }
}

export function computeRegroupCommand(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  heading: Vector3,
): CommandResult {
  const centroid = state.blackboard.allyCentroid[ship.ship.team];
  heading.copy(centroid).sub(ship.transform.position);
  if (heading.lengthSq() < 1e-5) {
    heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
  } else {
    heading.normalize();
  }
  const hpRatio = ship.ship.hp / Math.max(1, ship.ship.maxHp);
  const urgency = 1 + Math.max(0, 1 - hpRatio) * 0.5;
  const posture = state.blackboard.teamPosture[ship.ship.team];
  const base = posture === 'retreat' ? 0.95 : 0.75;
  return {
    thrust: Math.min(1, base * urgency),
    firePrimary: false,
    targetId: undefined,
    distanceToTarget: null,
  };
}

export function computeEscortCommand(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  escortTarget: ShipEntity | null,
  escortAssignment: EscortAssignment | null,
  heading: Vector3,
): CommandResult {
  if (escortTarget) {
    if (escortAssignment) {
      const desired = TEMP_POS.copy(escortTarget.transform.position).add(escortAssignment.offset);
      heading.copy(desired).sub(ship.transform.position);
    } else {
      heading.copy(escortTarget.transform.position).sub(ship.transform.position);
    }
    if (heading.lengthSq() < 1e-5) {
      heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
    } else {
      heading.normalize();
    }
  } else {
    heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
  }
  return {
    thrust: 0.8,
    firePrimary: false,
    targetId: escortTarget?.id,
    distanceToTarget: null,
  };
}

export function computeKiteCommand(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  heading: Vector3,
): CommandResult {
  if (target) {
    heading.copy(ship.transform.position).sub(target.transform.position).normalize();
    const distanceToTarget = ship.transform.position.distanceTo(target.transform.position);
    return {
      thrust: 1,
      firePrimary: true,
      targetId: target.id,
      distanceToTarget,
    };
  } else {
    heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
    return {
      thrust: 1,
      firePrimary: false,
      targetId: undefined,
      distanceToTarget: null,
    };
  }
}

export function computeFleeCommand(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  heading: Vector3,
): CommandResult {
  const allyCentroid = state.blackboard.allyCentroid[ship.ship.team];
  heading.copy(allyCentroid).sub(ship.transform.position);
  if (heading.lengthSq() < 1e-5) {
    heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
  } else {
    heading.normalize();
  }
  return {
    thrust: 1,
    firePrimary: false,
    targetId: undefined,
    distanceToTarget: null,
  };
}

export function computeAttackCommand(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  heading: Vector3,
): CommandResult {
  if (target) {
    heading.copy(target.transform.position).sub(ship.transform.position).normalize();
    const dist = ship.transform.position.distanceTo(target.transform.position);
    const desiredMin = profile.desiredRange[0];
    const desiredMax = profile.desiredRange[1];
    let thrust: number;
    if (dist > desiredMax) {
      thrust = 1;
    } else if (dist < desiredMin) {
      heading.negate();
      thrust = 0.6;
    } else {
      thrust = 0.35;
    }
    return {
      thrust,
      firePrimary: dist <= ship.ship.range,
      targetId: target.id,
      distanceToTarget: dist,
    };
  } else {
    heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
    return {
      thrust: 0,
      firePrimary: false,
      targetId: undefined,
      distanceToTarget: null,
    };
  }
}
