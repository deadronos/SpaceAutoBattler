import { Quaternion, Vector3 } from 'three';
import type { GameState, ShipEntity } from '../../types/index.js';
import type { KinematicBody } from '../physics/safeKinematics.js';
import { clampToWorld } from '../config.js';
import { recordBandSample, recordShotMetrics } from '../metrics.js';
import { updateCaptainAbilities, repairSubsystems, getEffectiveStats } from '../progression.js';
import { fireProjectile } from './projectiles.js';
import { findNearestEnemy, runEmbeddedTurrets } from './turrets.js';
import {
  deferSetNextKinematicTranslation,
  deferSetNextKinematicRotation,
} from '../physics/safeKinematics.js';

const TEMP_DIR = new Vector3();
const TEMP_POS = new Vector3();
const TEMP_REL_POS = new Vector3();
const TEMP_QUAT = new Quaternion();
const missingAiShips = new Set<number>();
let warnedAiDisableInShips = false;

function ensureAiEnabled(state: GameState): void {
  if (state.ai) state.ai.enabled = true;
  if (warnedAiDisableInShips) return;
  warnedAiDisableInShips = true;
  try {
    globalThis.console?.warn?.('AI v2 fallback removed: forcing AI enabled for all ships.');
  } catch {
    // ignore logging failures in headless tests
  }
}

function keepShipStationary(state: GameState, ship: ShipEntity): void {
  const position = ship.transform.position;
  deferSetNextKinematicTranslation(
    state,
    ship.rigidBody as unknown as KinematicBody,
    position.x,
    position.y,
    position.z,
  );
  const rotation = ship.transform.rotation;
  deferSetNextKinematicRotation(
    state,
    ship.rigidBody as unknown as KinematicBody,
    rotation.x,
    rotation.y,
    rotation.z,
    rotation.w,
  );
}

function handleMissingAi(state: GameState, ship: ShipEntity): ShipEntity | null {
  if (!missingAiShips.has(ship.id)) {
    missingAiShips.add(ship.id);
    try {
      globalThis.console?.error?.(
        `Ship ${ship.id} is missing an AI component; keeping it stationary.`,
      );
    } catch {
      // ignore logging failures
    }
  }
  keepShipStationary(state, ship);
  return findNearestEnemy(state, ship);
}

export function prepareShips(state: GameState, delta: number): void {
  const ships = state.queries.ships.entities as ShipEntity[];

  if (state.ai && !state.ai.enabled) {
    ensureAiEnabled(state);
  }

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

    const preferredTarget = executeAICommand(state, ship, delta);

    if (state.queries.turrets.entities.length === 0 && ship.turrets && preferredTarget) {
      runEmbeddedTurrets(state, ship, preferredTarget);
    }

    if (ship.muzzleFlashes && ship.muzzleFlashes.length) {
      const life = 0.25;
      ship.muzzleFlashes = ship.muzzleFlashes.filter((m): boolean => state.time - m.t0 < life);
    }
  }
}

export function executeAICommand(
  state: GameState,
  ship: ShipEntity,
  delta: number,
): ShipEntity | null {
  const ai = ship.ai;
  if (!ai) return handleMissingAi(state, ship);
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
    const nextPosition = TEMP_POS.copy(ship.transform.position).addScaledVector(
      heading,
      moveDistance,
    );
    clampToWorld(nextPosition);
    deferSetNextKinematicTranslation(
      state,
      ship.rigidBody as unknown as KinematicBody,
      nextPosition.x,
      nextPosition.y,
      nextPosition.z,
    );
  } else {
    const p = ship.transform.position;
    deferSetNextKinematicTranslation(
      state,
      ship.rigidBody as unknown as KinematicBody,
      p.x,
      p.y,
      p.z,
    );
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

export function getShipById(state: GameState, id: number | undefined): ShipEntity | null {
  if (id == null) return null;
  const ships = state.queries.ships.entities as ShipEntity[];
  for (const ship of ships) {
    if (ship.id === id) return ship;
  }
  return null;
}
