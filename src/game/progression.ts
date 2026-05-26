import type {
  ShipComponent,
  Captain,
  MoraleAbility,
  MoraleEffectType,
  Subsystem,
  SubsystemType,
  DamageType,
  ShipLevelBonuses,
} from '../types/index.js';
import { SeededRng } from '../utils/rng.js';
import {
  CAPTAIN_CONFIG,
  MORALE_ABILITIES,
  HULL_DAMAGE_TYPES,
  HULL_ARMOR_VALUES,
  calculateXpForLevel,
} from '../config/progression.js';
import {
  createSubsystems as createSubsystemsInternal,
  getSubsystemMultiplier as getSubsystemMultiplierInternal,
} from './subsystems.js';
import { createLevelBonusState } from './progression/leveling.js';
export { calculateEffectiveDamage } from './combat/damage.js';
export * from './progression/index.js';
export {
  applySubsystemDamage,
  createSubsystems,
  getSubsystemMultiplier,
  repairSubsystems,
  updateSubsystemStatus,
} from './subsystems.js';

/**
 * Generate a captain for a ship (if eligible)
 */
export function generateCaptain(hull: string, shipSeed: number): Captain | undefined {
  const rng = new SeededRng(shipSeed);

  let shouldHaveCaptain = false;
  if (hull === 'destroyer') {
    shouldHaveCaptain = rng.next() < CAPTAIN_CONFIG.destroyerCaptainChance;
  } else if (hull === 'carrier') {
    shouldHaveCaptain = rng.next() < CAPTAIN_CONFIG.carrierCaptainChance;
  }

  if (!shouldHaveCaptain) return undefined;

  const accuracy = rng.range(CAPTAIN_CONFIG.accuracyRange[0], CAPTAIN_CONFIG.accuracyRange[1]);
  const repairSpeed = rng.range(
    CAPTAIN_CONFIG.repairSpeedRange[0],
    CAPTAIN_CONFIG.repairSpeedRange[1],
  );

  let moraleAbility: MoraleAbility | undefined;
  if (rng.next() < CAPTAIN_CONFIG.moraleAbilityChance) {
    const abilityTypes: MoraleEffectType[] = ['aggression_boost', 'repair_boost', 'accuracy_boost'];
    const selectedType =
      abilityTypes[Math.floor(rng.next() * abilityTypes.length)] ?? 'aggression_boost';
    const config = MORALE_ABILITIES[selectedType] ?? MORALE_ABILITIES.aggression_boost;

    moraleAbility = {
      cooldownRemaining: 0,
      maxCooldown: config.cooldown,
      duration: config.duration,
      effect: selectedType,
      isActive: false,
      activeUntil: 0,
    };
  }

  return {
    accuracy,
    repairSpeed,
    moraleAbility,
  };
}

/**
 * Update captain abilities (cooldowns and active effects)
 */
export function updateCaptainAbilities(ship: ShipComponent, gameTime: number, delta: number): void {
  if (!ship.captain?.moraleAbility) return;

  const ability = ship.captain.moraleAbility;

  // Update cooldown
  if (ability.cooldownRemaining > 0) {
    ability.cooldownRemaining = Math.max(0, ability.cooldownRemaining - delta);
  }

  // Check if active effect should expire
  if (ability.isActive && gameTime >= ability.activeUntil) {
    ability.isActive = false;
  }
}

/**
 * Activate a captain's morale ability
 */
export function activateMoraleAbility(ship: ShipComponent, gameTime: number): boolean {
  const ability = ship.captain?.moraleAbility;
  if (!ability || ability.cooldownRemaining > 0 || ability.isActive) {
    return false;
  }

  ability.isActive = true;
  ability.activeUntil = gameTime + ability.duration;
  ability.cooldownRemaining = ability.maxCooldown;

  return true;
}

/**
 * Get effective ship stats modified by subsystem damage
 */
export function getEffectiveStats(ship: ShipComponent): {
  speedMultiplier: number;
  damageMultiplier: number;
  shieldRegenMultiplier: number;
} {
  const engineMultiplier = getSubsystemMultiplierInternal('engine', ship.subsystems.engine.status);
  const weaponsMultiplier = getSubsystemMultiplierInternal(
    'weapons',
    ship.subsystems.weapons.status,
  );
  const shieldsMultiplier = getSubsystemMultiplierInternal(
    'shields',
    ship.subsystems.shields.status,
  );

  return {
    speedMultiplier: engineMultiplier,
    damageMultiplier: weaponsMultiplier,
    shieldRegenMultiplier: shieldsMultiplier,
  };
}

/**
 * Create progression defaults for tests
 */
export function createProgressionDefaults(hull: string): {
  xp: number;
  level: number;
  xpToNext: number;
  damageType: DamageType;
  levelBonuses: ShipLevelBonuses;
  captain?: Captain;
  subsystems: Record<SubsystemType, Subsystem>;
  armor: number;
} {
  return {
    xp: 0,
    level: 1,
    xpToNext: calculateXpForLevel(2),
    damageType: HULL_DAMAGE_TYPES[hull] ?? 'kinetic',
    levelBonuses: createLevelBonusState(),
    captain: undefined,
    subsystems: createSubsystemsInternal(100), // Default HP for tests
    armor: HULL_ARMOR_VALUES[hull] ?? 10,
  };
}
