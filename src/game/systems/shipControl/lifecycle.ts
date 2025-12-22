import type { GameState, ShipEntity } from '../../../types/index.js';
import { updateCaptainAbilities, repairSubsystems, getSubsystemMultiplier } from '../../progression.js';

const MUZZLE_FLASH_LIFETIME = 0.25;

/**
 * Updates the lifecycle state of a ship.
 * Handles cooldowns, subsystem repair, shield regeneration, and effect cleanup.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity} ship - The ship entity.
 * @param {number} delta - The time step.
 */
export function updateShipLifecycle(state: GameState, ship: ShipEntity, delta: number): void {
  ship.ship.cooldown = Math.max(0, ship.ship.cooldown - delta);
  if (ship.turrets) {
    for (const turret of ship.turrets) {
      turret.cooldown = Math.max(0, turret.cooldown - delta);
    }
  }

  updateCaptainAbilities(ship.ship, state.time, delta);
  repairSubsystems(ship.ship, delta);

  // OPTIMIZATION: Use direct subsystem multiplier lookup to avoid allocating
  // a full stats object via getEffectiveStats() every frame.
  const regenMultiplier = getSubsystemMultiplier('shields', ship.ship.subsystems.shields.status);
  const regen = (ship.ship.shieldRegen ?? 0) * regenMultiplier;
  if (regen > 0 && ship.ship.shield < ship.ship.maxShield) {
    ship.ship.shield = Math.min(ship.ship.maxShield, ship.ship.shield + regen * delta);
  }

  if (ship.muzzleFlashes && ship.muzzleFlashes.length) {
    // Compact array in-place to avoid filter allocation
    let writeIndex = 0;
    for (let i = 0; i < ship.muzzleFlashes.length; i++) {
      if (state.time - ship.muzzleFlashes[i].t0 < MUZZLE_FLASH_LIFETIME) {
        ship.muzzleFlashes[writeIndex++] = ship.muzzleFlashes[i];
      }
    }
    ship.muzzleFlashes.length = writeIndex;
  }
}
