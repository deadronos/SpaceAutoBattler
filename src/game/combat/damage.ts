import type { DamageType, GameState, ShipComponent, ShipEntity, Team } from '../../types/index.js';
import type { ProjectileCategory } from '../../types/combat.js';
import { getDamageEffectiveness } from '../../config/progression.js';
import { SeededRng } from '../../utils/rng.js';

/**
 * Result of a damage calculation broken down by component.
 */
export interface DamageBreakdown {
  shieldDamage: number;
  armorDamage: number;
  hullDamage: number;
}

export interface DamageSourceMeta {
  id?: number;
  team?: Team | number;
  bulletType?: string | null;
  category?: ProjectileCategory | null;
}

export interface DamageApplicationContext {
  state: GameState;
  ship: ShipEntity;
  source?: DamageSourceMeta;
  damageResult: DamageBreakdown;
  totalDamage: number;
  hullDamage: number;
}

export interface ShieldRippleCallbackContext {
  state: GameState;
  ship: ShipEntity;
  source?: DamageSourceMeta;
  strength: number;
}

export interface DamageApplicationCallbacks {
  onDamageApplied?: (context: DamageApplicationContext) => void;
  onKill?: (context: DamageApplicationContext) => void;
  emitShieldRipple?: (context: ShieldRippleCallbackContext) => void;
  applySubsystemDamage?: (ship: ShipComponent, hullDamage: number, rng: SeededRng) => void;
}

export interface ApplyDamageResultOptions {
  state: GameState;
  ship: ShipEntity;
  damageResult: DamageBreakdown;
  source?: DamageSourceMeta;
  rngSeed?: number;
  callbacks?: DamageApplicationCallbacks;
}

export interface DamageApplicationSummary {
  totalDamage: number;
  hullDamage: number;
  destroyed: boolean;
}

/**
 * Calculates the effective damage applied to shields, armor, and hull.
 *
 * @param {number} baseDamage - The incoming raw damage.
 * @param {DamageType} damageType - The type of damage.
 * @param {number} targetShield - Current shield HP.
 * @param {number} targetArmor - Current armor value.
 * @returns {DamageBreakdown} The calculated damage components.
 */
export function calculateEffectiveDamage(
  baseDamage: number,
  damageType: DamageType,
  targetShield: number,
  targetArmor: number,
): DamageBreakdown {
  const damage = Math.max(0, baseDamage);
  const shield = Math.max(0, targetShield);
  const armor = Math.max(0, targetArmor);

  if (shield > 0) {
    const shieldEffectiveness = getDamageEffectiveness(damageType, 'shield');
    const effectiveShieldDamage = damage * shieldEffectiveness;

    if (effectiveShieldDamage >= shield) {
      const rawDamageConsumed = shield / shieldEffectiveness;
      const remainingRawDamage = Math.max(0, damage - rawDamageConsumed);
      const armorEffectiveness = getDamageEffectiveness(damageType, 'armor');
      const hullEffectiveness = getDamageEffectiveness(damageType, 'hull');
      const maxArmorAbsorption = armor * armorEffectiveness;
      const armorAbsorption = Math.min(remainingRawDamage * 0.5, maxArmorAbsorption);
      const hullDamage = Math.max(0, (remainingRawDamage - armorAbsorption) * hullEffectiveness);

      return {
        shieldDamage: shield,
        armorDamage: armorAbsorption,
        hullDamage,
      };
    }

    return {
      shieldDamage: effectiveShieldDamage,
      armorDamage: 0,
      hullDamage: 0,
    };
  }

  const armorEffectiveness = getDamageEffectiveness(damageType, 'armor');
  const hullEffectiveness = getDamageEffectiveness(damageType, 'hull');
  const maxArmorAbsorption = armor * armorEffectiveness;
  const armorAbsorption = Math.min(damage * 0.5, maxArmorAbsorption);
  const hullDamage = Math.max(0, (damage - armorAbsorption) * hullEffectiveness);

  return {
    shieldDamage: 0,
    armorDamage: armorAbsorption,
    hullDamage,
  };
}

/**
 * Applies calculated damage to a ship entity and invokes callbacks.
 *
 * @param {ApplyDamageResultOptions} options - Configuration for applying damage.
 * @returns {DamageApplicationSummary} Summary of the applied damage.
 */
export function applyDamageResultToShip(
  options: ApplyDamageResultOptions,
): DamageApplicationSummary {
  const { state, ship, damageResult, source, callbacks } = options;
  const component = ship.ship;
  const totalDamage =
    damageResult.shieldDamage + damageResult.armorDamage + damageResult.hullDamage;

  const availableShield = Math.max(0, component.shield);
  const appliedShieldDamage = Math.min(availableShield, damageResult.shieldDamage);
  if (appliedShieldDamage > 0) {
    component.shield = Math.max(0, availableShield - appliedShieldDamage);
    const strength = Math.min(1, appliedShieldDamage / Math.max(1, component.maxShield));
    callbacks?.emitShieldRipple?.({ state, ship, source, strength });
  }

  if (damageResult.armorDamage > 0) {
    const decay = damageResult.armorDamage * 0.1;
    component.armor = Math.max(0, component.armor - decay);
  }

  let hullDamage = 0;
  // Track if ship was alive before this damage application
  const wasAlive = component.hp > 0;
  if (damageResult.hullDamage > 0) {
    const prevHp = component.hp;
    component.hp = Math.max(0, prevHp - damageResult.hullDamage);
    hullDamage = Math.max(0, prevHp - component.hp);

    if (hullDamage > 0 && callbacks?.applySubsystemDamage) {
      const seed = options.rngSeed ?? ship.id + state.time;
      const rng = new SeededRng(seed);
      callbacks.applySubsystemDamage(component, hullDamage, rng);
    }
  }

  const context: DamageApplicationContext = {
    state,
    ship,
    source,
    damageResult,
    totalDamage,
    hullDamage,
  };

  if (totalDamage > 0) {
    callbacks?.onDamageApplied?.(context);
  }

  // Check if ship transitioned to dead state (was alive, now dead)
  // This ensures onKill fires only once on the killing blow, not on subsequent hits
  const destroyed = component.hp <= 0;
  if (destroyed && wasAlive) {
    callbacks?.onKill?.(context);
  }

  return {
    totalDamage,
    hullDamage,
    destroyed,
  };
}
