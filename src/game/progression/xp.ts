import type { GameState, ShipComponent } from '../../types/index.js';
import type { ProjectileCategory } from '../../types/combat.js';
import { XP_CONFIG } from '../../config/progression.js';
import { addProgressionEvent, shouldLogProgressionEvent } from './events.js';
import { checkLevelUp } from './leveling.js';

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
