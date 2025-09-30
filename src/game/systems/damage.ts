import { Vector3 } from 'three';
import type {
  GameEntity,
  GameState,
  ProjectileEntity,
  ShipEntity,
  ShieldRipple,
} from '../../types/index.js';
import { PROJECTILE_CONFIG, DEFAULT_PROJECTILE_CONFIG } from '../../config/projectiles.js';
import {
  applySubsystemDamage,
  awardDamageXp,
  awardKillXp,
  calculateEffectiveDamage,
} from '../progression.js';
import { emitShipKillExplosion } from '../explosions.js';
import { destroyEntity } from '../state.js';
import { AI_CONFIG } from '../config.js';
import { SeededRng } from '../../utils/rng.js';
import {
  accumulateInterruptDamage,
  ensureInterruptState,
  getInterruptQueue,
  queueInterrupt,
  queueTargetLossInterrupts,
} from './decision/interrupts.js';
import { TEMP_DIR } from './projectiles.js';

export function resolveProjectiles(state: GameState, delta: number): void {
  const ships = state.queries.ships.entities as ShipEntity[];
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  const toRemove = new Set<GameEntity>();
  const manager = state.ai;
  if (manager) {
    ensureInterruptState(manager);
    getInterruptQueue(manager);
  }

  for (const projectile of projectiles) {
    projectile.projectile.ttl -= delta;
    if (projectile.projectile.ttl <= 0) {
      toRemove.add(projectile);
      continue;
    }

    for (const ship of ships) {
      if (ship.ship.team === projectile.projectile.team) continue;
      const distance = ship.transform.position.distanceTo(projectile.transform.position);
      const projCfg = PROJECTILE_CONFIG[projectile.projectile.bulletType ?? ''] ?? DEFAULT_PROJECTILE_CONFIG;
      const projRadius = projCfg.colliderRadius ?? Math.max(0.08, projectile.transform.scale * 1.2);
      const impactRadius = ship.transform.scale * 0.9 + projRadius;
      if (distance > impactRadius) continue;

      const damageResult = calculateEffectiveDamage(
        projectile.projectile.damage,
        projectile.projectile.damageType,
        ship.ship.shield,
        ship.ship.armor,
      );

      if (damageResult.shieldDamage > 0) {
        ship.ship.shield -= damageResult.shieldDamage;
        const dir = TEMP_DIR.copy(projectile.transform.position).sub(ship.transform.position);
        if (dir.lengthSq() > 1e-5) dir.normalize();
        else dir.set(0, 0, 1);
        const strength = Math.min(1, damageResult.shieldDamage / Math.max(1, ship.ship.maxShield));
        const ripple: ShieldRipple = { dir: dir.clone(), t0: state.time, amp: strength };
        const list = (ship.shieldRipples ??= []);
        list.push(ripple);
        if (list.length > 64) list.shift();
      }

      if (damageResult.armorDamage > 0) {
        ship.ship.armor = Math.max(0, ship.ship.armor - damageResult.armorDamage * 0.1);
      }

      let hullDamage = 0;
      if (damageResult.hullDamage > 0) {
        const prevHp = ship.ship.hp;
        ship.ship.hp -= damageResult.hullDamage;
        hullDamage = Math.max(0, prevHp - ship.ship.hp);
        applySubsystemDamage(ship.ship, hullDamage, new SeededRng(projectile.id + state.time));
      }

      toRemove.add(projectile);

      const totalDamageDealt = damageResult.shieldDamage + damageResult.armorDamage + damageResult.hullDamage;
      if (totalDamageDealt > 0) {
        const attackerShip = ships.find((s) => s.ship.team === projectile.projectile.team);
        if (attackerShip) {
          awardDamageXp(attackerShip.ship, totalDamageDealt, state, attackerShip.id);
        }
      }

      if (manager && hullDamage > 0) {
        const totalDamage = accumulateInterruptDamage(manager, ship.id, hullDamage, manager.tickIndex);
        const maxHp = Math.max(1, ship.ship.maxHp);
        if (totalDamage / maxHp >= (AI_CONFIG.interruptHpDrop ?? 0.1)) {
          queueInterrupt(manager, {
            shipId: ship.id,
            reason: 'hp-drop',
            tick: manager.tickIndex,
            sourceId: projectile.id,
          });
        }
      }

      if (ship.ship.hp <= 0) {
        if (manager) {
          queueTargetLossInterrupts(state, ships, ship.id);
        }

        const killerShip = ships.find((s) => s.ship.team === projectile.projectile.team);
        if (killerShip) {
          awardKillXp(killerShip.ship, ship.ship.maxHp, state, killerShip.id);
        }

        emitShipKillExplosion(state, ship, projectile);
        toRemove.add(ship);
      }
      break;
    }
  }

  for (const entity of toRemove) {
    destroyEntity(state, entity);
  }
}
