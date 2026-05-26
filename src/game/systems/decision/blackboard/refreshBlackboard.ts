import { Vector3 } from 'three';
import type { GameState, ShipEntity, Team } from '../../../../types/index.js';
import { AI_CONFIG } from '../../../config.js';
import {
  ensureDoctrineState,
  getDoctrineSquadDirectives,
  getDoctrineThreatModifiers,
} from '../../../aiDoctrine.js';
import { ensureInterruptState, queueInterrupt } from '../interrupts.js';
import { resolvePosture } from './posture.js';

/**
 * Recomputes the shared blackboard state for the current frame.
 * Updates centroids, threat analysis, target prioritization, and team posture.
 *
 * @param {GameState} state - The game state.
 * @param {ShipEntity[]} ships - The list of all active ships.
 */
export const refreshBlackboard = (state: GameState, ships: ShipEntity[]): void => {
  const { blackboard } = state;
  const manager = state.ai;
  if (!manager) return;

  ensureDoctrineState(manager);
  const interruptState = ensureInterruptState(manager);
  const vipAssignments = interruptState.vipThreatAssignments;
  const teamCounts = blackboard.teamCounts ?? (blackboard.teamCounts = { blue: 0, red: 0 });
  teamCounts.blue = 0;
  teamCounts.red = 0;
  const seenVip = new Set<number>();
  const shipById = new Map<number, ShipEntity>();
  for (const ship of ships) shipById.set(ship.id, ship);
  const centroid =
    blackboard.allyCentroid ??
    (blackboard.allyCentroid = { blue: new Vector3(), red: new Vector3() });
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
  if (!blackboard.visibleEnemies) blackboard.visibleEnemies = { blue: new Map(), red: new Map() };
  const visibleEnemies = blackboard.visibleEnemies!;
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
    if (!ship) continue;
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
    if (!ship) continue;
    const visibleMap = visibleEnemies[ship.ship.team];
    if (!visibleMap) continue;
    const requireVisibility = visibleMap.size > 0;
    let bestDist = Number.POSITIVE_INFINITY;
    let bestId: number | undefined;
    for (let j = 0; j < shipsLength; j += 1) {
      if (i === j) continue;
      const other = ships[j];
      if (!other || other.ship.team === ship.ship.team) continue;
      if (requireVisibility && !visibleMap.has(other.id)) continue;
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
    if (!ship) continue;
    const ai = ship.ai;
    if (!ai || ai.targetId == null) continue;
    const focusMap = blackboard.focusFire[ship.ship.team]!;
    focusMap.set(ai.targetId, (focusMap.get(ai.targetId) ?? 0) + 1);
  }

  const weights = AI_CONFIG.threatWeights;
  const baseDistanceScale = Math.max(1, weights.distanceScale ?? 600);
  const threatModifiers: Record<Team, ReturnType<typeof getDoctrineThreatModifiers>> = {
    blue: getDoctrineThreatModifiers(manager, 'blue'),
    red: getDoctrineThreatModifiers(manager, 'red'),
  };

  const buildPriority = (team: Team, enemyTeam: Team): void => {
    const list = blackboard.teamPriority[team]!;
    const indexMap = blackboard.priorityIndex[team]!;
    const focusMap = blackboard.focusFire[team]!;
    const centroidVec = blackboard.allyCentroid[team]!;
    const mods = threatModifiers[team];
    const visibilityMap = visibleEnemies[team]!;
    const requireVisibility = visibilityMap.size > 0;
    const distanceScale = Math.max(1, baseDistanceScale * (mods?.distanceScaleMultiplier ?? 1));
    const focusPenaltyScalar = weights.focusPenalty * (mods?.focusPenaltyMultiplier ?? 1);
    const vipBonusValue = weights.vipBonus * (mods?.vipBonusMultiplier ?? 1);
    for (let i = 0; i < shipsLength; i += 1) {
      const enemy = ships[i];
      if (!enemy || enemy.ship.team !== enemyTeam) continue;
      if (requireVisibility && !visibilityMap.has(enemy.id)) continue;
      const visibility = visibilityMap.get(enemy.id);
      const distanceSq = enemy.transform.position.distanceToSquared(centroidVec);
      const distance = Math.sqrt(distanceSq);
      const distanceWeight = 1 / (1 + distance / distanceScale);
      const hullBase = weights.hull[enemy.ship.hull as keyof typeof weights.hull] ?? 1;
      const hullBias = mods?.hullBiasAdd?.[enemy.ship.hull] ?? 0;
      const hullWeight = Math.max(0.1, hullBase + hullBias);
      const hpWeight = enemy.ship.hp * weights.hpScalar;
      let vipThreat = 0;
      for (const [vipId, threatId] of blackboard.threatToVip.entries()) {
        if (threatId !== enemy.id) continue;
        const vipEntity = shipById.get(vipId);
        if (vipEntity && vipEntity.ship.team === team) {
          vipThreat += vipBonusValue;
        }
      }
      const focusLoad = focusMap.get(enemy.id) ?? 0;
      const focusPenalty = focusLoad > 0 ? focusLoad * focusPenaltyScalar : 0;
      const baseThreat = hullWeight + hpWeight + vipThreat;
      const adjustedThreat = Math.max(0.1, baseThreat - focusPenalty);
      const detectionWeight = visibility
        ? Math.max(0.35, 0.6 + visibility.strength * 0.6) * (visibility.occluded ? 0.85 : 1)
        : requireVisibility
          ? 0
          : 1;
      if (detectionWeight <= 0) continue;
      const threat = adjustedThreat * distanceWeight * detectionWeight;
      list.push({ id: enemy.id, threat, distanceSq, focusLoad });
    }

    list.sort((a, b) => {
      if (Math.abs(b.threat - a.threat) > 1e-6) return b.threat - a.threat;
      if (a.distanceSq !== b.distanceSq) return a.distanceSq - b.distanceSq;
      return a.id - b.id;
    });

    indexMap.clear();
    for (let i = 0; i < list.length; i += 1) {
      const entry = list[i];
      if (entry) {
        indexMap.set(entry.id, i);
      }
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
  const directivesBlue = getDoctrineSquadDirectives(manager, 'blue');
  const directivesRed = getDoctrineSquadDirectives(manager, 'red');
  if (directivesBlue?.postureOverride) {
    blackboard.teamPosture.blue = directivesBlue.postureOverride;
  }
  if (directivesRed?.postureOverride) {
    blackboard.teamPosture.red = directivesRed.postureOverride;
  }

  if (
    blackboard.verticalDispersion &&
    blackboard.verticalDispersion.lastUpdateTick !== blackboard.tickIndex
  ) {
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
};
