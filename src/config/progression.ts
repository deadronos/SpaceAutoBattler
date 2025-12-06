import type {
  DamageEffectiveness,
  DamageType,
  MoraleEffectType,
  SubsystemType,
} from '../types/index.js';

/**
 * Configuration for the ship progression system
 */

// XP System Configuration
/**
 * Configuration for the XP system scaling and multipliers.
 */
export const XP_CONFIG = {
  /** XP multiplier for damage dealt (XP = damage * this value) */
  damageXpMultiplier: 0.5,
  /** XP bonus for killing an enemy (XP = target.maxHp * this value) */
  killXpMultiplier: 0.5,
  /** Base XP required for level 2 */
  baseXp: 100,
  /** Exponent for XP curve scaling (XP required = baseXp * level^exponent) */
  xpExponent: 1.8,
} as const;

// Level-up Bonus Configuration (percentage bonuses per level)
/**
 * Configuration for bonuses gained at each level.
 */
export const LEVEL_BONUSES = {
  hull: { bonus: 0.05, cap: 0.5, maxLevel: 10 }, // +5% maxHp per level, cap at +50%
  shield: { bonus: 0.05, cap: 0.5, maxLevel: 10 }, // +5% maxShield per level, cap at +50%
  damage: { bonus: 0.03, cap: 0.3, maxLevel: 10 }, // +3% damage per level, cap at +30%
  shieldRegen: { bonus: 0.04, cap: 0.4, maxLevel: 10 }, // +4% shieldRegen per level, cap at +40%
  repairRate: { bonus: 0.05, cap: 0.5, maxLevel: 10 }, // +5% repair rate per level, cap at +50%
  fireRate: { bonus: 0.02, cap: 0.15, maxLevel: 8 }, // +2% fire rate per level, cap at +15% (performance)
} as const;

// Damage Type Effectiveness Matrix
/**
 * Damage type effectiveness modifiers against hull, shield, and armor.
 */
export const DAMAGE_EFFECTIVENESS: DamageEffectiveness = {
  kinetic: { hull: 1.0, shield: 0.8, armor: 1.2 }, // Good vs armor, poor vs shields
  plasma: { hull: 1.1, shield: 0.9, armor: 1.3 }, // Best vs armor, decent overall
  ion: { hull: 0.7, shield: 1.4, armor: 0.9 }, // Excellent vs shields, poor vs hull
  explosive: { hull: 1.2, shield: 0.6, armor: 1.1 }, // Great vs hull, terrible vs shields
};

// Captain System Configuration
/**
 * Configuration for the Captain system.
 */
export const CAPTAIN_CONFIG = {
  /** Probability of destroyer having a captain */
  destroyerCaptainChance: 0.8,
  /** Probability of carrier having a captain */
  carrierCaptainChance: 1.0,
  /** Range for captain accuracy trait */
  accuracyRange: [0.85, 1.15] as const,
  /** Range for captain repair speed trait */
  repairSpeedRange: [0.8, 1.2] as const,
  /** Probability of captain having a morale ability */
  moraleAbilityChance: 0.7,
} as const;

// Morale Ability Configuration
/**
 * Configuration for morale-triggered abilities.
 */
export const MORALE_ABILITIES: Record<
  MoraleEffectType,
  {
    duration: number;
    cooldown: number;
    description: string;
  }
> = {
  aggression_boost: {
    duration: 10,
    cooldown: 60,
    description: 'Increases attack intent weights by 50%',
  },
  repair_boost: {
    duration: 8,
    cooldown: 90,
    description: 'Doubles repair rate for all subsystems',
  },
  accuracy_boost: {
    duration: 12,
    cooldown: 75,
    description: 'Increases hit chance by 25%',
  },
};

// Subsystem Configuration
/**
 * Configuration for subsystem health and repair.
 */
export const SUBSYSTEM_CONFIG = {
  /** Base HP multiplier relative to ship max HP */
  baseHpMultiplier: 0.3,
  /** Base repair rate multiplier relative to subsystem max HP per second */
  baseRepairRateMultiplier: 0.1,
  /** Chance for any damage to cause subsystem damage */
  criticalHitChance: 0.15,
  /** Range of subsystem damage as percentage of hull damage received */
  subsystemDamageRange: [0.2, 0.4] as const,
  /** HP threshold for 'damaged' status */
  damagedThreshold: 0.5,
  /** HP threshold for 'offline' status */
  offlineThreshold: 0.25,
  /** Subsystem selection weights for critical hits */
  targetWeights: {
    weapons: 0.4,
    engine: 0.35,
    shields: 0.25,
  } as Record<SubsystemType, number>,
  /** Repair priority order (0 = highest priority) */
  repairPriority: ['shields', 'weapons', 'engine'] as SubsystemType[],
} as const;

// Subsystem Status Effect Configuration
/**
 * Configuration for effects applied when subsystems are damaged/offline.
 */
export const SUBSYSTEM_EFFECTS = {
  engine: {
    damaged: 0.75, // -25% speed
    offline: 0.5, // -50% speed
  },
  weapons: {
    damaged: 0.7, // -30% damage
    offline: 0.4, // -60% damage
  },
  shields: {
    damaged: 0.7, // -30% shield regen
    offline: 0.0, // no shield regen
  },
} as const;

// Default damage types for each hull class
/**
 * Default damage type assignments for each hull class.
 */
export const HULL_DAMAGE_TYPES: Record<string, DamageType> = {
  fighter: 'kinetic', // Fast, balanced
  corvette: 'kinetic', // Similar role to fighters
  frigate: 'plasma', // Heavier weapons
  destroyer: 'plasma', // Dedicated warships
  carrier: 'ion', // Anti-shield for bomber support
};

// Default armor values for each hull class
/**
 * Default armor values for each hull class.
 */
export const HULL_ARMOR_VALUES: Record<string, number> = {
  fighter: 5, // Light armor
  corvette: 8, // Light-medium armor
  frigate: 12, // Medium armor
  destroyer: 18, // Heavy armor
  carrier: 15, // Medium-heavy armor (big but not as armored as destroyer)
};

/**
 * Calculate XP required to reach a specific level
 *
 * @param {number} level - The target level.
 * @returns {number} The XP required.
 */
export function calculateXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(XP_CONFIG.baseXp * Math.pow(level - 1, XP_CONFIG.xpExponent));
}

/**
 * Calculate the level bonus multiplier for a given stat and current level
 *
 * @param {keyof typeof LEVEL_BONUSES} stat - The stat to calculate.
 * @param {number} level - The current ship level.
 * @returns {number} The bonus multiplier.
 */
export function calculateLevelBonus(stat: keyof typeof LEVEL_BONUSES, level: number): number {
  const config = LEVEL_BONUSES[stat];
  const effectiveLevels = Math.min(level - 1, config.maxLevel); // Level 1 = no bonus
  const rawBonus = effectiveLevels * config.bonus;
  return Math.min(rawBonus, config.cap);
}

/**
 * Get effective damage multiplier for a damage type against a defense type
 *
 * @param {DamageType} damageType - The type of damage being dealt.
 * @param {'hull' | 'shield' | 'armor'} defenseType - The type of defense being hit.
 * @returns {number} The damage effectiveness multiplier.
 */
export function getDamageEffectiveness(
  damageType: DamageType,
  defenseType: 'hull' | 'shield' | 'armor',
): number {
  return DAMAGE_EFFECTIVENESS[damageType]?.[defenseType] ?? 1.0;
}
