import type { GameState, ShipEntity } from '../../../types/index.js';
import { updateCaptainAbilities, repairSubsystems, getEffectiveStats } from '../../progression.js';

const MUZZLE_FLASH_LIFETIME = 0.25;

export function updateShipLifecycle(state: GameState, ship: ShipEntity, delta: number): void {
  ship.ship.cooldown = Math.max(0, ship.ship.cooldown - delta);
  if (ship.turrets) {
    for (const turret of ship.turrets) {
      turret.cooldown = Math.max(0, turret.cooldown - delta);
    }
  }

  updateCaptainAbilities(ship.ship, state.time, delta);
  repairSubsystems(ship.ship, delta);

  const effectiveStats = getEffectiveStats(ship.ship);
  const regen = (ship.ship.shieldRegen ?? 0) * effectiveStats.shieldRegenMultiplier;
  if (regen > 0 && ship.ship.shield < ship.ship.maxShield) {
    ship.ship.shield = Math.min(ship.ship.maxShield, ship.ship.shield + regen * delta);
  }

  if (ship.muzzleFlashes && ship.muzzleFlashes.length) {
    ship.muzzleFlashes = ship.muzzleFlashes.filter(
      (m) => state.time - m.t0 < MUZZLE_FLASH_LIFETIME,
    );
  }
}
