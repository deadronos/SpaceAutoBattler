import type { GameState, ProjectileEntity, ShipEntity, ShieldRipple } from '../../types/index.js';
import { resolveProjectileCategory } from '../../utils/projectileInfo.js';
import { awardDamageXp, awardKillXp } from '../progression.js';
import { applySubsystemDamage } from '../subsystems.js';
import { applyDamageResultToShip, calculateEffectiveDamage } from '../combat/damage.js';
import { emitShipKillExplosion } from '../explosions.js';
import { AI_CONFIG } from '../config.js';
import {
  accumulateInterruptDamage,
  queueInterrupt,
  queueTargetLossInterrupts,
} from './decision/interrupts.js';
import { safeNormalize } from '../../utils/steering.js';
import { appendCappedMutable } from '../../utils/cappedBuffer.js';
import type { SpatialHash } from '../utils/spatialHash.js';
import { TEMP_PROJECTILE_DAMAGE_RIPPLE_DIR as TEMP_RIPPLE_DIR } from '../../utils/tempVectors.js';

// Per-state reusable buffers. Keyed off GameState so two states stepped in the
// same process cannot share scratch data (see src/game/AGENTS.md).
export interface ProjectileDamageBuffers {
  shipHash: SpatialHash<ShipEntity> | null;
  shipsById: Map<number, ShipEntity>;
}

const damageBuffersByState = new WeakMap<GameState, ProjectileDamageBuffers>();

export function getDamageBuffers(state: GameState): ProjectileDamageBuffers {
  let buffers = damageBuffersByState.get(state);
  if (!buffers) {
    buffers = { shipHash: null, shipsById: new Map() };
    damageBuffersByState.set(state, buffers);
  }
  return buffers;
}

/**
 * Result of applying projectile damage.
 */
export interface ProjectileDamageOutcome {
  totalDamage: number;
  hullDamage: number;
  destroyed: boolean;
}

/**
 * Applies damage from a projectile impact to a ship.
 *
 * @param {GameState} state - The game state.
 * @param {ProjectileEntity} projectile - The projectile that hit.
 * @param {ShipEntity} ship - The ship that was hit.
 * @param {ShipEntity[]} ships - List of all ships (for context).
 * @param {Map<number, ShipEntity>} shipsById - Lookup map for ships.
 * @returns {ProjectileDamageOutcome} The outcome of the damage application.
 */
export function applyProjectileDamage(
  state: GameState,
  projectile: ProjectileEntity,
  ship: ShipEntity,
  ships: ShipEntity[],
  shipsById: Map<number, ShipEntity>,
): ProjectileDamageOutcome {
  const projectileCategory =
    projectile.projectile.category ?? resolveProjectileCategory(projectile.projectile.bulletType);
  const damageResult = calculateEffectiveDamage(
    projectile.projectile.damage,
    projectile.projectile.damageType,
    ship.ship.shield,
    ship.ship.armor,
  );

  const manager = state.ai;
  const sourceMeta = {
    id: projectile.projectile.sourceId ?? undefined,
    team: projectile.projectile.team,
    bulletType: projectile.projectile.bulletType,
    category: projectileCategory,
  };
  const attackerShip = sourceMeta.id
    ? shipsById.get(sourceMeta.id)
    : ships.find((s) => s.ship.team === sourceMeta.team);

  const outcome = applyDamageResultToShip({
    state,
    ship,
    damageResult,
    source: sourceMeta,
    rngSeed: projectile.id + state.time,
    callbacks: {
      emitShieldRipple: ({ strength }) => {
        TEMP_RIPPLE_DIR.copy(projectile.transform.position).sub(ship.transform.position);
        safeNormalize(TEMP_RIPPLE_DIR, TEMP_RIPPLE_DIR);
        const ripple: ShieldRipple = {
          dir: TEMP_RIPPLE_DIR.clone(),
          t0: state.time,
          amp: strength,
        };
        const list = (ship.shieldRipples ??= []);
        appendCappedMutable(list, ripple, 64);
      },
      applySubsystemDamage: (component, hullDamage, rng) => {
        applySubsystemDamage(component, hullDamage, rng);
      },
      onDamageApplied: ({ totalDamage, hullDamage }) => {
        if (totalDamage > 0 && attackerShip) {
          awardDamageXp(
            attackerShip.ship,
            totalDamage,
            state,
            attackerShip.id,
            projectile.projectile.bulletType,
            projectileCategory,
          );
        }

        if (manager && hullDamage > 0) {
          const accumulated = accumulateInterruptDamage(
            manager,
            ship.id,
            hullDamage,
            manager.tickIndex,
          );
          const maxHp = Math.max(1, ship.ship.maxHp);
          if (accumulated / maxHp >= (AI_CONFIG.interruptHpDrop ?? 0.1)) {
            queueInterrupt(manager, {
              shipId: ship.id,
              reason: 'hp-drop',
              tick: manager.tickIndex,
              sourceId: projectile.id,
            });
          }
        }
      },
      onKill: () => {
        if (manager) {
          queueTargetLossInterrupts(state, ships, ship.id);
        }
        if (attackerShip) {
          awardKillXp(attackerShip.ship, ship.ship.maxHp, state, attackerShip.id);
        }
        emitShipKillExplosion(state, ship, projectile);
      },
    },
  });

  return outcome;
}
