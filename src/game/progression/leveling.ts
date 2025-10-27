import type { GameState, ShipComponent, ShipLevelBonuses } from '../../types/index.js';
import { calculateLevelBonus, calculateXpForLevel } from '../../config/progression.js';
import { addProgressionEvent } from './events.js';

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

export function applyLevelUpBonuses(ship: ShipComponent): void {
  const levelBonuses = ensureLevelBonuses(ship);

  const hullBonus = normaliseBonus(calculateLevelBonus('hull', ship.level));
  const shieldBonus = normaliseBonus(calculateLevelBonus('shield', ship.level));
  const damageBonus = normaliseBonus(calculateLevelBonus('damage', ship.level));
  const shieldRegenBonus = normaliseBonus(calculateLevelBonus('shieldRegen', ship.level));
  const repairBonus = normaliseBonus(calculateLevelBonus('repairRate', ship.level));
  const fireRateBonus = normaliseBonus(calculateLevelBonus('fireRate', ship.level));

  const previousHullBonus = normaliseBonus(levelBonuses.hull);
  const previousMaxHp = ship.maxHp;
  const baseMaxHp = recoverBaseStat(previousMaxHp, previousHullBonus);
  const newMaxHp = baseMaxHp * (1 + hullBonus);
  ship.maxHp = newMaxHp;
  ship.hp = Math.min(newMaxHp, ship.hp + (newMaxHp - previousMaxHp));
  levelBonuses.hull = hullBonus;

  const previousShieldBonus = normaliseBonus(levelBonuses.shield);
  const baseMaxShield = recoverBaseStat(ship.maxShield, previousShieldBonus);
  ship.maxShield = baseMaxShield * (1 + shieldBonus);
  levelBonuses.shield = shieldBonus;

  const previousDamageBonus = normaliseBonus(levelBonuses.damage);
  const baseDamage = recoverBaseStat(ship.damage, previousDamageBonus);
  ship.damage = baseDamage * (1 + damageBonus);
  levelBonuses.damage = damageBonus;

  const previousShieldRegenBonus = normaliseBonus(levelBonuses.shieldRegen);
  const baseShieldRegen = recoverBaseStat(ship.shieldRegen ?? 0, previousShieldRegenBonus);
  const updatedShieldRegen = baseShieldRegen * (1 + shieldRegenBonus);
  ship.shieldRegen = updatedShieldRegen;
  levelBonuses.shieldRegen = shieldRegenBonus;

  const previousFireRateBonus = normaliseBonus(levelBonuses.fireRate);
  const baseFireRate = recoverBaseStat(ship.fireRate, previousFireRateBonus);
  ship.fireRate = baseFireRate * (1 + fireRateBonus);
  levelBonuses.fireRate = fireRateBonus;

  const previousRepairBonus = normaliseBonus(levelBonuses.repairRate);
  for (const subsystem of Object.values(ship.subsystems)) {
    if (!subsystem) continue;
    const baseRepairRate = recoverBaseStat(subsystem.repairRate, previousRepairBonus);
    subsystem.repairRate = baseRepairRate * (1 + repairBonus);
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

    if (state && shipId !== undefined) {
      addProgressionEvent(state, shipId, {
        type: 'levelup',
        details: `Level ${oldLevel} → ${ship.level}`,
      });
    }

    applyLevelUpBonuses(ship);
    leveledUp = true;
  }

  return leveledUp;
}
