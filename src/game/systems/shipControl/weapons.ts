import { Vector3 } from 'three';
import type { GameState, ShipEntity } from '../../../types/index.js';
import { recordShotHelper } from '../../metrics.js';
import { fireProjectile } from '../projectiles.js';
import type { ShipDecision } from './aiExecutor.js';
import { TEMP_DIR } from './sharedTemps.js';

/**
 * Handles weapon firing based on the ship's decision.
 * Manages cooldowns, muzzle flashes, and projectile spawning.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship entity.
 * @param {ShipDecision} decision - The firing decision.
 * @param {ShipEntity | null} preferredTarget - The preferred target (for metrics).
 */
export function handleShipWeapons(
  state: GameState,
  ship: ShipEntity,
  decision: ShipDecision,
  preferredTarget: ShipEntity | null,
): void {
  if (!decision.firePrimary || ship.ship.cooldown > 0) {
    return;
  }

  (ship.muzzleFlashes ??= []).push({
    local: new Vector3(0, 0, ship.transform.scale * 1.6),
    t0: state.time,
    amp: 1,
    bulletType: ship.ship.bulletType,
  });

  const fireDir = TEMP_DIR.copy(decision.heading);
  if (fireDir.lengthSq() < 1e-5) fireDir.set(0, 0, 1);
  else fireDir.normalize();

  recordShotHelper(state, ship, preferredTarget);

  fireProjectile(state, ship, fireDir);
  ship.ship.cooldown = ship.ship.fireRate;
}
