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

const TEMP_IMPACT_DIR = new Vector3();
const TEMP_BEAM_VECTOR = new Vector3();
const TEMP_BEAM_PERP = new Vector3();

function findAttacker(ships: ShipEntity[], projectile: ProjectileEntity): ShipEntity | null {
  if (projectile.projectile.sourceId != null) {
    return ships.find((s) => s.id === projectile.projectile.sourceId) ?? null;
  }
  return ships.find((s) => s.ship.team === projectile.projectile.team) ?? null;
}

function normaliseLabelPart(value: string): string {
  return value.replace(/[-_]+/g, ' ').trim();
}

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function describeProjectile(projectile: ProjectileEntity): string {
  const { bulletType, category, damageType } = projectile.projectile;

  if (bulletType) {
    const segments = bulletType.split(':').filter(Boolean);
    if (segments.length >= 2) {
      const [kind, ...rest] = segments;
      const variant = rest.join(' ');
      const variantLabel = toTitleCase(normaliseLabelPart(variant));
      const kindLabel = toTitleCase(normaliseLabelPart(kind));
      if (variantLabel) {
        return `${variantLabel} ${kindLabel}`;
      }
      return kindLabel;
    }
    return toTitleCase(normaliseLabelPart(bulletType));
  }

  if (category) {
    return toTitleCase(normaliseLabelPart(category));
  }

  if (damageType) {
    return `${toTitleCase(normaliseLabelPart(damageType))} Damage`;
  }

  return 'Unknown Weapon';
}

function applyDamageToShip(
  state: GameState,
  projectile: ProjectileEntity,
  target: ShipEntity,
  ships: ShipEntity[],
  manager: GameState['ai'] | undefined,
  toRemove: Set<GameEntity>,
  impactPosition: Vector3,
): void {
  const damageResult = calculateEffectiveDamage(
    projectile.projectile.damage,
    projectile.projectile.damageType,
    target.ship.shield,
    target.ship.armor,
  );

  if (damageResult.shieldDamage > 0) {
    target.ship.shield -= damageResult.shieldDamage;
    const dir = TEMP_IMPACT_DIR.copy(impactPosition).sub(target.transform.position);
    if (dir.lengthSq() > 1e-5) dir.normalize();
    else dir.set(0, 0, 1);
    const strength = Math.min(1, damageResult.shieldDamage / Math.max(1, target.ship.maxShield));
    const ripple: ShieldRipple = { dir: dir.clone(), t0: state.time, amp: strength };
    const list = (target.shieldRipples ??= []);
    list.push(ripple);
    if (list.length > 64) list.shift();
  }

  if (damageResult.armorDamage > 0) {
    target.ship.armor = Math.max(0, target.ship.armor - damageResult.armorDamage * 0.1);
  }

  let hullDamage = 0;
  if (damageResult.hullDamage > 0) {
    const prevHp = target.ship.hp;
    target.ship.hp -= damageResult.hullDamage;
    hullDamage = Math.max(0, prevHp - target.ship.hp);
    applySubsystemDamage(target.ship, hullDamage, new SeededRng(projectile.id * 8191 + target.id));
  }

  const totalDamageDealt =
    damageResult.shieldDamage + damageResult.armorDamage + damageResult.hullDamage;
  if (totalDamageDealt > 0) {
    const attackerShip = findAttacker(ships, projectile);
    if (attackerShip) {
      const damageSource = describeProjectile(projectile);
      awardDamageXp(attackerShip.ship, totalDamageDealt, state, attackerShip.id, damageSource);
    }
  }

  if (manager && hullDamage > 0) {
    const totalDamage = accumulateInterruptDamage(
      manager,
      target.id,
      hullDamage,
      manager.tickIndex,
    );
    const maxHp = Math.max(1, target.ship.maxHp);
    if (totalDamage / maxHp >= (AI_CONFIG.interruptHpDrop ?? 0.1)) {
      queueInterrupt(manager, {
        shipId: target.id,
        reason: 'hp-drop',
        tick: manager.tickIndex,
        sourceId: projectile.id,
      });
    }
  }

  if (target.ship.hp <= 0) {
    if (manager) {
      queueTargetLossInterrupts(state, ships, target.id);
    }

    const killerShip = findAttacker(ships, projectile);
    if (killerShip) {
      awardKillXp(killerShip.ship, target.ship.maxHp, state, killerShip.id);
    }

    emitShipKillExplosion(state, target, projectile);
    toRemove.add(target);
  }
}

function detonateProjectile(
  state: GameState,
  projectile: ProjectileEntity,
  impactPosition: Vector3,
  ships: ShipEntity[],
  manager: GameState['ai'] | undefined,
  toRemove: Set<GameEntity>,
  primary?: ShipEntity,
  removeProjectile: boolean = true,
): void {
  const affected = new Set<ShipEntity>();
  if (primary) affected.add(primary);
  const radius = projectile.projectile.aoeRadius ?? 0;
  if (radius > 0) {
    const radiusSq = radius * radius;
    for (const candidate of ships) {
      if (candidate.ship.team === projectile.projectile.team) continue;
      const distanceSq = candidate.transform.position.distanceToSquared(impactPosition);
      if (distanceSq <= radiusSq) {
        affected.add(candidate);
      }
    }
  }

  for (const ship of affected) {
    applyDamageToShip(state, projectile, ship, ships, manager, toRemove, impactPosition);
  }

  if (!affected.size && primary) {
    applyDamageToShip(state, projectile, primary, ships, manager, toRemove, impactPosition);
  }

  if (removeProjectile) {
    toRemove.add(projectile);
  }
}

function resolveBeamImpact(
  state: GameState,
  projectile: ProjectileEntity,
  ships: ShipEntity[],
  manager: GameState['ai'] | undefined,
  toRemove: Set<GameEntity>,
): void {
  const beam = projectile.projectile.beam;
  if (!beam) return;
  const origin = projectile.transform.position;
  const direction = projectile.direction.clone().normalize();
  let closest: ShipEntity | null = null;
  let closestDistance = beam.length;

  for (const ship of ships) {
    if (ship.ship.team === projectile.projectile.team) continue;
    const toShip = TEMP_BEAM_VECTOR.copy(ship.transform.position).sub(origin);
    const along = toShip.dot(direction);
    if (along < 0 || along > beam.length) continue;
    const radial = TEMP_BEAM_PERP.copy(toShip).addScaledVector(direction, -along);
    const shipRadius = ship.transform.scale * 0.9;
    const combined = shipRadius + beam.width * 0.5;
    if (radial.lengthSq() <= combined * combined) {
      if (along < closestDistance) {
        closestDistance = along;
        closest = ship;
      }
    }
  }

  if (closest) {
    const impactPosition = origin.clone().addScaledVector(direction, closestDistance);
    detonateProjectile(state, projectile, impactPosition, ships, manager, toRemove, closest, false);
  }

  projectile.projectile.hasAppliedBeamDamage = true;
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
    if (toRemove.has(projectile)) continue;
    const component = projectile.projectile;
    component.ttl -= delta;
    if (component.ttl <= 0) {
      toRemove.add(projectile);
      continue;
    }

    if (component.category === 'beam') {
      if (!component.hasAppliedBeamDamage) {
        resolveBeamImpact(state, projectile, ships, manager, toRemove);
      }
      continue;
    }

    const projCfg = PROJECTILE_CONFIG[component.bulletType ?? ''] ?? DEFAULT_PROJECTILE_CONFIG;
    const projRadius = projCfg.colliderRadius ?? Math.max(0.08, projectile.transform.scale * 1.2);
    let hitShip: ShipEntity | null = null;

    for (const ship of ships) {
      if (ship.ship.team === component.team) continue;
      const distance = ship.transform.position.distanceTo(projectile.transform.position);
      const impactRadius = ship.transform.scale * 0.9 + projRadius;
      if (distance > impactRadius) continue;
      if (!component.armed) continue;
      hitShip = ship;
      break;
    }

    if (hitShip) {
      const impactPosition = projectile.transform.position.clone();
      detonateProjectile(state, projectile, impactPosition, ships, manager, toRemove, hitShip);
      continue;
    }

    if (component.category === 'bullet') {
      for (const target of projectiles) {
        if (target === projectile) continue;
        if (toRemove.has(target)) continue;
        const targetComponent = target.projectile;
        if (targetComponent.team === component.team) continue;
        if (targetComponent.category !== 'missile' && targetComponent.category !== 'torpedo')
          continue;
        const targetCfg =
          PROJECTILE_CONFIG[targetComponent.bulletType ?? ''] ?? DEFAULT_PROJECTILE_CONFIG;
        const targetRadius =
          targetCfg.colliderRadius ?? Math.max(0.08, target.transform.scale * 1.2);
        const distance = target.transform.position.distanceTo(projectile.transform.position);
        if (distance > projRadius + targetRadius) continue;
        const impactPosition = target.transform.position.clone();
        detonateProjectile(state, target, impactPosition, ships, manager, toRemove);
        toRemove.add(projectile);
        break;
      }
    }
  }

  for (const entity of toRemove) {
    destroyEntity(state, entity);
  }
}
