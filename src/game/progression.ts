import type { 
  ShipComponent, 
  ShipEntity, 
  Captain, 
  MoraleAbility,
  MoraleEffectType,
  Subsystem,
  SubsystemType,
  DamageType,
  GameState
} from '../types/index.js';
import { SeededRng } from '../utils/rng.js';
import {
  XP_CONFIG,
  LEVEL_BONUSES,
  CAPTAIN_CONFIG,
  MORALE_ABILITIES,
  SUBSYSTEM_CONFIG,
  SUBSYSTEM_EFFECTS,
  calculateXpForLevel,
  calculateLevelBonus,
  getDamageEffectiveness
} from '../config/progression.js';

/**
 * Award XP to a ship for dealing damage
 */
export function awardDamageXp(ship: ShipComponent, damageDealt: number): void {
  const xpGained = damageDealt * XP_CONFIG.damageXpMultiplier;
  ship.xp += xpGained;
  checkLevelUp(ship);
}

/**
 * Award XP to a ship for killing an enemy
 */
export function awardKillXp(ship: ShipComponent, targetMaxHp: number): void {
  const xpGained = targetMaxHp * XP_CONFIG.killXpMultiplier;
  ship.xp += xpGained;
  checkLevelUp(ship);
}

/**
 * Check if a ship should level up and apply bonuses if so
 */
export function checkLevelUp(ship: ShipComponent): boolean {
  let leveledUp = false;
  
  while (ship.xp >= ship.xpToNext) {
    ship.level += 1;
    ship.xp -= ship.xpToNext;
    ship.xpToNext = calculateXpForLevel(ship.level + 1) - calculateXpForLevel(ship.level);
    
    applyLevelUpBonuses(ship);
    leveledUp = true;
  }
  
  return leveledUp;
}

/**
 * Apply stat bonuses when a ship levels up
 */
function applyLevelUpBonuses(ship: ShipComponent): void {
  const hullBonus = calculateLevelBonus('hull', ship.level);
  const shieldBonus = calculateLevelBonus('shield', ship.level);
  const damageBonus = calculateLevelBonus('damage', ship.level);
  const shieldRegenBonus = calculateLevelBonus('shieldRegen', ship.level);
  const repairBonus = calculateLevelBonus('repairRate', ship.level);
  const fireRateBonus = calculateLevelBonus('fireRate', ship.level);

  // Apply percentage bonuses to base stats
  // Note: These bonuses are cumulative, so we calculate from base values
  // This would require storing base values, but for simplicity we'll apply incremental bonuses
  const hullIncrease = ship.maxHp * LEVEL_BONUSES.hull.bonus;
  const shieldIncrease = ship.maxShield * LEVEL_BONUSES.shield.bonus;
  const damageIncrease = ship.damage * LEVEL_BONUSES.damage.bonus;
  const shieldRegenIncrease = (ship.shieldRegen ?? 0) * LEVEL_BONUSES.shieldRegen.bonus;
  const fireRateIncrease = ship.fireRate * LEVEL_BONUSES.fireRate.bonus;
  
  ship.maxHp += hullIncrease;
  ship.hp += hullIncrease; // Also heal the ship
  ship.maxShield += shieldIncrease;
  ship.damage += damageIncrease;
  ship.shieldRegen = (ship.shieldRegen ?? 0) + shieldRegenIncrease;
  ship.fireRate += fireRateIncrease;
  
  // Apply repair rate bonus to all subsystems
  const repairIncrease = LEVEL_BONUSES.repairRate.bonus;
  for (const subsystem of Object.values(ship.subsystems)) {
    subsystem.repairRate += subsystem.repairRate * repairIncrease;
  }
}

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
  const repairSpeed = rng.range(CAPTAIN_CONFIG.repairSpeedRange[0], CAPTAIN_CONFIG.repairSpeedRange[1]);
  
  let moraleAbility: MoraleAbility | undefined;
  if (rng.next() < CAPTAIN_CONFIG.moraleAbilityChance) {
    const abilityTypes: MoraleEffectType[] = ['aggression_boost', 'repair_boost', 'accuracy_boost'];
    const selectedType = abilityTypes[Math.floor(rng.next() * abilityTypes.length)];
    const config = MORALE_ABILITIES[selectedType];
    
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
 * Create initial subsystems for a ship
 */
export function createSubsystems(maxHp: number): Record<SubsystemType, Subsystem> {
  const baseHp = Math.floor(maxHp * SUBSYSTEM_CONFIG.baseHpMultiplier);
  const baseRepairRate = baseHp * SUBSYSTEM_CONFIG.baseRepairRateMultiplier;
  
  return {
    engine: {
      hp: baseHp,
      maxHp: baseHp,
      status: 'online',
      repairRate: baseRepairRate,
    },
    weapons: {
      hp: baseHp,
      maxHp: baseHp,
      status: 'online',
      repairRate: baseRepairRate,
    },
    shields: {
      hp: baseHp,
      maxHp: baseHp,
      status: 'online',
      repairRate: baseRepairRate,
    },
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
 * Apply subsystem damage from a critical hit
 */
export function applySubsystemDamage(ship: ShipComponent, hullDamage: number, rng: SeededRng): void {
  if (rng.next() > SUBSYSTEM_CONFIG.criticalHitChance) return;
  
  // Select random subsystem based on weights
  const rand = rng.next();
  let selectedSubsystem: SubsystemType;
  
  if (rand < SUBSYSTEM_CONFIG.targetWeights.weapons) {
    selectedSubsystem = 'weapons';
  } else if (rand < SUBSYSTEM_CONFIG.targetWeights.weapons + SUBSYSTEM_CONFIG.targetWeights.engine) {
    selectedSubsystem = 'engine';
  } else {
    selectedSubsystem = 'shields';
  }
  
  // Calculate subsystem damage
  const damageRange = SUBSYSTEM_CONFIG.subsystemDamageRange;
  const damageMultiplier = rng.range(damageRange[0], damageRange[1]);
  const subsystemDamage = Math.floor(hullDamage * damageMultiplier);
  
  // Apply damage
  const subsystem = ship.subsystems[selectedSubsystem];
  subsystem.hp = Math.max(0, subsystem.hp - subsystemDamage);
  
  // Update status
  updateSubsystemStatus(subsystem);
}

/**
 * Update a subsystem's status based on its HP
 */
function updateSubsystemStatus(subsystem: Subsystem): void {
  const hpRatio = subsystem.hp / Math.max(1, subsystem.maxHp);
  
  if (hpRatio <= SUBSYSTEM_CONFIG.offlineThreshold) {
    subsystem.status = 'offline';
  } else if (hpRatio <= SUBSYSTEM_CONFIG.damagedThreshold) {
    subsystem.status = 'damaged';
  } else {
    subsystem.status = 'online';
  }
}

/**
 * Repair subsystems over time
 */
export function repairSubsystems(ship: ShipComponent, delta: number): void {
  const repairSpeedMultiplier = ship.captain?.repairSpeed ?? 1.0;
  const moraleBoost = ship.captain?.moraleAbility?.isActive && 
                     ship.captain.moraleAbility.effect === 'repair_boost' ? 2.0 : 1.0;
  
  // Repair in priority order
  for (const subsystemType of SUBSYSTEM_CONFIG.repairPriority) {
    const subsystem = ship.subsystems[subsystemType];
    
    if (subsystem.hp < subsystem.maxHp) {
      const repairAmount = subsystem.repairRate * repairSpeedMultiplier * moraleBoost * delta;
      subsystem.hp = Math.min(subsystem.maxHp, subsystem.hp + repairAmount);
      updateSubsystemStatus(subsystem);
    }
  }
}

/**
 * Get effective ship stats modified by subsystem damage
 */
export function getEffectiveStats(ship: ShipComponent): {
  speedMultiplier: number;
  damageMultiplier: number;
  shieldRegenMultiplier: number;
} {
  const engineMultiplier = getSubsystemMultiplier('engine', ship.subsystems.engine.status);
  const weaponsMultiplier = getSubsystemMultiplier('weapons', ship.subsystems.weapons.status);
  const shieldsMultiplier = getSubsystemMultiplier('shields', ship.subsystems.shields.status);
  
  return {
    speedMultiplier: engineMultiplier,
    damageMultiplier: weaponsMultiplier,
    shieldRegenMultiplier: shieldsMultiplier,
  };
}

/**
 * Get the stat multiplier for a subsystem based on its status
 */
function getSubsystemMultiplier(subsystemType: SubsystemType, status: Subsystem['status']): number {
  const effects = SUBSYSTEM_EFFECTS[subsystemType];
  
  switch (status) {
    case 'damaged':
      return effects.damaged;
    case 'offline':
      return effects.offline;
    case 'online':
    default:
      return 1.0;
  }
}

/**
 * Calculate effective damage after damage type effectiveness
 */
export function calculateEffectiveDamage(
  baseDamage: number,
  damageType: DamageType,
  targetShield: number,
  targetArmor: number
): { shieldDamage: number; armorDamage: number; hullDamage: number } {
  // If target has shields, damage hits shields first
  if (targetShield > 0) {
    const shieldEffectiveness = getDamageEffectiveness(damageType, 'shield');
    const effectiveShieldDamage = baseDamage * shieldEffectiveness;
    
    if (effectiveShieldDamage >= targetShield) {
      // Shield breaks, remaining damage goes to armor/hull
      const remainingDamage = effectiveShieldDamage - targetShield;
      const armorEffectiveness = getDamageEffectiveness(damageType, 'armor');
      const hullEffectiveness = getDamageEffectiveness(damageType, 'hull');
      
      // Armor absorbs some damage
      const armorAbsorption = Math.min(remainingDamage * 0.5, targetArmor * armorEffectiveness);
      const hullDamage = Math.max(0, (remainingDamage - armorAbsorption) * hullEffectiveness);
      
      return {
        shieldDamage: targetShield,
        armorDamage: armorAbsorption,
        hullDamage,
      };
    } else {
      // All damage absorbed by shields
      return {
        shieldDamage: effectiveShieldDamage,
        armorDamage: 0,
        hullDamage: 0,
      };
    }
  } else {
    // No shields, damage goes to armor/hull
    const armorEffectiveness = getDamageEffectiveness(damageType, 'armor');
    const hullEffectiveness = getDamageEffectiveness(damageType, 'hull');
    
    const armorAbsorption = Math.min(baseDamage * 0.5, targetArmor * armorEffectiveness);
    const hullDamage = Math.max(0, (baseDamage - armorAbsorption) * hullEffectiveness);
    
    return {
      shieldDamage: 0,
      armorDamage: armorAbsorption,
      hullDamage,
    };
  }
}

/**
 * Create progression defaults for tests
 */
export function createProgressionDefaults(hull: string): {
  xp: number;
  level: number;
  xpToNext: number;
  damageType: DamageType;
  captain?: Captain;
  subsystems: Record<SubsystemType, Subsystem>;
  armor: number;
} {
  return {
    xp: 0,
    level: 1,
    xpToNext: calculateXpForLevel(2),
    damageType: HULL_DAMAGE_TYPES[hull] || 'kinetic',
    captain: undefined,
    subsystems: createSubsystems(100), // Default HP for tests
    armor: HULL_ARMOR_VALUES[hull] || 10,
  };
}