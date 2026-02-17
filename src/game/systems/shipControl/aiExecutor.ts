import type { Vector3 } from 'three';
import type { GameState, ShipEntity } from '../../../types/index.js';
import { recordBandSample } from '../../metrics.js';
import { TEMP_DIR, TEMP_POS, TEMP_QUAT, TEMP_REL_POS } from './sharedTemps.js';
import { handleMissingAi } from './aiSafety.js';
import { getForwardFromQuaternion } from '../../../utils/vector.js';

/** Represents the decision output of the ship AI. */
export interface ShipDecision {
  heading: Vector3;
  thrust: number;
  firePrimary: boolean;
}

/** Result of the AI execution, including decision and target. */
export interface ShipAiResult {
  decision: ShipDecision | null;
  preferredTarget: ShipEntity | null;
}

/**
 * Finds a ship entity by ID.
 *
 * @param {GameState} state - The game state.
 * @param {number | undefined} id - The ship ID.
 * @returns {ShipEntity | null} The ship entity, or null.
 */
export function getShipById(state: GameState, id: number | undefined): ShipEntity | null {
  if (id == null) return null;
  return state.shipById.get(id) ?? null;
}

/**
 * Executes the low-level AI logic for a ship to produce a maneuver decision.
 * Converts high-level AI commands into immediate thrust and heading controls.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship entity.
 * @param {number} delta - The time step.
 * @returns {ShipAiResult} The calculated decision and target.
 */
export function executeShipAi(state: GameState, ship: ShipEntity, delta: number): ShipAiResult {
  const ai = ship.ai;
  if (!ai) {
    const fallbackTarget = handleMissingAi(state, ship);
    return { decision: null, preferredTarget: fallbackTarget };
  }

  const command = ai.command;
  command.ttl = Math.max(0, command.ttl - delta);

  const heading = command.heading;
  if (heading.lengthSq() < 1e-5) {
    getForwardFromQuaternion(ship.transform.rotation, heading);
  } else {
    heading.normalize();
  }

  try {
    const motion = ship.ship.motion;
    const tickHz = state.ai && state.ai.tickInterval > 0 ? 1 / state.ai.tickInterval : 10;
    const perTick = 1 / tickHz;
    const maxAngle = Math.max(0.05, motion.maxTurnRate * Math.max(perTick, delta));
    const currentForward = getForwardFromQuaternion(ship.transform.rotation, TEMP_DIR);
    if (currentForward.lengthSq() > 1e-6) {
      currentForward.normalize();
      const dot = Math.max(-1, Math.min(1, currentForward.dot(heading)));
      const angle = Math.acos(dot);
      if (angle > maxAngle) {
        const axis = TEMP_REL_POS.crossVectors(currentForward, heading);
        if (axis.lengthSq() < 1e-10) {
          axis.copy(currentForward).cross(TEMP_POS.set(0, 1, 0));
          if (axis.lengthSq() < 1e-10) axis.set(1, 0, 0);
        }
        axis.normalize();
        TEMP_QUAT.setFromAxisAngle(axis, maxAngle);
        heading.copy(currentForward).applyQuaternion(TEMP_QUAT).normalize();
      }
    }
  } catch {
    // fallback: keep heading as-is
  }

  const thrust = Math.min(1, Math.max(0, command.thrust));

  let target: ShipEntity | null = null;
  if (command.targetId != null) {
    target = getShipById(state, command.targetId);
  } else if (ai.targetId != null) {
    target = getShipById(state, ai.targetId);
  }

  try {
    if (target && ai.desiredRange) {
      const [min, max] = ai.desiredRange;
      const distance = ship.transform.position.distanceTo(target.transform.position);
      const satisfied = distance >= min && distance <= max;
      recordBandSample(state.ai.metrics, ship.ship.hull, satisfied);
    }
  } catch {
    // metrics are best-effort; ignore failures in lightweight harnesses
  }

  return {
    decision: {
      heading,
      thrust,
      firePrimary: command.firePrimary,
    },
    preferredTarget: target,
  };
}
