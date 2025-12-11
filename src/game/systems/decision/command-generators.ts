import { Vector3 } from 'three';
import type {
  BehaviorProfile,
  EscortAssignment,
  GameState,
  ShipEntity,
  EntityId,
} from '../../../types/index.js';
import { hashToInt } from './utils.js';
import {
  computeInterceptHeadingVector,
  TEMP_REL_POS,
  TEMP_POS,
  getEffectiveRange,
  getDistanceBetween,
  getHpRatio,
} from './intent-utils.js';
import { getForwardFromQuaternion } from '../../../utils/vector.js';

export interface CommandResult {
  thrust: number;
  firePrimary: boolean;
  targetId?: EntityId;
  distanceToTarget: number | null;
}

/**
 * Helper function to set heading toward a target position with fallback to ship's forward direction.
 * Modifies the heading vector in-place.
 */
function setHeadingToward(
  heading: Vector3,
  targetPos: Vector3,
  shipPos: Vector3,
  shipRotation: { x: number; y: number; z: number; w: number },
): void {
  heading.copy(targetPos).sub(shipPos);
  if (heading.lengthSq() < 1e-5) {
    getForwardFromQuaternion(shipRotation, heading);
  } else {
    heading.normalize();
  }
}

/**
 * Generates an Intercept command.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The AI ship.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @param {ShipEntity | null} target - The target.
 * @param {Vector3} heading - Vector to write the heading to.
 * @returns {CommandResult} The command parameters.
 */
export function computeInterceptCommand(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  heading: Vector3,
): CommandResult {
  if (target) {
    computeInterceptHeadingVector(ship, target, heading);
    const distance = getDistanceBetween(ship, target);
    return {
      thrust: 1,
      firePrimary: distance <= ship.ship.range * 1.15,
      targetId: target.id,
      distanceToTarget: distance,
    };
  } else {
    getForwardFromQuaternion(ship.transform.rotation, heading);
    return {
      thrust: 0.8,
      firePrimary: false,
      targetId: undefined,
      distanceToTarget: null,
    };
  }
}

/**
 * Generates a Reposition command.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The AI ship.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @param {ShipEntity | null} target - The target.
 * @param {Vector3} heading - Vector to write the heading to.
 * @returns {CommandResult} The command parameters.
 */
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
      getForwardFromQuaternion(ship.transform.rotation, heading);
      distance = 0;
    }
    const distanceToTarget = getDistanceBetween(ship, target);
    const [desiredMin, desiredMax] = getEffectiveRange(
      ship,
      profile,
      distanceToTarget,
      state.ai.tickIndex,
    );
    // desiredMin/desiredMax are computed above using hysteresis when possible
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
    setHeadingToward(heading, centroid, ship.transform.position, ship.transform.rotation);
    return {
      thrust: 0.55,
      firePrimary: false,
      targetId: undefined,
      distanceToTarget: null,
    };
  }
}

/**
 * Generates a Regroup command.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The AI ship.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @param {Vector3} heading - Vector to write the heading to.
 * @returns {CommandResult} The command parameters.
 */
export function computeRegroupCommand(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  heading: Vector3,
): CommandResult {
  const centroid = state.blackboard.allyCentroid[ship.ship.team];
  setHeadingToward(heading, centroid, ship.transform.position, ship.transform.rotation);
  const hpRatio = getHpRatio(ship);
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

/**
 * Generates an Escort command.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The AI ship.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @param {ShipEntity | null} escortTarget - The escort target.
 * @param {EscortAssignment | null} escortAssignment - Escort details.
 * @param {Vector3} heading - Vector to write the heading to.
 * @returns {CommandResult} The command parameters.
 */
export function computeEscortCommand(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  escortTarget: ShipEntity | null,
  escortAssignment: EscortAssignment | null,
  heading: Vector3,
): CommandResult {
  if (escortTarget) {
    const targetPos = escortAssignment
      ? TEMP_POS.copy(escortTarget.transform.position).add(escortAssignment.offset)
      : escortTarget.transform.position;
    setHeadingToward(heading, targetPos, ship.transform.position, ship.transform.rotation);
  } else {
    getForwardFromQuaternion(ship.transform.rotation, heading);
  }
  return {
    thrust: 0.8,
    firePrimary: false,
    targetId: escortTarget?.id,
    distanceToTarget: null,
  };
}

/**
 * Generates a Kite command.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The AI ship.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @param {ShipEntity | null} target - The target.
 * @param {Vector3} heading - Vector to write the heading to.
 * @returns {CommandResult} The command parameters.
 */
export function computeKiteCommand(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  heading: Vector3,
): CommandResult {
  if (target) {
    heading.copy(ship.transform.position).sub(target.transform.position).normalize();
    const distanceToTarget = getDistanceBetween(ship, target);
    return {
      thrust: 1,
      firePrimary: true,
      targetId: target.id,
      distanceToTarget,
    };
  } else {
    getForwardFromQuaternion(ship.transform.rotation, heading);
    return {
      thrust: 1,
      firePrimary: false,
      targetId: undefined,
      distanceToTarget: null,
    };
  }
}

/**
 * Generates a Flee command.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The AI ship.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @param {Vector3} heading - Vector to write the heading to.
 * @returns {CommandResult} The command parameters.
 */
export function computeFleeCommand(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  heading: Vector3,
): CommandResult {
  const allyCentroid = state.blackboard.allyCentroid[ship.ship.team];
  setHeadingToward(heading, allyCentroid, ship.transform.position, ship.transform.rotation);
  return {
    thrust: 1,
    firePrimary: false,
    targetId: undefined,
    distanceToTarget: null,
  };
}

/**
 * Generates an Attack command.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The AI ship.
 * @param {BehaviorProfile} profile - The behavior profile.
 * @param {ShipEntity | null} target - The target.
 * @param {Vector3} heading - Vector to write the heading to.
 * @returns {CommandResult} The command parameters.
 */
export function computeAttackCommand(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  heading: Vector3,
): CommandResult {
  if (target) {
    heading.copy(target.transform.position).sub(ship.transform.position).normalize();
    const dist = getDistanceBetween(ship, target);
    const [desiredMin, desiredMax] = getEffectiveRange(ship, profile, dist, state.ai.tickIndex);
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
    getForwardFromQuaternion(ship.transform.rotation, heading);
    return {
      thrust: 0,
      firePrimary: false,
      targetId: undefined,
      distanceToTarget: null,
    };
  }
}
