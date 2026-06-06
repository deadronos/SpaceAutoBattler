import type { DamageType } from '../../types/index.js';
import { getDamageEffectiveness } from '../../config/progression.js';

/**
 * Result of a damage calculation broken down by component.
 */
export interface DamageBreakdown {
  shieldDamage: number;
  armorDamage: number;
  hullDamage: number;
}

/**
 * Calculates the effective damage applied to shields, armor, and hull.
 * Pure function — no side effects.
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
