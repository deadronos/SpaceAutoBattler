import type { ShipComponent, Subsystem, SubsystemType } from '../types/index.js';
import type { SeededRng } from '../utils/rng.js';
import { SUBSYSTEM_CONFIG, SUBSYSTEM_EFFECTS } from '../config/progression.js';

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

export function repairSubsystems(ship: ShipComponent, delta: number): void {
  const repairSpeedMultiplier = ship.captain?.repairSpeed ?? 1.0;
  const moraleBoost =
    ship.captain?.moraleAbility?.isActive && ship.captain.moraleAbility.effect === 'repair_boost'
      ? 2.0
      : 1.0;

  for (const subsystemType of SUBSYSTEM_CONFIG.repairPriority) {
    const subsystem = ship.subsystems[subsystemType];

    if (subsystem.hp < subsystem.maxHp) {
      const repairAmount = subsystem.repairRate * repairSpeedMultiplier * moraleBoost * delta;
      subsystem.hp = Math.min(subsystem.maxHp, subsystem.hp + repairAmount);
      updateSubsystemStatus(subsystem);
    }
  }
}

export function applySubsystemDamage(
  ship: ShipComponent,
  hullDamage: number,
  rng: SeededRng,
): void {
  if (rng.next() > SUBSYSTEM_CONFIG.criticalHitChance) return;

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

  const damageRange = SUBSYSTEM_CONFIG.subsystemDamageRange;
  const damageMultiplier = rng.range(damageRange[0], damageRange[1]);
  const subsystemDamage = Math.floor(hullDamage * damageMultiplier);

  const subsystem = ship.subsystems[selectedSubsystem];
  subsystem.hp = Math.max(0, subsystem.hp - subsystemDamage);

  updateSubsystemStatus(subsystem);
}

export function getSubsystemMultiplier(
  subsystemType: SubsystemType,
  status: Subsystem['status'],
): number {
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
