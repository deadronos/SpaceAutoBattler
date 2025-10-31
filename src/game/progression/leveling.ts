import type { GameState, ShipComponent, ShipLevelBonuses } from '../../types/index.js';
import { calculateLevelBonus, calculateXpForLevel } from '../../config/progression.js';
import { addProgressionEvent, shouldLogProgressionEvent } from './events.js';

export function createLevelBonusState(): ShipLevelBonuses {
  return {
    hull: 0,
    shield: 0,
    damage: 0,
    shieldRegen: 0,
    repairRate: 0,
    fireRate: 0,
  };
}

function ensureLevelBonuses(ship: ShipComponent): ShipLevelBonuses {
  if (!ship.levelBonuses) {
    ship.levelBonuses = createLevelBonusState();
  }
  return ship.levelBonuses;
}

function normaliseBonus(value: number): number {
  return Math.max(0, value);
}

function recoverBaseStat(current: number, previousBonus: number): number {
  if (!Number.isFinite(current) || current === 0) {
    return 0;
  }
  const divisor = 1 + Math.max(previousBonus, 0);
  if (divisor <= 0) {
    return 0;
  }
  return current / divisor;
}

/**
 * Apply a stat bonus using the standard pattern:
 * recover base stat, apply new bonus, update levelBonuses
 */
function applyStatBonus(
  currentValue: number,
  newBonus: number,
  previousBonus: number,
): number {
  const normalisedPrevious = normaliseBonus(previousBonus);
  const baseStat = recoverBaseStat(currentValue, normalisedPrevious);
  return baseStat * (1 + newBonus);
}

export function applyLevelUpBonuses(ship: ShipComponent): void {
  const levelBonuses = ensureLevelBonuses(ship);

  const hullBonus = normaliseBonus(calculateLevelBonus('hull', ship.level));
  const shieldBonus = normaliseBonus(calculateLevelBonus('shield', ship.level));
  const damageBonus = normaliseBonus(calculateLevelBonus('damage', ship.level));
  const shieldRegenBonus = normaliseBonus(calculateLevelBonus('shieldRegen', ship.level));
  const repairBonus = normaliseBonus(calculateLevelBonus('repairRate', ship.level));
  const fireRateBonus = normaliseBonus(calculateLevelBonus('fireRate', ship.level));

  // Hull: special case - also updates hp with healing
  const previousMaxHp = ship.maxHp;
  const newMaxHp = applyStatBonus(previousMaxHp, hullBonus, levelBonuses.hull);
  ship.maxHp = newMaxHp;
  ship.hp = Math.min(newMaxHp, ship.hp + (newMaxHp - previousMaxHp));
  levelBonuses.hull = hullBonus;

  // Shield
  ship.maxShield = applyStatBonus(ship.maxShield, shieldBonus, levelBonuses.shield);
  levelBonuses.shield = shieldBonus;

  // Damage
  ship.damage = applyStatBonus(ship.damage, damageBonus, levelBonuses.damage);
  levelBonuses.damage = damageBonus;

  // Shield Regen
  ship.shieldRegen = applyStatBonus(ship.shieldRegen ?? 0, shieldRegenBonus, levelBonuses.shieldRegen);
  levelBonuses.shieldRegen = shieldRegenBonus;

  // Fire Rate
  ship.fireRate = applyStatBonus(ship.fireRate, fireRateBonus, levelBonuses.fireRate);
  levelBonuses.fireRate = fireRateBonus;

  // Repair Rate: special case - applies to all subsystems
  for (const subsystem of Object.values(ship.subsystems)) {
    if (!subsystem) continue;
    subsystem.repairRate = applyStatBonus(subsystem.repairRate, repairBonus, levelBonuses.repairRate);
  }
  levelBonuses.repairRate = repairBonus;
}

export function checkLevelUp(
  ship: ShipComponent,
  state?: GameState | null,
  shipId?: number,
): boolean {
  let leveledUp = false;

  while (ship.xp >= ship.xpToNext) {
    const oldLevel = ship.level;
    ship.level += 1;
    ship.xp -= ship.xpToNext;
    ship.xpToNext = calculateXpForLevel(ship.level + 1) - calculateXpForLevel(ship.level);

    if (shouldLogProgressionEvent(state, shipId)) {
      addProgressionEvent(state, shipId!, {
        type: 'levelup',
        details: `Level ${oldLevel} → ${ship.level}`,
      });
    }

    applyLevelUpBonuses(ship);
    leveledUp = true;
  }

  return leveledUp;
}
