import type { GameState, ShipComponent } from '../../types/index.js';
import type { ProjectileCategory } from '../../types/combat.js';
import { XP_CONFIG } from '../../config/progression.js';
import { addProgressionEvent, shouldLogProgressionEvent } from './events.js';
import { checkLevelUp } from './leveling.js';

/**
 * Awards XP to a ship for dealing damage.
 * Updates the ship's XP and checks for level ups.
 *
 * @param {ShipComponent} ship - The ship dealing damage.
 * @param {number} damageDealt - The amount of damage dealt.
 * @param {GameState | null} [state] - The game state (for logging).
 * @param {number} [shipId] - The ID of the ship (for logging).
 * @param {string | null} [weaponKey] - The weapon used (optional).
 * @param {ProjectileCategory | null} [weaponCategory] - The category of the weapon (optional).
 */
export function awardDamageXp(
  ship: ShipComponent,
  damageDealt: number,
  state?: GameState | null,
  shipId?: number,
  weaponKey?: string | null,
  weaponCategory?: ProjectileCategory | null,
): void {
  const xpGained = damageDealt * XP_CONFIG.damageXpMultiplier;

  // If a canonical entity for this ship exists on the GameState, prefer
  // updating that entity's ShipComponent to ensure the UI (which reads from
  // state.queries.ships.entities / state.shipById) sees the change.
  const targetShip = state && shipId !== undefined ? state.shipById?.get(shipId)?.ship ?? ship : ship;
  targetShip.xp += xpGained;

  // (debug logging removed)

  if (shouldLogProgressionEvent(state, shipId) && shipId !== undefined) {
    const weaponLabel = weaponKey ?? undefined;
    const categoryLabel = weaponCategory ?? undefined;
    const detailSuffix = weaponLabel
      ? categoryLabel
        ? ` with ${weaponLabel} [${categoryLabel}]`
        : ` with ${weaponLabel}`
      : '';

    addProgressionEvent(state, shipId, {
      type: 'damage',
      deltaXp: xpGained,
      source: weaponLabel,
      details: `${damageDealt.toFixed(1)} damage dealt${detailSuffix}`,
    });
  }

  checkLevelUp(targetShip, state, shipId);
}

/**
 * Awards XP to a ship for destroying an enemy.
 *
 * @param {ShipComponent} ship - The ship that scored the kill.
 * @param {number} targetMaxHp - The max HP of the destroyed target (used for XP calc).
 * @param {GameState | null} [state] - The game state.
 * @param {number} [shipId] - The ID of the ship.
 */
export function awardKillXp(
  ship: ShipComponent,
  targetMaxHp: number,
  state?: GameState | null,
  shipId?: number,
): void {
  const xpGained = targetMaxHp * XP_CONFIG.killXpMultiplier;
  const targetShip = state && shipId !== undefined ? state.shipById?.get(shipId)?.ship ?? ship : ship;
  targetShip.xp += xpGained;

  if (shouldLogProgressionEvent(state, shipId) && shipId !== undefined) {
    addProgressionEvent(state, shipId, {
      type: 'kill',
      deltaXp: xpGained,
      details: `Enemy destroyed (${targetMaxHp.toFixed(0)} HP)`,
    });
  }

  // (debug logging removed)

  checkLevelUp(targetShip, state, shipId);
}
