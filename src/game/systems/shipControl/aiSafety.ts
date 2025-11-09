import type { GameState, ShipEntity } from '../../../types/index.js';
import type { KinematicBody } from '../../physics/safeKinematics.js';
import {
  deferSetNextKinematicRotation,
  deferSetNextKinematicTranslation,
} from '../../physics/safeKinematics.js';
import { findNearestEnemy } from '../turrets.js';

const missingAiShips = new Set<number>();
let warnedAiDisableInShips = false;

export function ensureAiEnabled(state: GameState): void {
  if (state.ai) state.ai.enabled = true;
  if (warnedAiDisableInShips) return;
  warnedAiDisableInShips = true;
  try {
    globalThis.console?.warn?.('AI v2 fallback removed: forcing AI enabled for all ships.');
  } catch {
    // ignore logging failures in headless tests
  }
}

export function keepShipStationary(state: GameState, ship: ShipEntity): void {
  const position = ship.transform.position;
  deferSetNextKinematicTranslation(
    state,
    ship.rigidBody as unknown as KinematicBody,
    position.x,
    position.y,
    position.z,
  );
  const rotation = ship.transform.rotation;
  deferSetNextKinematicRotation(
    state,
    ship.rigidBody as unknown as KinematicBody,
    rotation.x,
    rotation.y,
    rotation.z,
    rotation.w,
  );
}

export function handleMissingAi(state: GameState, ship: ShipEntity): ShipEntity | null {
  if (!missingAiShips.has(ship.id)) {
    missingAiShips.add(ship.id);
    try {
      globalThis.console?.error?.(
        `Ship ${ship.id} is missing an AI component; keeping it stationary.`,
      );
    } catch {
      // ignore logging failures
    }
  }
  keepShipStationary(state, ship);
  return findNearestEnemy(state, ship);
}
