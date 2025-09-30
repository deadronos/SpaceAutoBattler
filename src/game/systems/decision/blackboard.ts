import { Vector3 } from 'three';
import type {
  GameState,
  ShipEntity,
  Team,
  TeamPosture,
  EscortAssignment,
} from '../../../types/index.js';
import { AI_CONFIG } from '../../config.js';
import { resolveBehaviorProfile } from '../../aiProfiles.js';
import { SeededRng } from '../../../utils/rng.js';
import { ensureInterruptState, queueInterrupt } from './interrupts.js';
import { hashToInt } from './utils.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TEMP_RNG = new SeededRng(1);

export function refreshBlackboard(state: GameState, ships: ShipEntity[]): void {
  const { blackboard } = state;
  const manager = state.ai;
  if (!manager) return;
  const interruptState = ensureInterruptState(manager);
  const vipAssignments = interruptState.vipThreatAssignments;
  const teamCounts = blackboard.teamCounts ?? (blackboard.teamCounts = { blue: 0, red: 0 });
  teamCounts.blue = 0;
  teamCounts.red = 0;
  const seenVip = new Set<number>();
  const shipById = new Map<number, ShipEntity>();
  for (const ship of ships) shipById.set(ship.id, ship);
  const centroid = blackboard.allyCentroid ?? (blackboard.allyCentroid = { blue: new Vector3(), red: new Vector3() });
  centroid.blue.set(0, 0, 0);
  centroid.red.set(0, 0, 0);
  let blueCount = 0;
  let redCount = 0;
  let blueHp = 0;
  let redHp = 0;

  if (!blackboard.nearestEnemy) blackboard.nearestEnemy = new Map();
  if (!blackboard.threatToVip) blackboard.threatToVip = new Map();
  if (!blackboard.teamPriority) blackboard.teamPriority = { blue: [], red: [] };
  if (!blackboard.priorityIndex) blackboard.priorityIndex = { blue: new Map(), red: new Map() };
  if (!blackboard.focusFire) blackboard.focusFire = { blue: new Map(), red: new Map() };
  if (!blackboard.strengthRatio) blackboard.strengthRatio = { blue: 1, red: 1 };
  if (!blackboard.teamPosture) blackboard.teamPosture = { blue: 'hold', red: 'hold' };

  blackboard.nearestEnemy.clear();
  blackboard.threatToVip.clear();
  blackboard.teamPriority.blue.length = 0;
  blackboard.teamPriority.red.length = 0;
  blackboard.priorityIndex.blue.clear();
  blackboard.priorityIndex.red.clear();
  blackboard.focusFire.blue.clear();
  blackboard.focusFire.red.clear();

  const shipsLength = ships.length;
  for (let i = 0; i < shipsLength; i += 1) {
    const ship = ships[i];
    if (ship.ship.team === 'blue') {
      centroid.blue.add(ship.transform.position);
      blueCount += 1;
      blueHp += ship.ship.hp;
      teamCounts.blue += 1;
    } else {
      centroid.red.add(ship.transform.position);
      redCount += 1;
      redHp += ship.ship.hp;
      teamCounts.red += 1;
    }
  }

  if (blueCount > 0) centroid.blue.multiplyScalar(1 / blueCount);
  if (redCount > 0) centroid.red.multiplyScalar(1 / redCount);

  for (let i = 0; i < shipsLength; i += 1) {
    const ship = ships[i];
    let bestDist = Number.POSITIVE_INFINITY;
    let bestId: number | undefined;
    for (let j = 0; j < shipsLength; j += 1) {
      if (i === j) continue;
      const other = ships[j];
      if (other.ship.team === ship.ship.team) continue;
      const distSq = ship.transform.position.distanceToSquared(other.transform.position);
      if (distSq < bestDist) {
        bestDist = distSq;
        bestId = other.id;
      }
    }
    if (bestId != null) {
      blackboard.nearestEnemy.set(ship.id, bestId);
      if (ship.ship.hull === 'carrier' || ship.ship.hull === 'destroyer') {
        const previous = vipAssignments.get(ship.id);
        blackboard.threatToVip.set(ship.id, bestId);
        if (previous !== bestId) {
          const tick = manager.tickIndex;
          queueInterrupt(manager, {
            shipId: ship.id,
            reason: 'vip-threat',
            tick,
            sourceId: bestId,
          });
          for (const [escortId, assignment] of manager.assignments.escorts.entries()) {
            if (assignment.vipId !== ship.id) continue;
            queueInterrupt(manager, {
              shipId: escortId,
              reason: 'vip-threat',
              tick,
              sourceId: bestId,
            });
          }
        }
        vipAssignments.set(ship.id, bestId);
        seenVip.add(ship.id);
      }
    } else if (ship.ship.hull === 'carrier' || ship.ship.hull === 'destroyer') {
      if (vipAssignments.has(ship.id)) {
        vipAssignments.delete(ship.id);
      }
    }
  }

  for (let i = 0; i < shipsLength; i += 1) {
    const ship = ships[i];
    const ai = ship.ai;
    if (!ai || ai.targetId == null) continue;
    const focusMap = blackboard.focusFire[ship.ship.team];
    focusMap.set(ai.targetId, (focusMap.get(ai.targetId) ?? 0) + 1);
  }

  const weights = AI_CONFIG.threatWeights;
  const distanceScale = Math.max(1, weights.distanceScale ?? 600);

  const buildPriority = (team: Team, enemyTeam: Team): void => {
    const list = blackboard.teamPriority[team];
    const indexMap = blackboard.priorityIndex[team];
    const focusMap = blackboard.focusFire[team];
    const centroidVec = blackboard.allyCentroid[team];
    for (let i = 0; i < shipsLength; i += 1) {
      const enemy = ships[i];
      if (enemy.ship.team !== enemyTeam) continue;
      const distanceSq = enemy.transform.position.distanceToSquared(centroidVec);
      const distance = Math.sqrt(distanceSq);
      const distanceWeight = 1 / (1 + distance / distanceScale);
      const hullWeight = weights.hull[enemy.ship.hull as keyof typeof weights.hull] ?? 1;
      const hpWeight = enemy.ship.hp * weights.hpScalar;
      let vipThreat = 0;
      for (const [vipId, threatId] of blackboard.threatToVip.entries()) {
        if (threatId !== enemy.id) continue;
        const vipEntity = shipById.get(vipId);
        if (vipEntity && vipEntity.ship.team === team) {
          vipThreat += weights.vipBonus;
        }
      }
      const focusLoad = focusMap.get(enemy.id) ?? 0;
      const focusPenalty = focusLoad > 0 ? focusLoad * weights.focusPenalty : 0;
      const baseThreat = hullWeight + hpWeight + vipThreat;
      const adjustedThreat = Math.max(0.1, baseThreat - focusPenalty);
      const threat = adjustedThreat * distanceWeight;
      list.push({ id: enemy.id, threat, distanceSq, focusLoad });
    }

    list.sort((a, b) => {
      if (Math.abs(b.threat - a.threat) > 1e-6) return b.threat - a.threat;
      if (a.distanceSq !== b.distanceSq) return a.distanceSq - b.distanceSq;
      return a.id - b.id;
    });

    indexMap.clear();
    for (let i = 0; i < list.length; i += 1) {
      indexMap.set(list[i].id, i);
    }
  };

  buildPriority('blue', 'red');
  buildPriority('red', 'blue');

  const blueStrength = redHp > 0 ? blueHp / redHp : 1;
  const redStrength = blueHp > 0 ? redHp / blueHp : 1;
  blackboard.strengthRatio.blue = blueStrength;
  blackboard.strengthRatio.red = redStrength;
  blackboard.teamPosture.blue = resolvePosture(blueStrength);
  blackboard.teamPosture.red = resolvePosture(redStrength);

  if (blackboard.verticalDispersion && blackboard.verticalDispersion.lastUpdateTick !== blackboard.tickIndex) {
    blackboard.verticalDispersion.positionYSamples.length = 0;
    blackboard.verticalDispersion.headingYSamples.length = 0;
    blackboard.verticalDispersion.lastUpdateTick = blackboard.tickIndex;
  }

  if (blackboard.verticalDispersion) {
    for (const ship of ships) {
      if (ship.ai && ship.ship.hp > 0) {
        blackboard.verticalDispersion.positionYSamples.push(ship.transform.position.y);
      }
    }
  }
}

export function resolvePosture(strengthRatio: number): TeamPosture {
  if (strengthRatio > 1.25) return 'aggressive';
  if (strengthRatio < 0.8) return 'retreat';
  return 'hold';
}

export function assignTeamRoles(state: GameState, ships: ShipEntity[]): void {
  const escorts = state.ai.assignments.escorts;
  escorts.clear();
  const teamEscorts: Record<Team, ShipEntity[]> = {
    blue: [],
    red: [],
  };
  const teamVips: Record<Team, ShipEntity[]> = {
    blue: [],
    red: [],
  };

  for (const ship of ships) {
    if (ship.ai) {
      const profile = resolveBehaviorProfile(ship.ai.profileId);
      if (profile.style === 'escort') {
        teamEscorts[ship.ship.team].push(ship);
      }
    }
    if (ship.ship.hull === 'carrier' || ship.ship.hull === 'destroyer') {
      teamVips[ship.ship.team].push(ship);
    }
  }

  const compareById = (a: ShipEntity, b: ShipEntity): number => a.id - b.id;
  for (const team of ['blue', 'red'] as const) {
    const vips = teamVips[team].sort(compareById);
    const pool = teamEscorts[team].sort(compareById);
    const vipCount = vips.length;
    if (vipCount === 0) continue;
    for (let i = 0; i < pool.length; i += 1) {
      const escort = pool[i];
      const vip = vips[i % vipCount];
      const escortProfile = escort.ai ? resolveBehaviorProfile(escort.ai.profileId) : resolveBehaviorProfile('escort');
      const radiusBase = Math.max(30, (escortProfile.desiredRange[0] + escortProfile.desiredRange[1]) * 0.33);
      const offset = computeEscortShellOffset(vip.id, i, pool.length, radiusBase);
      escorts.set(escort.id, {
        vipId: vip.id,
        offset,
        threatId: state.blackboard.threatToVip.get(vip.id),
      } satisfies EscortAssignment);
    }
  }
}

export function computeEscortShellOffset(
  vipId: number,
  slotIndex: number,
  total: number,
  radius: number,
): Vector3 {
  const normalizedTotal = Math.max(1, total);
  const t = (slotIndex + 0.5) / normalizedTotal;
  const inclination = Math.acos(1 - 2 * t);
  const azimuth = GOLDEN_ANGLE * (slotIndex + 1);
  const sinInclination = Math.sin(inclination);
  const base = new Vector3(
    Math.cos(azimuth) * sinInclination,
    Math.cos(inclination),
    Math.sin(azimuth) * sinInclination,
  );
  const jitterSeed = hashToInt(vipId ^ ((slotIndex + 1) * 8191));
  TEMP_RNG.reset(Math.abs(jitterSeed) + 1);
  const radialJitter = 1 + TEMP_RNG.range(-0.08, 0.08);
  const verticalJitter = TEMP_RNG.range(-0.12, 0.12);
  base.y += verticalJitter;
  if (base.lengthSq() < 1e-5) base.set(0, 1, 0);
  base.normalize().multiplyScalar(Math.max(20, radius * radialJitter));
  return base;
}
