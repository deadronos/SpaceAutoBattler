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
  ship.xp += xpGained;

  if (shouldLogProgressionEvent(state, shipId)) {
    const weaponLabel = weaponKey ?? undefined;
    const categoryLabel = weaponCategory ?? undefined;
    const detailSuffix = weaponLabel
      ? categoryLabel
        ? ` with ${weaponLabel} [${categoryLabel}]`
        : ` with ${weaponLabel}`
      : '';

    addProgressionEvent(state, shipId!, {
      type: 'damage',
      deltaXp: xpGained,
      source: weaponLabel,
      details: `${damageDealt.toFixed(1)} damage dealt${detailSuffix}`,
    });
  }

  checkLevelUp(ship, state, shipId);
}

export function awardKillXp(
  ship: ShipComponent,
  targetMaxHp: number,
  state?: GameState | null,
  shipId?: number,
): void {
  const xpGained = targetMaxHp * XP_CONFIG.killXpMultiplier;
  ship.xp += xpGained;

  if (shouldLogProgressionEvent(state, shipId)) {
    addProgressionEvent(state, shipId!, {
      type: 'kill',
      deltaXp: xpGained,
      details: `Enemy destroyed (${targetMaxHp.toFixed(0)} HP)`,
    });
  }

  checkLevelUp(ship, state, shipId);
}
