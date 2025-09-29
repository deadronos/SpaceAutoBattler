import { Quaternion, Vector3 } from 'three';
import type {
  GameState,
  ShipEntity,
  AIState,
  ShipComponent,
} from '../../types/index.js';
import { clampToWorld } from '../config.js';
import { recordBandSample, recordShotMetrics } from '../metrics.js';
import { updateCaptainAbilities, repairSubsystems, getEffectiveStats } from '../progression.js';
import { fireProjectile, findNearestEnemy, runEmbeddedTurrets } from './combat.js';

const FORWARD = new Vector3(0, 0, 1);
const TEMP_DIR = new Vector3();
const TEMP_POS = new Vector3();
const TEMP_REL_POS = new Vector3();
const TEMP_QUAT = new Quaternion();

export type KinematicBody = { setNextKinematicTranslation: (t: { x: number; y: number; z: number }) => void };

export function safeSetNextKinematicTranslation(
  rb: KinematicBody | null | undefined,
  x: number,
  y: number,
  z: number,
): void {
  if (!rb) return;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
  try {
    rb.setNextKinematicTranslation({ x, y, z });
  } catch {
    // Ignore invalid operations on disposed bodies; will be corrected on next sync
  }
}

export function prepareShips(state: GameState, delta: number): void {
  const ships = state.queries.ships.entities as ShipEntity[];
  const useAIV2 = !!state.ai?.enabled;

  for (const ship of ships) {
    ship.ship.cooldown = Math.max(0, ship.ship.cooldown - delta);
    if (ship.turrets) {
      for (const turret of ship.turrets) turret.cooldown = Math.max(0, turret.cooldown - delta);
    }

    updateCaptainAbilities(ship.ship, state.time, delta);
    repairSubsystems(ship.ship, delta);

    const effectiveStats = getEffectiveStats(ship.ship);
    const regen = (ship.ship.shieldRegen ?? 0) * effectiveStats.shieldRegenMultiplier;
    if (regen > 0 && ship.ship.shield < ship.ship.maxShield) {
      ship.ship.shield = Math.min(ship.ship.maxShield, ship.ship.shield + regen * delta);
    }

    let preferredTarget: ShipEntity | null = null;

    if (useAIV2 && ship.ai) {
      preferredTarget = executeAICommand(state, ship, delta);
    } else {
      preferredTarget = runLegacyShipBehavior(state, ship, delta);
    }

    if (state.queries.turrets.entities.length === 0 && ship.turrets && preferredTarget) {
      runEmbeddedTurrets(state, ship, preferredTarget);
    }

    if (ship.muzzleFlashes && ship.muzzleFlashes.length) {
      const life = 0.25;
      ship.muzzleFlashes = ship.muzzleFlashes.filter((m): boolean => state.time - m.t0 < life);
    }
  }
}

export function executeAICommand(state: GameState, ship: ShipEntity, delta: number): ShipEntity | null {
  const ai = ship.ai;
  if (!ai) return runLegacyShipBehavior(state, ship, delta);
  const command = ai.command;
  command.ttl = Math.max(0, command.ttl - delta);

  const heading = command.heading;
  if (heading.lengthSq() < 1e-5) {
    heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
  } else {
    heading.normalize();
  }

  try {
    const motion = ship.ship.motion;
    const tickHz = state.ai && state.ai.tickInterval > 0 ? 1 / state.ai.tickInterval : 10;
    const perTick = 1 / tickHz;
    const maxAngle = Math.max(0.05, motion.maxTurnRate * Math.max(perTick, delta));
    const currentForward = TEMP_DIR.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
    if (currentForward.lengthSq() > 1e-6) {
      currentForward.normalize();
      const dot = Math.max(-1, Math.min(1, currentForward.dot(heading)));
      const angle = Math.acos(dot);
      if (angle > maxAngle) {
        const axis = TEMP_REL_POS.crossVectors(currentForward, heading);
        if (axis.lengthSq() < 1e-10) {
          axis.copy(currentForward).cross(TEMP_POS.set(0, 1, 0));
          if (axis.lengthSq() < 1e-10) axis.set(1, 0, 0);
        }
        axis.normalize();
        TEMP_QUAT.setFromAxisAngle(axis, maxAngle);
        heading.copy(currentForward).applyQuaternion(TEMP_QUAT).normalize();
      }
    }
  } catch {
    // fallback: keep heading as-is
  }

  const thrust = Math.min(1, Math.max(0, command.thrust));
  if (thrust > 0) {
    const moveDistance = ship.ship.speed * thrust * delta;
    const nextPosition = TEMP_POS.copy(ship.transform.position).addScaledVector(heading, moveDistance);
    clampToWorld(nextPosition);
    safeSetNextKinematicTranslation(ship.rigidBody as unknown as KinematicBody, nextPosition.x, nextPosition.y, nextPosition.z);
  } else {
    const p = ship.transform.position;
    safeSetNextKinematicTranslation(ship.rigidBody as unknown as KinematicBody, p.x, p.y, p.z);
  }

  let target: ShipEntity | null = null;
  if (command.targetId != null) {
    target = getShipById(state, command.targetId);
  } else if (ai.targetId != null) {
    target = getShipById(state, ai.targetId);
  }

  try {
    if (target && ai.desiredRange) {
      const [min, max] = ai.desiredRange;
      const distance = ship.transform.position.distanceTo(target.transform.position);
      const satisfied = distance >= min && distance <= max;
      recordBandSample(state.ai.metrics, ship.ship.hull, satisfied);
    }
  } catch {
    // metrics are best-effort; ignore failures in lightweight harnesses
  }

  if (command.firePrimary && ship.ship.cooldown <= 0) {
    (ship.muzzleFlashes ??= []).push({
      local: new Vector3(0, 0, ship.transform.scale * 1.6),
      t0: state.time,
      amp: 1,
      bulletType: ship.ship.bulletType,
    });
    const fireDir = TEMP_DIR.copy(heading);
    if (fireDir.lengthSq() < 1e-5) fireDir.set(0, 0, 1);
    else fireDir.normalize();

    const distanceToTarget = target
      ? ship.transform.position.distanceTo(target.transform.position)
      : undefined;
    const deltaY = target ? target.transform.position.y - ship.transform.position.y : undefined;
    recordShotMetrics(state.ai.metrics, {
      shipId: ship.id,
      hull: ship.ship.hull,
      time: state.time,
      distance: distanceToTarget,
      deltaY,
    });

    fireProjectile(state, ship, fireDir);
    ship.ship.cooldown = ship.ship.fireRate;
  }

  return target;
}

export function runLegacyShipBehavior(state: GameState, ship: ShipEntity, delta: number): ShipEntity | null {
  const target = findNearestEnemy(state, ship);

  if (!target) {
    ship.rigidBody.setNextKinematicTranslation({
      x: ship.transform.position.x,
      y: ship.transform.position.y,
      z: ship.transform.position.z,
    });
    return null;
  }

  const direction = TEMP_DIR.subVectors(target.transform.position, ship.transform.position);
  const distance = direction.length();
  if (distance > 0.0001) {
    direction.normalize();
  } else {
    direction.set(0, 0, 1);
  }

  orientTowards(ship, direction);

  if (distance > ship.ship.range * 0.6) {
    const moveDistance = Math.min(
      ship.ship.speed * delta,
      Math.max(distance - ship.ship.range * 0.55, 0),
    );
    const nextPosition = TEMP_POS.copy(ship.transform.position).addScaledVector(direction, moveDistance);
    clampToWorld(nextPosition);

    ship.rigidBody.setNextKinematicTranslation({
      x: nextPosition.x,
      y: nextPosition.y,
      z: nextPosition.z,
    });
  } else {
    ship.rigidBody.setNextKinematicTranslation({
      x: ship.transform.position.x,
      y: ship.transform.position.y,
      z: ship.transform.position.z,
    });
  }

  if (distance <= ship.ship.range && ship.ship.cooldown <= 0) {
    (ship.muzzleFlashes ??= []).push({
      local: new Vector3(0, 0, ship.transform.scale * 1.6),
      t0: state.time,
      amp: 1,
      bulletType: ship.ship.bulletType,
    });
    const metrics = state.ai?.metrics;
    if (metrics && target) {
      recordShotMetrics(metrics, {
        shipId: ship.id,
        hull: ship.ship.hull,
        time: state.time,
        distance,
        deltaY: target.transform.position.y - ship.transform.position.y,
      });
    }
    fireProjectile(state, ship, direction);
    ship.ship.cooldown = ship.ship.fireRate;
  }

  return target;
}

export function orientTowards(ship: ShipEntity, direction: Vector3): void {
  const rotation = new Quaternion().setFromUnitVectors(FORWARD, direction);
  const bank = Math.max(Math.min(direction.x * 0.6, 0.6), -0.6);
  const banking = new Quaternion().setFromAxisAngle(FORWARD, -bank);
  rotation.multiply(banking);

  ship.transform.rotation.copy(rotation);
  ship.rigidBody.setNextKinematicRotation({
    x: rotation.x,
    y: rotation.y,
    z: rotation.z,
    w: rotation.w,
  });
}

export function getShipById(state: GameState, id: number | undefined): ShipEntity | null {
  if (id == null) return null;
  const ships = state.queries.ships.entities as ShipEntity[];
  for (const ship of ships) {
    if (ship.id === id) return ship;
  }
  return null;
}
