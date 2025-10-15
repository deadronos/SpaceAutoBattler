import type {
  ShipComponent,
  Captain,
  MoraleAbility,
  MoraleEffectType,
  Subsystem,
  SubsystemType,
  DamageType,
  ShipLevelBonuses,
  ProgressionEvent,
  GameState,
} from '../types/index.js';
import type { ProjectileCategory } from '../types/combat.js';
import { SeededRng } from '../utils/rng.js';
import {
  XP_CONFIG,
  CAPTAIN_CONFIG,
  MORALE_ABILITIES,
  SUBSYSTEM_CONFIG,
  SUBSYSTEM_EFFECTS,
  HULL_DAMAGE_TYPES,
  HULL_ARMOR_VALUES,
  calculateXpForLevel,
  calculateLevelBonus,
  getDamageEffectiveness,
} from '../config/progression.js';

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
 * Add a progression event for a ship
 */
function addProgressionEvent(
  state: GameState | null,
  shipId: number,
  event: Omit<ProgressionEvent, 'ts'>,
): void {
  if (!state) return;

  const events = state.progressionEvents.get(shipId) || [];
  const newEvent: ProgressionEvent = {
    ...event,
    ts: Date.now(),
  };

  events.push(newEvent);

  // Keep only the last N events per ship
  const MAX_EVENTS = 20;
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }

  state.progressionEvents.set(shipId, events);
}

/**
 * Award XP to a ship for dealing damage
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
  ship.xp += xpGained;

  // Track progression event
  if (state && shipId !== undefined) {
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

  checkLevelUp(ship, state, shipId);
}

/**
 * Award XP to a ship for killing an enemy
 */
export function awardKillXp(
  ship: ShipComponent,
  targetMaxHp: number,
  state?: GameState | null,
  shipId?: number,
): void {
  const xpGained = targetMaxHp * XP_CONFIG.killXpMultiplier;
  ship.xp += xpGained;

  // Track progression event
  if (state && shipId !== undefined) {
    addProgressionEvent(state, shipId, {
      type: 'kill',
      deltaXp: xpGained,
      details: `Enemy destroyed (${targetMaxHp.toFixed(0)} HP)`,
    });
  }

  checkLevelUp(ship, state, shipId);
}

/**
 * Check if a ship should level up and apply bonuses if so
 */
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

    // Track level-up event
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

/**
 * Apply stat bonuses when a ship levels up
 */
function applyLevelUpBonuses(ship: ShipComponent): void {
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
export function applySubsystemDamage(
  ship: ShipComponent,
  hullDamage: number,
  rng: SeededRng,
): void {
  if (rng.next() > SUBSYSTEM_CONFIG.criticalHitChance) return;

  // Select random subsystem based on weights
  const rand = rng.next();
  let selectedSubsystem: SubsystemType;

  if (rand < SUBSYSTEM_CONFIG.targetWeights.weapons) {
    selectedSubsystem = 'weapons';
  } else if (
    rand <
    SUBSYSTEM_CONFIG.targetWeights.weapons + SUBSYSTEM_CONFIG.targetWeights.engine
  ) {
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
export function updateSubsystemStatus(subsystem: Subsystem): void {
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
  const moraleBoost =
    ship.captain?.moraleAbility?.isActive && ship.captain.moraleAbility.effect === 'repair_boost'
      ? 2.0
      : 1.0;

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
  targetArmor: number,
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
  levelBonuses: ShipLevelBonuses;
  captain?: Captain;
  subsystems: Record<SubsystemType, Subsystem>;
  armor: number;
} {
  return {
    xp: 0,
    level: 1,
    xpToNext: calculateXpForLevel(2),
    damageType: HULL_DAMAGE_TYPES[hull] || 'kinetic',
    levelBonuses: createLevelBonusState(),
    captain: undefined,
    subsystems: createSubsystems(100), // Default HP for tests
    armor: HULL_ARMOR_VALUES[hull] || 10,
  };
}
