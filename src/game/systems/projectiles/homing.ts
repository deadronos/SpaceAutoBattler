import type { GameState, ProjectileEntity, ShipEntity } from '../../../types/index.js';
import type { ProjectileHomingConfig } from '../../../types/combat.js';
import {
  FORWARD,
  computeLeadDirection,
  orientQuaternionFromDirection,
  steerDirection,
} from '../../../utils/steering.js';
import { TEMP_TARGET } from './sharedTemps.js';

/**
 * Finds a ship entity by its ID using efficient lookups.
 *
 * @param {GameState} state - The game state.
 * @param {number | undefined | null} id - The ID of the ship to find.
 * @returns {ShipEntity | undefined} The found ship entity, or undefined.
 */
export function findShipById(
  state: GameState,
  id: number | undefined | null,
): ShipEntity | undefined {
  if (id == null) return undefined;
  // Trust the canonical map; avoid O(N) fallback which kills performance when targets die.
  return state.shipById?.get(id);
}

/**
 * Steers a projectile towards its target using homing parameters.
 * Updates the projectile's direction vector.
 *
 * @param {ProjectileEntity} projectile - The projectile entity.
 * @param {ShipEntity} target - The target ship.
 * @param {ProjectileHomingConfig} homing - Homing configuration.
 * @param {number} delta - The time step.
 */
export function steerProjectileTowardTarget(
  projectile: ProjectileEntity,
  target: ShipEntity,
  homing: ProjectileHomingConfig,
  delta: number,
): void {
  const currentDir = projectile.direction;
  const separationSq = TEMP_TARGET.copy(target.transform.position)
    .sub(projectile.transform.position)
    .lengthSq();
  if (separationSq <= 1e-6) {
    return;
  }

  const desired = computeLeadDirection(
    target.transform.position,
    projectile.transform.position,
    target.ship.velocity,
    homing.lead ? 0.5 : 0,
    TEMP_TARGET,
  );

  const { newDir, angle } = steerDirection(currentDir, desired, homing.turnRate, delta, currentDir);
  if (angle < 1e-5) {
    return;
  }

  projectile.direction = newDir;
  orientQuaternionFromDirection(newDir, FORWARD, projectile.transform.rotation);
}
