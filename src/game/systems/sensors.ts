import { Vector3 } from 'three';
import type {
  GameState,
  ShipEntity,
  SensorState,
  SensorVisibility,
  Team,
} from '../../types/index.js';
import { ensureDoctrineState, getDoctrineSensorModifiers } from '../aiDoctrine.js';
import { getForwardFromQuaternion } from '../../utils/vector.js';
import { clamp } from '../../utils/math.js';

const TMP_FORWARD = new Vector3();
const TMP_VECTOR = new Vector3();
const TMP_DIRECTION = new Vector3();
const TMP_OBSTACLE = new Vector3();

function ensureVisibleMaps(state: GameState): void {
  if (!state.blackboard.visibleEnemies) {
    state.blackboard.visibleEnemies = { blue: new Map(), red: new Map() };
    return;
  }
  if (!state.blackboard.visibleEnemies.blue) {
    state.blackboard.visibleEnemies.blue = new Map();
  }
  if (!state.blackboard.visibleEnemies.red) {
    state.blackboard.visibleEnemies.red = new Map();
  }
}

/**
 * Ensures the sensor state is initialized on the game state.
 *
 * @param {GameState} state - The game state.
 * @returns {SensorState} The initialized sensor state.
 */
export function ensureSensorState(state: GameState): SensorState {
  if (!state.sensors) {
    state.sensors = {
      lastUpdateTick: -1,
      visibilityByTeam: {
        blue: new Map(),
        red: new Map(),
      },
      decayRate: 0.65,
      threshold: 0.18,
      staleDecay: 0.55,
    };
  }
  ensureVisibleMaps(state);
  return state.sensors;
}

function computeOccluded(
  source: ShipEntity,
  target: ShipEntity,
  ships: ShipEntity[],
  direction: Vector3,
  distance: number,
): boolean {
  const cosThreshold = Math.cos(0.14);
  for (const obstacle of ships) {
    if (obstacle === source || obstacle === target) continue;
    TMP_OBSTACLE.copy(obstacle.transform.position).sub(source.transform.position);
    const obstacleDistance = TMP_OBSTACLE.length();
    if (obstacleDistance <= 1e-5 || obstacleDistance >= distance) continue;
    TMP_OBSTACLE.multiplyScalar(1 / obstacleDistance);
    if (TMP_OBSTACLE.dot(direction) > cosThreshold) {
      return true;
    }
  }
  return false;
}

function decayContacts(
  state: GameState,
  sensorState: SensorState,
  retention: Record<Team, number>,
): void {
  for (const team of ['blue', 'red'] as const) {
    const map = sensorState.visibilityByTeam[team];
    const retentionScale = clamp(retention[team] ?? 1, 0.25, 2);
    for (const [id, vis] of map) {
      if (vis.lastSeenTick === state.ai.tickIndex) continue;
      vis.strength *= Math.pow(sensorState.staleDecay, retentionScale);
      if (vis.strength < sensorState.threshold * 0.5) {
        map.delete(id);
      }
    }
  }
}

/**
 * Updates the sensor system, recalculating visibility and occlusion for all ships.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity[]} ships - The list of active ships.
 */
export function updateSensorSystem(state: GameState, ships: ShipEntity[]): void {
  const sensorState = ensureSensorState(state);
  const manager = state.ai;
  ensureDoctrineState(manager);
  const tick = manager.tickIndex;
  sensorState.lastUpdateTick = tick;

  const detectionMultiplier: Record<Team, number> = {
    blue: getDoctrineSensorModifiers(manager, 'blue')?.detectionMultiplier ?? 1,
    red: getDoctrineSensorModifiers(manager, 'red')?.detectionMultiplier ?? 1,
  };
  const stealthBonus: Record<Team, number> = {
    blue: getDoctrineSensorModifiers(manager, 'blue')?.stealthBonus ?? 0,
    red: getDoctrineSensorModifiers(manager, 'red')?.stealthBonus ?? 0,
  };
  const retention: Record<Team, number> = {
    blue: getDoctrineSensorModifiers(manager, 'blue')?.contactRetentionMultiplier ?? 1,
    red: getDoctrineSensorModifiers(manager, 'red')?.contactRetentionMultiplier ?? 1,
  };

  decayContacts(state, sensorState, retention);

  const visibilityByTeam = sensorState.visibilityByTeam;

  for (const source of ships) {
    const sensor = source.ship.sensor;
    if (!sensor) continue;
    const team = source.ship.team;
    const teamDetectionMultiplier = Math.max(0.2, detectionMultiplier[team] ?? 1);
    const detectionRange = sensor.detectionRange * teamDetectionMultiplier;
    const trackingRange = sensor.trackingRange * teamDetectionMultiplier;
    const coneCos = Math.cos(sensor.coneAngle * 0.5);

    getForwardFromQuaternion(source.transform.rotation, TMP_FORWARD).normalize();

    for (const target of ships) {
      if (target === source) continue;
      if (target.ship.team === team) continue;
      TMP_VECTOR.copy(target.transform.position).sub(source.transform.position);
      const distance = TMP_VECTOR.length();
      if (distance <= 1e-5 || distance > trackingRange) continue;

      TMP_DIRECTION.copy(TMP_VECTOR).multiplyScalar(1 / distance);
      const cosAngle = TMP_FORWARD.dot(TMP_DIRECTION);
      if (cosAngle <= -0.1) continue;

      let angleFactor = 0;
      if (cosAngle >= coneCos) {
        angleFactor = (cosAngle - coneCos) / (1 - coneCos);
      } else if (cosAngle > 0) {
        angleFactor = cosAngle * 0.08;
      }
      if (angleFactor <= 0) continue;

      let distanceFactor = 0;
      if (distance <= detectionRange) {
        distanceFactor = 1 - distance / detectionRange;
      } else {
        const span = trackingRange - detectionRange;
        if (span > 1e-5) {
          const normalized = Math.max(0, 1 - (distance - detectionRange) / span);
          distanceFactor = normalized * sensor.falloff;
        }
      }
      if (distanceFactor <= 0) continue;

      const occluded = computeOccluded(source, target, ships, TMP_DIRECTION, distance);
      const occlusionFactor = occluded ? 0.6 : 1;

      const targetDoctrineStealth = clamp(stealthBonus[target.ship.team] ?? 0, 0, 0.8);
      const intrinsicStealth = clamp(target.ship.stealth ?? 0, 0, 0.8);
      const signature = target.ship.sensorSignature ?? 1;
      const stealthFactor = Math.max(
        0.15,
        signature * (1 - (intrinsicStealth + targetDoctrineStealth)),
      );

      const strength = clamp(
        distanceFactor * angleFactor * stealthFactor * occlusionFactor,
        0,
        1.5,
      );
      if (strength <= sensorState.threshold) continue;

      const teamMap = visibilityByTeam[team];
      const existing = teamMap.get(target.id);
      if (!existing || strength > existing.strength) {
        teamMap.set(target.id, {
          strength,
          lastSeenTick: tick,
          sourceId: source.id,
          occluded,
          distance,
        } satisfies SensorVisibility);
      } else if (existing) {
        existing.lastSeenTick = tick;
        if (strength > existing.strength) {
          existing.strength = strength;
          existing.sourceId = source.id;
          existing.occluded = occluded;
          existing.distance = distance;
        }
      }
    }
  }

  ensureVisibleMaps(state);
  for (const team of ['blue', 'red'] as const) {
    const visibility = visibilityByTeam[team];
    const targetMap = state.blackboard.visibleEnemies![team];
    targetMap.clear();
    for (const [id, vis] of visibility) {
      if (vis.strength >= sensorState.threshold) {
        targetMap.set(id, vis);
      }
    }
  }
}
