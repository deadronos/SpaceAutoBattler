import type {
  GameEntity,
  GameState,
  ProjectileEntity,
  ShipEntity,
  ShieldRipple,
} from '../../types/index.js';
import { resolveProjectileCategory, resolveProjectileInfo } from '../../utils/projectileInfo.js';
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
import type { ProjectileCategory } from '../../types/combat.js';
import { TEMP_DIR } from './projectiles.js';

export interface ProjectileDamageOutcome {
  totalDamage: number;
  hullDamage: number;
  destroyed: boolean;
}

export function applyProjectileDamage(
  state: GameState,
  projectile: ProjectileEntity,
  ship: ShipEntity,
  ships: ShipEntity[],
): ProjectileDamageOutcome {
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

  const totalDamageDealt =
    damageResult.shieldDamage + damageResult.armorDamage + damageResult.hullDamage;
  if (totalDamageDealt > 0) {
    const attackerShip = projectile.projectile.sourceId
      ? ships.find((s) => s.id === projectile.projectile.sourceId)
      : ships.find((s) => s.ship.team === projectile.projectile.team);
    if (attackerShip) {
      const projectileCategory =
        projectile.projectile.category ?? resolveProjectileCategory(projectile.projectile.bulletType);
      awardDamageXp(
        attackerShip.ship,
        totalDamageDealt,
        state,
        attackerShip.id,
        projectile.projectile.bulletType,
        projectileCategory,
      );
    }
  }

  const manager = state.ai;
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

  const destroyed = ship.ship.hp <= 0;
  if (destroyed) {
    if (manager) {
      queueTargetLossInterrupts(state, ships, ship.id);
    }

    const killerShip = projectile.projectile.sourceId
      ? ships.find((s) => s.id === projectile.projectile.sourceId)
      : ships.find((s) => s.ship.team === projectile.projectile.team);
    if (killerShip) {
      awardKillXp(killerShip.ship, ship.ship.maxHp, state, killerShip.id);
    }

    emitShipKillExplosion(state, ship, projectile);
  }

  return { totalDamage: totalDamageDealt, hullDamage, destroyed };
}

function isProjectileArmed(projectile: ProjectileEntity, now: number): boolean {
  const armingTime = projectile.projectile.armingTime ?? 0;
  if (armingTime <= 0) return true;
  const spawnTime = projectile.projectile.spawnTime;
  if (spawnTime == null) return true;
  return now - spawnTime >= armingTime;
}

function handleBeamProjectile(
  state: GameState,
  projectile: ProjectileEntity,
  ships: ShipEntity[],
  toRemove: Set<GameEntity>,
  delta: number,
): void {
  const beam = projectile.projectile.beam;
  projectile.projectile.ttl -= delta;
  if (!beam) {
    toRemove.add(projectile);
    return;
  }

  if (!beam.applied && projectile.projectile.targetId != null) {
    const target = ships.find((s) => s.id === projectile.projectile.targetId);
    if (target && target.ship.team !== projectile.projectile.team) {
      const outcome = applyProjectileDamage(state, projectile, target, ships);
      if (outcome.destroyed) {
        toRemove.add(target);
      }
    }
    beam.applied = true;
  }

  if (projectile.projectile.ttl <= 0) {
    toRemove.add(projectile);
  }
}

function applyAoeDamage(
  state: GameState,
  projectile: ProjectileEntity,
  ships: ShipEntity[],
  toRemove: Set<GameEntity>,
  radius: number,
  primaryTarget: ShipEntity,
): void {
  const origin = primaryTarget.transform.position;
  for (const ship of ships) {
    if (ship === primaryTarget) continue;
    if (ship.ship.team === projectile.projectile.team) continue;
    const distance = ship.transform.position.distanceTo(origin);
    if (distance > radius) continue;
    const outcome = applyProjectileDamage(state, projectile, ship, ships);
    if (outcome.destroyed) {
      toRemove.add(ship);
    }
  }
}

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
    const category: ProjectileCategory =
      projectile.projectile.category ?? resolveProjectileCategory(projectile.projectile.bulletType);

    if (category === 'beam') {
      handleBeamProjectile(state, projectile, ships, toRemove, delta);
      continue;
    }

    projectile.projectile.ttl -= delta;
    if (projectile.projectile.ttl <= 0) {
      toRemove.add(projectile);
      continue;
    }

    const info = resolveProjectileInfo(projectile.projectile.bulletType);
    const projRadius =
      info.config.colliderRadius ?? Math.max(0.08, projectile.transform.scale * 1.2);

    for (const ship of ships) {
      if (ship.ship.team === projectile.projectile.team) continue;
      const distance = ship.transform.position.distanceTo(projectile.transform.position);
      const impactRadius = ship.transform.scale * 0.9 + projRadius;
      if (distance > impactRadius) continue;
      if (!isProjectileArmed(projectile, state.time)) {
        // Not armed yet — skip damage but allow future collisions.
        continue;
      }

      const outcome = applyProjectileDamage(state, projectile, ship, ships);
      toRemove.add(projectile);

      if (outcome.destroyed) {
        toRemove.add(ship);
      }

      if (projectile.projectile.aoeRadius && projectile.projectile.aoeRadius > 0) {
        applyAoeDamage(state, projectile, ships, toRemove, projectile.projectile.aoeRadius, ship);
      }
      break;
    }
  }

  for (const entity of toRemove) {
    destroyEntity(state, entity);
  }
}
