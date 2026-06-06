import type { GameState, ShipComponent, ShipEntity, Team } from '../../types/index.js';
import type { ProjectileCategory } from '../../types/combat.js';
import { SeededRng } from '../../utils/rng.js';
import type { DamageBreakdown } from './damageMath.js';

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
  let wasAlive = false;
  if (damageResult.hullDamage > 0) {
    const prevHp = component.hp;
    wasAlive = prevHp > 0;
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
