import { Quaternion, Vector3 } from 'three';
import type {
  AIIntent,
  AIState,
  AITraits,
  BehaviorProfile,
  GameEntity,
  GameState,
  ProjectileEntity,
  ShipEntity,
  ShieldRipple,
  Team,
  TeamPosture,
  TurretState,
  TurretEntity,
} from '../types/index.js';
import { destroyEntity } from './state.js';
import { AI_CONFIG, clampToWorld } from './config.js';
import { PROJECTILE_CONFIG, DEFAULT_PROJECTILE_CONFIG } from '../config/projectiles.js';
import { resolveBehaviorProfile } from './aiProfiles.js';
import { generateTraitsFromSeed } from './aiTraits.js';
import { updateMotionSystem } from './systems/motion.js';
import { updateCarrierLaunchSystem } from './systems/carriers.js';

const FORWARD = new Vector3(0, 0, 1);
const TEMP_DIR = new Vector3();
const TEMP_POS = new Vector3();
const TEMP_REL_POS = new Vector3();
const TEMP_TARGET_VEL = new Vector3();
const TEMP_SHIP_VEL = new Vector3();
const TEMP_REL_VEL = new Vector3();
interface IntentCandidate {
  intent: AIIntent;
  score: number;
  target?: ShipEntity | null;
}

function updateDecisionSystem(state: GameState, delta: number): void {
  // Defensive: Some unit tests construct lightweight GameState stubs
  // without initializing the AI manager or blackboard. In that case,
  // the decision system should no-op to preserve legacy behavior.
  if (!state.ai || !state.blackboard) return;
  const manager = state.ai;
  if (!manager.enabled) return;
  if (manager.tickInterval <= 0) return;

  manager.accumulator += delta;

  while (manager.accumulator >= manager.tickInterval) {
    manager.accumulator -= manager.tickInterval;
    manager.tickIndex += 1;
    state.blackboard.tickIndex = manager.tickIndex;

    const ships = state.queries.ships.entities as ShipEntity[];
    if (ships.length === 0) {
      manager.cursor = 0;
      manager.assignments.escorts.clear();
      state.blackboard.nearestEnemy.clear();
      state.blackboard.threatToVip.clear();
      const metrics = manager.metrics;
      metrics.lastDecisions = 0;
      metrics.lastSkipped = 0;
      metrics.lastSliceSize = 0;
      metrics.lastTotalShips = 0;
      continue;
    }

    const entityById = new Map<number, ShipEntity>();
    for (const ship of ships) entityById.set(ship.id, ship);

    refreshBlackboard(state, ships);
    assignTeamRoles(state, ships);
    runShipDecisions(state, ships, entityById);
  }
}

export function runDecisionTick(state: GameState, delta: number): void {
  updateDecisionSystem(state, delta);
}

function refreshBlackboard(state: GameState, ships: ShipEntity[]): void {
  const { blackboard } = state;
  const centroid = blackboard.allyCentroid;
  centroid.blue.set(0, 0, 0);
  centroid.red.set(0, 0, 0);
  let blueCount = 0;
  let redCount = 0;
  let blueHp = 0;
  let redHp = 0;

  blackboard.nearestEnemy.clear();
  blackboard.threatToVip.clear();

  const shipsLength = ships.length;
  for (let i = 0; i < shipsLength; i += 1) {
    const ship = ships[i];
    if (ship.ship.team === 'blue') {
      centroid.blue.add(ship.transform.position);
      blueCount += 1;
      blueHp += ship.ship.hp;
    } else {
      centroid.red.add(ship.transform.position);
      redCount += 1;
      redHp += ship.ship.hp;
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
        blackboard.threatToVip.set(ship.id, bestId);
      }
    }
  }

  const blueStrength = redHp > 0 ? blueHp / redHp : 1;
  const redStrength = blueHp > 0 ? redHp / blueHp : 1;
  blackboard.teamPosture.blue = resolvePosture(blueStrength);
  blackboard.teamPosture.red = resolvePosture(redStrength);
}

function resolvePosture(strengthRatio: number): TeamPosture {
  if (strengthRatio > 1.25) return 'aggressive';
  if (strengthRatio < 0.8) return 'retreat';
  return 'hold';
}

function assignTeamRoles(state: GameState, ships: ShipEntity[]): void {
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

  const compareById = (a: ShipEntity, b: ShipEntity) => a.id - b.id;
  for (const team of ['blue', 'red'] as const) {
    const vips = teamVips[team].sort(compareById);
    const pool = teamEscorts[team].sort(compareById);
    const vipCount = vips.length;
    if (vipCount === 0) continue;
    for (let i = 0; i < pool.length; i += 1) {
      const vip = vips[i % vipCount];
      escorts.set(pool[i].id, vip.id);
    }
  }
}

function runShipDecisions(
  state: GameState,
  ships: ShipEntity[],
  entityById: Map<number, ShipEntity>,
): void {
  const manager = state.ai;
  const total = ships.length;
  if (total === 0) return;

  const slices = Math.max(1, Math.ceil(total / Math.max(1, manager.maxPerTick)));
  manager.slices = slices;
  const sliceSize = Math.min(manager.maxPerTick, Math.ceil(total / slices));
  const startIndex = manager.cursor % total;

  const metrics = manager.metrics;
  metrics.lastTotalShips = total;
  metrics.lastSliceSize = sliceSize;
  let decisions = 0;
  let skipped = 0;

  for (let processed = 0; processed < sliceSize && processed < total; processed += 1) {
    const index = (startIndex + processed) % total;
    const ship = ships[index];
    const ai = ship.ai;
    if (!ai) {
      skipped += 1;
      continue;
    }
    if (ai.nextThinkAt > manager.tickIndex) {
      skipped += 1;
      continue;
    }

    evaluateShip(state, ship, ai, entityById);
    decisions += 1;
  }

  manager.cursor = (startIndex + sliceSize) % total;

  metrics.lastDecisions = decisions;
  metrics.lastSkipped = skipped;
  metrics.totalDecisions += decisions;
  metrics.totalSkipped += skipped;
  if (sliceSize < total) {
    metrics.budgetHits += 1;
  }
}

function evaluateShip(
  state: GameState,
  ship: ShipEntity,
  ai: AIState,
  entityById: Map<number, ShipEntity>,
): void {
  const profile = resolveBehaviorProfile(ai.profileId);
  if (!ai.traits) {
    ai.traits = generateTraitsFromSeed(ai.traitSeed);
  }
  const blackboard = state.blackboard;
  const nearestEnemyId = blackboard.nearestEnemy.get(ship.id);
  const target = nearestEnemyId != null ? entityById.get(nearestEnemyId) ?? null : null;
  const escortTargetId = state.ai.assignments.escorts.get(ship.id);
  const escortTarget = escortTargetId != null ? entityById.get(escortTargetId) ?? null : null;

  const intent = selectIntent(state, ship, ai, profile, target, escortTarget);
  ai.intent = intent.intent;
  ai.lastScore = intent.score;
  ai.targetId = intent.target?.id ?? target?.id;

  const lod = computeLod(ship, target, profile);
  ai.lod = lod;
  const spacing = lod === 0 ? 1 : lod === 1 ? 2 : 4;
  ai.nextThinkAt = state.ai.tickIndex + spacing;

  writeCommand(state, ship, ai, profile, intent.target ?? target, escortTarget);
}

function selectIntent(
  state: GameState,
  ship: ShipEntity,
  ai: AIState,
  profile: BehaviorProfile,
  primaryTarget: ShipEntity | null,
  escortTarget: ShipEntity | null,
): IntentCandidate {
  const candidates: IntentCandidate[] = [];
  const posture = state.blackboard.teamPosture[ship.ship.team];

  const traits = ai.traits;

  const attackScore = scoreAttackIntent(ship, profile, primaryTarget, posture, traits);
  candidates.push({ intent: 'Attack', score: attackScore, target: primaryTarget });

  const kiteScore = scoreKiteIntent(ship, profile, primaryTarget, posture, traits);
  candidates.push({ intent: 'Kite', score: kiteScore, target: primaryTarget });

  if (escortTarget) {
    const escortScore = scoreEscortIntent(ship, profile, escortTarget, state, traits);
    candidates.push({ intent: 'Escort', score: escortScore, target: escortTarget });
  }

  if (primaryTarget) {
    const interceptScore = scoreInterceptIntent(
      state,
      ship,
      profile,
      primaryTarget,
      escortTarget,
      posture,
      traits,
    );
    candidates.push({ intent: 'Intercept', score: interceptScore, target: primaryTarget });

    const repositionScore = scoreRepositionIntent(state, ship, profile, primaryTarget, traits, posture);
    candidates.push({ intent: 'Reposition', score: repositionScore, target: primaryTarget });
  } else {
    const repositionScore = scoreRepositionIntent(state, ship, profile, null, traits, posture);
    candidates.push({ intent: 'Reposition', score: repositionScore });
  }

  const regroupScore = scoreRegroupIntent(state, ship, profile, posture, traits);
  candidates.push({ intent: 'Regroup', score: regroupScore });

  const fleeScore = scoreFleeIntent(ship, profile, primaryTarget, posture, traits);
  candidates.push({ intent: 'Flee', score: fleeScore, target: primaryTarget });

  candidates.sort((a, b) => b.score - a.score);
  return tieBreak(ai, state.ai.tickIndex, candidates);
}

function scoreAttackIntent(
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  posture: TeamPosture,
  traits: AITraits,
): number {
  if (!target) return 0;
  const desiredMin = profile.desiredRange[0];
  const desiredMax = profile.desiredRange[1];
  const dist = ship.transform.position.distanceTo(target.transform.position);
  const mid = (desiredMin + desiredMax) * 0.5;
  const bandError = Math.abs(dist - mid);
  const hpRatio = ship.ship.hp / Math.max(1, ship.ship.maxHp);
  const aggression = profile.aggression * traits.aggression;
  let score = 1000 - bandError * 4 + aggression * 120;
  score += hpRatio * 80;
  if (posture === 'aggressive') score += 90;
  if (posture === 'retreat') score -= 120;
  const bias = profile.classBias[target.ship.hull] ?? 0;
  score += bias;
  return Math.floor(score);
}

function scoreInterceptIntent(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity,
  escortTarget: ShipEntity | null,
  posture: TeamPosture,
  traits: AITraits,
): number {
  const style = profile.style;
  if (style !== 'escort' && style !== 'brawler' && style !== 'artillery') {
    return 180;
  }

  const distance = ship.transform.position.distanceTo(target.transform.position);
  const desiredMax = profile.desiredRange[1];
  const bandPressure = Math.max(0, distance - desiredMax);

  const targetSpeed = getSpeedMagnitude(target);
  const threatBonus = computeThreatBonus(state, ship.ship.team, target.id);
  const escortBonus = escortTarget && isThreatPair(state, escortTarget.id, target.id) ? 160 : 0;
  const aggression = profile.aggression * traits.aggression;

  let score = 480 + bandPressure * 2 + targetSpeed * 14 + aggression * 110 + threatBonus + escortBonus;
  if (posture === 'aggressive') score += 140;
  if (posture === 'retreat') score -= 110;

  return Math.floor(score);
}

function scoreRepositionIntent(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  traits: AITraits,
  posture: TeamPosture,
): number {
  const patience = profile.patience * traits.patience;
  const centroid = state.blackboard.allyCentroid[ship.ship.team];
  if (!target) {
    const centroidDist = ship.transform.position.distanceTo(centroid);
    const desire = profile.desiredRange[0];
    const spacing = Math.max(0, centroidDist - desire * 1.5);
    let base = 220 + spacing * 1.2 + patience * 70;
    if (posture === 'hold') base += 50;
    if (posture === 'retreat') base -= 40;
    return Math.floor(base);
  }

  const desiredMin = profile.desiredRange[0];
  const desiredMax = profile.desiredRange[1];
  const distance = ship.transform.position.distanceTo(target.transform.position);
  const below = Math.max(0, desiredMin - distance);
  const above = Math.max(0, distance - desiredMax);
  let bandError = Math.abs(distance - (desiredMin + desiredMax) * 0.5);

  let score = 260 + (below + above) * 2.2 + bandError * 0.9 + patience * 80;
  if (profile.style === 'artillery') score += 150;
  if (profile.style === 'kiter') score += 90;
  if (posture === 'retreat') score -= 60;
  return Math.floor(score);
}

function scoreRegroupIntent(
  state: GameState,
  ship: ShipEntity,
  profile: BehaviorProfile,
  posture: TeamPosture,
  traits: AITraits,
): number {
  const centroid = state.blackboard.allyCentroid[ship.ship.team];
  const distance = ship.transform.position.distanceTo(centroid);
  const hpRatio = ship.ship.hp / Math.max(1, ship.ship.maxHp);
  const gate = profile.gates?.hpRetreatPct ?? 0.3;
  const patience = profile.patience * traits.patience;

  if (posture === 'retreat' || hpRatio <= gate + 0.05) {
    let score = 420 + distance * 1.1 + (1 - hpRatio) * 260 + patience * 90;
    if (posture === 'retreat') score += 140;
    return Math.floor(score);
  }

  if (distance > profile.desiredRange[1] * 2.5) {
    return Math.floor(260 + distance * 0.8 + patience * 60);
  }

  return 180;
}

function scoreKiteIntent(
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  posture: TeamPosture,
  traits: AITraits,
): number {
  if (!target) return 100;
  const dist = ship.transform.position.distanceTo(target.transform.position);
  const desiredMax = profile.desiredRange[1];
  const hpRatio = ship.ship.hp / Math.max(1, ship.ship.maxHp);
  let score = 500 + (dist - desiredMax) * 3;
  score += (1 - hpRatio) * 200;
  const patience = profile.patience * traits.patience;
  score += patience * 80;
  score += traits.dodge * 50;
  if (posture === 'retreat') score += 120;
  if (posture === 'aggressive') score -= 60;
  return Math.floor(score);
}

function scoreEscortIntent(
  ship: ShipEntity,
  profile: BehaviorProfile,
  escortTarget: ShipEntity,
  state: GameState,
  traits: AITraits,
): number {
  const dist = ship.transform.position.distanceTo(escortTarget.transform.position);
  const threatId = state.blackboard.threatToVip.get(escortTarget.id);
  const threatWeight = threatId != null ? 180 : 0;
  const bandError = Math.abs(dist - profile.desiredRange[0]);
  const patience = profile.patience * traits.patience;
  return Math.floor(700 - bandError * 2 + patience * 90 + threatWeight);
}

function scoreFleeIntent(
  ship: ShipEntity,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  posture: TeamPosture,
  traits: AITraits,
): number {
  const hpRatio = ship.ship.hp / Math.max(1, ship.ship.maxHp);
  const gate = profile.gates?.hpRetreatPct ?? 0.2;
  const patience = profile.patience * traits.patience;
  if (hpRatio > gate && posture !== 'retreat') return Math.floor(150 - patience * 40);
  const threat = target
    ? ship.transform.position.distanceTo(target.transform.position)
    : profile.desiredRange[1];
  const nerve = 1 - Math.min(0.6, patience * 0.3);
  const dodge = 1 + (traits.dodge - 1) * 0.5;
  const base = 400 + (gate - hpRatio) * 400 * (1 + patience * 0.1);
  return Math.floor((base + Math.max(0, 300 - threat) * dodge) * (1 + nerve * 0.25));
}

function getSpeedMagnitude(ship: ShipEntity): number {
  const velocity = getShipVelocity(ship, TEMP_TARGET_VEL);
  return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
}

function getShipVelocity(ship: ShipEntity, out: Vector3): Vector3 {
  const body = ship.rigidBody as unknown as { linvel?: () => { x: number; y: number; z: number } };
  if (body?.linvel) {
    const vel = body.linvel();
    out.set(vel.x, vel.y, vel.z);
    return out;
  }
  out.set(0, 0, 0);
  return out;
}

function computeThreatBonus(state: GameState, team: Team, targetId: number): number {
  const threat = state.blackboard.threatToVip;
  for (const [vipId, threatId] of threat.entries()) {
    const vip = getShipById(state, vipId);
    if (vip && vip.ship.team === team && threatId === targetId) {
      return 180;
    }
  }
  return 0;
}

function isThreatPair(state: GameState, vipId: number, targetId: number): boolean {
  return state.blackboard.threatToVip.get(vipId) === targetId;
}

function computeInterceptHeadingVector(ship: ShipEntity, target: ShipEntity, out: Vector3): Vector3 {
  const projectileSpeed = Math.max(1, Math.max(ship.ship.projectileSpeed, ship.ship.speed * 0.75));
  const relativePos = TEMP_REL_POS.copy(target.transform.position).sub(ship.transform.position);
  const targetVel = getShipVelocity(target, TEMP_TARGET_VEL);
  const shipVel = getShipVelocity(ship, TEMP_SHIP_VEL);
  const relativeVel = TEMP_REL_VEL.copy(targetVel).sub(shipVel);

  const a = relativeVel.lengthSq() - projectileSpeed * projectileSpeed;
  const b = 2 * relativeVel.dot(relativePos);
  const c = relativePos.lengthSq();

  let t = 0;
  if (Math.abs(a) < 1e-5) {
    t = b !== 0 ? Math.max(0, -c / b) : 0;
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const sqrt = Math.sqrt(discriminant);
      const t1 = (-b - sqrt) / (2 * a);
      const t2 = (-b + sqrt) / (2 * a);
      t = Math.min(t1, t2);
      if (t < 0) t = Math.max(t1, t2);
      if (t < 0) t = 0;
    } else {
      t = Math.max(0, -b / (2 * a));
    }
  }

  t = Math.min(Math.max(t, 0), 2.5);
  const future = out.copy(target.transform.position).addScaledVector(targetVel, t);
  future.sub(ship.transform.position);
  if (future.lengthSq() < 1e-5) {
    out.copy(relativePos);
  } else {
    out.copy(future);
  }
  if (out.lengthSq() < 1e-5) {
    out.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
  } else {
    out.normalize();
  }
  return out;
}

function tieBreak(ai: AIState, tickIndex: number, candidates: IntentCandidate[]): IntentCandidate {
  if (candidates.length === 0) {
    return { intent: 'Attack', score: 0 };
  }
  const topScore = candidates[0].score;
  const tied = candidates.filter((c) => c.score === topScore);
  if (tied.length === 1) return tied[0];
  const seed = ai.traitSeed ^ (tickIndex * 4099);
  const idx = Math.abs(hashToInt(seed)) % tied.length;
  return tied[idx];
}

function hashToInt(value: number): number {
  let x = value >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x | 0;
}

function computeLod(ship: ShipEntity, target: ShipEntity | null, profile: BehaviorProfile): 0 | 1 | 2 {
  if (!target) return 2;
  const dist = ship.transform.position.distanceTo(target.transform.position);
  const active = Math.max(profile.desiredRange[1], AI_CONFIG.lod.activeDistance);
  if (dist <= active) return 0;
  if (dist <= AI_CONFIG.lod.idleDistance) return 1;
  return 2;
}

function writeCommand(
  state: GameState,
  ship: ShipEntity,
  ai: AIState,
  profile: BehaviorProfile,
  target: ShipEntity | null,
  escortTarget: ShipEntity | null,
): void {
  const command = ai.command;
  const heading = command.heading;
  command.ttl = state.ai.tickInterval;

  switch (ai.intent) {
    case 'Intercept':
      if (target) {
        computeInterceptHeadingVector(ship, target, heading);
        command.thrust = 1;
        const distance = ship.transform.position.distanceTo(target.transform.position);
        command.firePrimary = distance <= ship.ship.range * 1.15;
        command.targetId = target.id;
      } else {
        heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
        command.thrust = 0.8;
        command.firePrimary = false;
        command.targetId = undefined;
      }
      break;
    case 'Reposition':
      if (target) {
        heading.copy(target.transform.position).sub(ship.transform.position);
        const distance = heading.length();
        if (distance > 1e-5) {
          heading.divideScalar(distance);
          const tangent = TEMP_REL_POS.set(-heading.z, 0, heading.x);
          // Use time-varying parity based on global tick index to diversify formations
          const hash = hashToInt(ship.id ^ (state.ai.tickIndex * 491));
          if (tangent.lengthSq() > 1e-5) {
            tangent.normalize();
            if (hash & 1) tangent.negate();
            heading.multiplyScalar(0.6).addScaledVector(tangent, 0.4).normalize();
          }
        } else {
          heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
        }
          const desiredMin = profile.desiredRange[0];
          const desiredMax = profile.desiredRange[1];
        let shouldFire = distance <= ship.ship.range;
        if (distance > desiredMax * 1.05) {
          command.thrust = 0.95;
        } else if (distance < desiredMin * 0.95) {
          heading.negate();
          heading.normalize();
          command.thrust = 0.6;
          shouldFire = false;
        } else {
          command.thrust = profile.style === 'artillery' ? 0.3 : 0.45;
          if (shouldFire) {
            shouldFire = distance >= desiredMin && distance <= desiredMax;
          }
        }
        command.firePrimary = shouldFire;
        command.targetId = target.id;
      } else {
        const centroid = state.blackboard.allyCentroid[ship.ship.team];
        heading.copy(centroid).sub(ship.transform.position);
        if (heading.lengthSq() < 1e-5) {
          heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
        } else {
          heading.normalize();
        }
        command.thrust = 0.55;
        command.firePrimary = false;
        command.targetId = undefined;
      }
      break;
    case 'Regroup':
      {
        const centroid = state.blackboard.allyCentroid[ship.ship.team];
        heading.copy(centroid).sub(ship.transform.position);
        if (heading.lengthSq() < 1e-5) {
          heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
        } else {
          heading.normalize();
        }
        const hpRatio = ship.ship.hp / Math.max(1, ship.ship.maxHp);
        const urgency = 1 + Math.max(0, 1 - hpRatio) * 0.5;
        const posture = state.blackboard.teamPosture[ship.ship.team];
        const base = posture === 'retreat' ? 0.95 : 0.75;
        command.thrust = Math.min(1, base * urgency);
        command.firePrimary = false;
        command.targetId = undefined;
      }
      break;
    case 'Escort':
      if (escortTarget) {
        heading.copy(escortTarget.transform.position).sub(ship.transform.position);
        if (heading.lengthSq() < 1e-5) {
          heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
        } else {
          heading.normalize();
        }
      } else {
        heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
      }
      command.thrust = 0.8;
      command.firePrimary = false;
      command.targetId = escortTarget?.id;
      break;
    case 'Kite':
      if (target) {
        heading
          .copy(ship.transform.position)
          .sub(target.transform.position)
          .normalize();
      } else {
        heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
      }
      command.thrust = 1;
      command.firePrimary = target != null;
      command.targetId = target?.id;
      break;
    case 'Flee':
      {
        const allyCentroid = state.blackboard.allyCentroid[ship.ship.team];
        heading.copy(allyCentroid).sub(ship.transform.position);
        if (heading.lengthSq() < 1e-5) {
          heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
        } else {
          heading.normalize();
        }
        command.thrust = 1;
        command.firePrimary = false;
        command.targetId = undefined;
      }
      break;
    case 'Attack':
    default:
      if (target) {
        heading.copy(target.transform.position).sub(ship.transform.position).normalize();
        const dist = ship.transform.position.distanceTo(target.transform.position);
        const desiredMin = profile.desiredRange[0];
        const desiredMax = profile.desiredRange[1];
        if (dist > desiredMax) {
          command.thrust = 1;
        } else if (dist < desiredMin) {
          heading.negate();
          command.thrust = 0.6;
        } else {
          command.thrust = 0.35;
        }
        command.firePrimary = dist <= ship.ship.range;
        command.targetId = target.id;
      } else {
        heading.set(0, 0, 1).applyQuaternion(ship.transform.rotation);
        command.thrust = 0;
        command.firePrimary = false;
        command.targetId = undefined;
      }
      break;
  }
}

export function updateGame(state: GameState, delta: number): void {
  const sim = state.simulation;
  sim.lastTickStart = state.time;
  sim.lastTickDuration = delta;
  sim.lastTickIndex += 1;

  state.time += delta;

  updateDecisionSystem(state, delta);

  prepareShips(state, delta);
  updateCarrierLaunchSystem(state, delta);
  updateTurrets(state, delta);
  
  // Apply physics-based motion after AI decisions but before physics step
  updateMotionSystem(state, delta);
  
  advanceProjectiles(state, delta);

  state.physicsWorld.step(state.eventQueue);

  syncTransforms(state);
  resolveProjectiles(state, delta);
}

function prepareShips(state: GameState, delta: number): void {
  const ships = state.queries.ships.entities as ShipEntity[];
  // If AI manager is not present (tests with lightweight stubs), stay on legacy behavior.
  const useAIV2 = !!state.ai?.enabled;

  for (const ship of ships) {
    ship.ship.cooldown = Math.max(0, ship.ship.cooldown - delta);
    if (ship.turrets) {
      for (const turret of ship.turrets) turret.cooldown = Math.max(0, turret.cooldown - delta);
    }

    const regen = ship.ship.shieldRegen ?? 0;
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
      ship.muzzleFlashes = ship.muzzleFlashes.filter((m) => state.time - m.t0 < life);
    }
  }
}

function executeAICommand(state: GameState, ship: ShipEntity, delta: number): ShipEntity | null {
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
  // Do not snap rotation here; motion system will steer toward heading.
  // (Optional) Clamp how fast the commanded heading can rotate per tick.
  try {
    const motion = ship.ship.motion;
      const tickHz = state.ai && state.ai.tickInterval > 0 ? 1 / state.ai.tickInterval : 10;
    const perTick = 1 / tickHz;
    const maxYawDelta = Math.max(0.05, motion.maxTurnRate * Math.max(perTick, delta));
    const currentForward = new Vector3(0, 0, 1).applyQuaternion(ship.transform.rotation);
    const cf = new Vector3(currentForward.x, 0, currentForward.z);
    const dh = new Vector3(heading.x, 0, heading.z);
    if (cf.lengthSq() > 1e-6 && dh.lengthSq() > 1e-6) {
      cf.normalize();
      dh.normalize();
      const currentYaw = Math.atan2(cf.x, cf.z);
      const targetYaw = Math.atan2(dh.x, dh.z);
      let dyaw = targetYaw - currentYaw;
      while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
      while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
      const clamped = Math.max(-maxYawDelta, Math.min(maxYawDelta, dyaw));
      const newYaw = currentYaw + clamped;
      heading.set(Math.sin(newYaw), 0, Math.cos(newYaw));
    }
  } catch {
    // fallback: keep heading as-is
  }

  const thrust = Math.min(1, Math.max(0, command.thrust));
  if (thrust > 0) {
    const moveDistance = ship.ship.speed * thrust * delta;
    const nextPosition = TEMP_POS.copy(ship.transform.position).addScaledVector(heading, moveDistance);
    clampToWorld(nextPosition);
    ship.rigidBody.setNextKinematicTranslation({ x: nextPosition.x, y: nextPosition.y, z: nextPosition.z });
  } else {
    ship.rigidBody.setNextKinematicTranslation({
      x: ship.transform.position.x,
      y: ship.transform.position.y,
      z: ship.transform.position.z,
    });
  }

  let target: ShipEntity | null = null;
  if (command.targetId != null) {
    target = getShipById(state, command.targetId);
  } else if (ai.targetId != null) {
    target = getShipById(state, ai.targetId);
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
    fireProjectile(state, ship, fireDir);
    ship.ship.cooldown = ship.ship.fireRate;
  }

  return target;
}

function runLegacyShipBehavior(state: GameState, ship: ShipEntity, delta: number): ShipEntity | null {
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
    fireProjectile(state, ship, direction);
    ship.ship.cooldown = ship.ship.fireRate;
  }

  return target;
}

function runEmbeddedTurrets(state: GameState, ship: ShipEntity, target: ShipEntity): void {
  for (const turret of ship.turrets ?? []) {
    if (turret.cooldown > 0) continue;
    const turretOrigin = getTurretWorldPosition(ship, turret);
    const toTarget = TEMP_DIR.copy(target.transform.position).sub(turretOrigin);
    const dist = toTarget.length();
    if (dist > turret.range) continue;
    if (dist > 1e-5) toTarget.divideScalar(dist);
    else toTarget.set(0, 0, 1);
    fireProjectile(state, ship, toTarget, {
      originPosition: turretOrigin,
      override: {
        damage: turret.damage,
        projectileSpeed: turret.projectileSpeed,
        range: turret.range,
        bulletType: turret.bulletType,
      },
    });
    turret.cooldown = turret.fireRate;
  }
}

function updateTurrets(state: GameState, delta: number): void {
  const turrets = state.queries.turrets.entities as TurretEntity[];
  for (const t of turrets) {
    const ship = t.turret.parent;
    // sync turret transform with parent + local offset
    const origin = getTurretWorldPosition(ship, { offset: t.turret.offset } as TurretState);
    t.rigidBody.setNextKinematicTranslation({ x: origin.x, y: origin.y, z: origin.z });
    // choose target considering priority
    let target = findNearestEnemy(state, ship);
    if (t.turret.priority && t.turret.priority !== 'any') {
      const ships = state.queries.ships.entities as ShipEntity[];
      const candidates = ships.filter((s) => s.ship.team !== ship.ship.team);
      const small = new Set(['fighter', 'corvette']);
      const large = new Set(['frigate', 'destroyer', 'carrier']);
      const preferSmall = t.turret.priority === 'antiFighter';
      let bestScore = Number.POSITIVE_INFINITY;
      let best: ShipEntity | null = null;
      for (const s of candidates) {
        const d = s.transform.position.distanceTo(origin);
        const bonus = preferSmall
          ? small.has(s.ship.hull)
            ? -10
            : large.has(s.ship.hull)
              ? +5
              : 0
          : large.has(s.ship.hull)
            ? -10
            : small.has(s.ship.hull)
              ? +5
              : 0;
        const score = d + bonus;
        if (score < bestScore) {
          bestScore = score;
          best = s;
        }
      }
      if (best) target = best;
    }
    // cooldown
    t.turret.cooldown = Math.max(0, t.turret.cooldown - delta);
    if (!target || t.turret.cooldown > 0) continue;
    const toTarget = TEMP_DIR.copy(target.transform.position).sub(origin);
    const dist = toTarget.length();
    if (dist > t.turret.range) continue;
    if (dist > 1e-5) toTarget.divideScalar(dist);
    else toTarget.set(0, 0, 1);
    // Compute direction in parent ship's local frame to derive yaw/pitch
    const invRot = ship.transform.rotation.clone().invert();
    const localDir = toTarget.clone().applyQuaternion(invRot);
    // yaw around Y, pitch around X
    const yaw = Math.atan2(localDir.x, localDir.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, localDir.y)));
    // clamp to arcs
    const minYaw = t.turret.minYaw ?? -Math.PI;
    const maxYaw = t.turret.maxYaw ?? Math.PI;
    const minPitch = t.turret.minPitch ?? -Math.PI * 0.5;
    const maxPitch = t.turret.maxPitch ?? Math.PI * 0.5;
    const clampedYaw = Math.max(minYaw, Math.min(maxYaw, yaw));
    const clampedPitch = Math.max(minPitch, Math.min(maxPitch, pitch));
    t.turret.yaw = clampedYaw;
    t.turret.pitch = clampedPitch;
    // Only fire if the unclamped yaw/pitch are within limits (i.e., we can aim at target)
    const withinArc = yaw === clampedYaw && pitch === clampedPitch;
    // set turret rotation to parent rotation * yaw * pitch
    const yawQ = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), clampedYaw);
    const pitchQ = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), clampedPitch);
    const turretRot = ship.transform.rotation.clone().multiply(yawQ).multiply(pitchQ);
    t.rigidBody.setNextKinematicRotation({
      x: turretRot.x,
      y: turretRot.y,
      z: turretRot.z,
      w: turretRot.w,
    });
    if (!withinArc) continue;
    // prune old flashes, then add a new one (local forward of turret group)
    if (t.muzzleFlashes && t.muzzleFlashes.length) {
      const life = 0.25;
      t.muzzleFlashes = t.muzzleFlashes.filter((m) => state.time - m.t0 < life);
    }
    (t.muzzleFlashes ??= []).push({
      local: new Vector3(0, 0, 0.2),
      t0: state.time,
      amp: 0.9,
      bulletType: t.turret.bulletType,
    });
    // fire
    fireProjectile(state, ship, toTarget, {
      originPosition: origin,
      override: {
        damage: t.turret.damage,
        projectileSpeed: t.turret.projectileSpeed,
        range: t.turret.range,
        bulletType: t.turret.bulletType,
      },
    });
    t.turret.cooldown = t.turret.fireRate;
  }
}

function advanceProjectiles(state: GameState, delta: number): void {
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  for (const projectile of projectiles) {
    const move = projectile.projectile.speed * delta;
    const direction = projectile.direction;
    const current = projectile.transform.position;
    const next = TEMP_POS.copy(current).addScaledVector(direction, move);
    clampToWorld(next);

    projectile.rigidBody.setNextKinematicTranslation({ x: next.x, y: next.y, z: next.z });
  }
}

function syncTransforms(state: GameState): void {
  for (const entity of state.world.entities as GameEntity[]) {
    const translation = entity.rigidBody.translation();
    const rotation = entity.rigidBody.rotation();

    entity.transform.position.set(translation.x, translation.y, translation.z);
    entity.transform.rotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }
}

function resolveProjectiles(state: GameState, delta: number): void {
  const ships = state.queries.ships.entities as ShipEntity[];
  const projectiles = state.queries.projectiles.entities as ProjectileEntity[];
  const toRemove = new Set<GameEntity>();

  for (const projectile of projectiles) {
    projectile.projectile.ttl -= delta;
    if (projectile.projectile.ttl <= 0) {
      toRemove.add(projectile);
      continue;
    }

    for (const ship of ships) {
      if (ship.ship.team === projectile.projectile.team) continue;
      const distance = ship.transform.position.distanceTo(projectile.transform.position);
      const impactRadius = ship.transform.scale * 0.9;
      if (distance > impactRadius) continue;
      // Apply damage to shields first, then to hull.
      let remaining = projectile.projectile.damage;
      if (ship.ship.shield > 0) {
        const absorbed = Math.min(ship.ship.shield, remaining);
        ship.ship.shield -= absorbed;
        remaining -= absorbed;
        // Emit a shield ripple event oriented from impact direction.
        const dir = TEMP_DIR.copy(projectile.transform.position).sub(ship.transform.position);
        if (dir.lengthSq() > 1e-5) dir.normalize();
        else dir.set(0, 0, 1);
        const strength = Math.min(1, absorbed / Math.max(1, ship.ship.maxShield));
        const ripple: ShieldRipple = { dir: dir.clone(), t0: state.time, amp: strength };
        // Always append ripple events to the ship's history; the renderer/coalescer
        // will select up to maxRipples of the latest entries and handle visual blending.
        const list = (ship.shieldRipples ??= []);
        list.push(ripple);
        // Keep a reasonable history cap to avoid unbounded growth
        if (list.length > 64) list.shift();
      }

      if (remaining > 0) {
        ship.ship.hp -= remaining;
      }
      toRemove.add(projectile);

      if (ship.ship.hp <= 0) {
        toRemove.add(ship);
      }
      break;
    }
  }

  for (const entity of toRemove) {
    destroyEntity(state, entity);
  }
}

function orientTowards(ship: ShipEntity, direction: Vector3): void {
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

export function fireProjectile(
  state: GameState,
  origin: ShipEntity,
  direction: Vector3,
  opts?: {
    /** If provided, use this exact world position as muzzle; otherwise use ship nose offset. */
    originPosition?: Vector3;
    /** Override projectile stats (used by turrets). */
    override?: Partial<
      Pick<ShipEntity['ship'], 'damage' | 'projectileSpeed' | 'range' | 'bulletType'>
    >;
  },
): void {
  const muzzleOffset = origin.transform.scale * 1.6;
  const startPosition = opts?.originPosition
    ? opts.originPosition.clone()
    : origin.transform.position.clone().addScaledVector(direction, muzzleOffset);
  const rotation = new Quaternion().setFromUnitVectors(FORWARD, direction);

  const bodyDesc = state.rapier.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(startPosition.x, startPosition.y, startPosition.z)
    .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
  const body = state.physicsWorld.createRigidBody(bodyDesc);

  // Choose visual/physics size based on bullet type configuration
  const bulletKey = opts?.override?.bulletType ?? origin.ship.bulletType ?? '';
  const cfg = PROJECTILE_CONFIG[bulletKey] ?? DEFAULT_PROJECTILE_CONFIG;
  const visualScale = cfg.visualScale ?? DEFAULT_PROJECTILE_CONFIG.visualScale;
  const colliderRadius = cfg.colliderRadius ?? Math.max(0.08, visualScale * 1.2);

  const colliderDesc = state.rapier.ColliderDesc.ball(colliderRadius)
    .setActiveEvents(state.rapier.ActiveEvents.COLLISION_EVENTS)
    .setActiveCollisionTypes(state.rapier.ActiveCollisionTypes.ALL);
  const collider = state.physicsWorld.createCollider(colliderDesc, body);

  const speed = opts?.override?.projectileSpeed ?? origin.ship.projectileSpeed;
  const damage = opts?.override?.damage ?? origin.ship.damage;
  const range = opts?.override?.range ?? origin.ship.range;
  const lifetime = Math.min(range / speed, 20);

  const projectile = state.world.createEntity({
    id: state.nextEntityId++,
    rigidBody: body,
    collider,
    transform: {
      position: startPosition,
      rotation,
      scale: visualScale,
    },
    projectile: {
      team: origin.ship.team,
      damage,
      ttl: lifetime,
      maxTtl: lifetime,
      speed,
      bulletType: opts?.override?.bulletType ?? origin.ship.bulletType,
    },
    direction: direction.clone(),
  }) as ProjectileEntity;

  state.colliderLookup.set(collider.handle, projectile);
}

export function findNearestEnemy(state: GameState, origin: ShipEntity): ShipEntity | null {
  const ships = state.queries.ships.entities as ShipEntity[];
  let closest: ShipEntity | null = null;
  let shortest = Number.POSITIVE_INFINITY;

  for (const ship of ships) {
    if (ship === origin) continue;
    if (ship.ship.team === origin.ship.team) continue;
    const distance = origin.transform.position.distanceTo(ship.transform.position);
    if (distance < shortest) {
      shortest = distance;
      closest = ship;
    }
  }

  return closest;
}

export const __aiTestHooks = {
  updateDecisionSystem,
  refreshBlackboard,
  assignTeamRoles,
  selectIntent,
  scoreAttackIntent,
  scoreKiteIntent,
  scoreEscortIntent,
  scoreInterceptIntent,
  scoreRepositionIntent,
  scoreRegroupIntent,
  scoreFleeIntent,
  tieBreak,
  computeLod,
  writeCommand,
  prepareShips,
  runLegacyShipBehavior,
  computeInterceptHeadingVector,
};

function getShipById(state: GameState, id: number | undefined): ShipEntity | null {
  if (id == null) return null;
  const ships = state.queries.ships.entities as ShipEntity[];
  for (const ship of ships) {
    if (ship.id === id) return ship;
  }
  return null;
}

// Compute turret origin in world space from ship transform and local turret offset
function getTurretWorldPosition(ship: ShipEntity, turret: TurretState): Vector3 {
  const world = TEMP_POS.copy(turret.offset).multiplyScalar(ship.transform.scale);
  // rotate by ship rotation, then add ship position
  world.applyQuaternion(ship.transform.rotation).add(ship.transform.position);
  return world;
}
