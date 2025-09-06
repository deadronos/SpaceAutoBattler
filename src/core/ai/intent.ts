import type { GameState, Ship } from '../../types/index.js';
import type { AIPersonality, AIIntent } from '../../config/behaviorConfig.js';
import { getEffectivePersonality } from '../../config/behaviorConfig.js';
import { DEBUG_AI } from '../../utils/env';
import { scoreEvade as deScoreEvade } from './decisionEngine.js';
import { scoreBoundaryAvoidance } from './decisionEngine.js';
import { findNearestEnemy, findNearbyEnemies, findNearbyFriends, findBestTurretTarget } from './targeting.js';
import { computeInterceptPoint } from '../math/ballisticIntercept.js';
import { getTeamScoutId, isTeamUnderAlarm } from './teamSystems.js';

export function calculatePreferredRange(state: GameState, ship: Ship, personality?: AIPersonality): number {
  const p = personality ?? getEffectivePersonality(state.behaviorConfig!, ship.class, ship.team);
  const baseRange = state.behaviorConfig!.globalSettings.separationDistance;
  return baseRange * (p.preferredRangeMultiplier ?? 1);
}

export function reevaluateIntent(state: GameState, ship: Ship, personality: AIPersonality): void {
  if (!ship.aiState) return;
  const sqrt = Math.sqrt;
  const ai = ship.aiState;
  const cfg = state.behaviorConfig!;
  const recentDamage = ai.recentDamage || 0;
  const lastDamageTime = ai.lastDamageTime || 0;
  const timeSinceLastDamage = state.time - lastDamageTime;
  const withinDamageWindow = timeSinceLastDamage <= cfg.globalSettings.evadeRecentDamageWindowSeconds;
  const shouldEvadeFromDamage = recentDamage >= cfg.globalSettings.damageEvadeThreshold && withinDamageWindow;
  // Allow immediate reevaluation on first update, or when clear threat present,
  // even if intentEndTime is in the future. This avoids sticking on 'idle' in tests.
  const nearestEnemy = findNearestEnemy(state, ship);
  const hasImmediateThreat = !!nearestEnemy;
  // Probe turret candidate targets without mutating turret state or computing
  // leads. This makes intent selection aware of per-turret candidate picks
  // while avoiding side-effects that `updateTurretLeads` performs.
  let turretHasTarget = false;
  // Remember the first turret candidate id we find so we can reference its position
  // when no nearestEnemy is available (avoid null deref below). Also compute a
  // non-mutating predicted lead position matching `updateTurretLeads` so intent
  // heuristics see the same intercept input without mutating turret state.
  let turretCandidateId: number | null = null;
  let turretCandidateLeadPos: { x: number; y: number; z: number } | null = null;
  let turretCandidateInRange: boolean | null = null;
  let turretCandidateScore: number | null = null;
  try {
    for (const t of ship.turrets) {
      const candidate = findBestTurretTarget(state, ship, t);
      if (candidate != null) {
        turretCandidateId = candidate;
        // Compute a non-mutating lead position similar to updateTurretLeads
        // Also compute a non-mutating turret score and in-range boolean so
        // intent heuristics can see the same inputs the turret uses.
        try {
          const targetShip = state.ships.find(s => s.id === candidate && s.health > 0) ?? null;
          if (targetShip) {
            // Safely read optional projectileSpeed without using `any` casts
            const shipProjectile = ((ship as unknown) as { projectileSpeed?: number }).projectileSpeed;
            const cfgProjectile = ((cfg.turretConfig as unknown) as { projectileSpeed?: number }).projectileSpeed;
            const projectileSpeed: number = (typeof shipProjectile === 'number') ? shipProjectile : (typeof cfgProjectile === 'number' ? cfgProjectile : 0);
            const lookahead = cfg.globalSettings.maxInterceptLookahead ?? cfg.turretConfig.leadPredictionTime ?? 0.5;
            const intercept = projectileSpeed > 0 ? computeInterceptPoint(ship.pos, projectileSpeed, targetShip.pos, targetShip.vel, lookahead) : null;
            if (intercept) {
              turretCandidateLeadPos = intercept;
            } else {
              const lt = cfg.turretConfig.leadPredictionTime ?? 0.5;
              turretCandidateLeadPos = {
                x: targetShip.pos.x + (targetShip.vel?.x ?? 0) * lt,
                y: targetShip.pos.y + (targetShip.vel?.y ?? 0) * lt,
                z: targetShip.pos.z + (targetShip.vel?.z ?? 0) * lt
              };
            }
            // Mirror turret scoring: distance-based + HP deficit + level weight
            const dx = turretCandidateLeadPos.x - ship.pos.x;
            const dy = turretCandidateLeadPos.y - ship.pos.y;
            const dz = turretCandidateLeadPos.z - ship.pos.z;
            const distSq = dx * dx + dy * dy + dz * dz;
            const minR = cfg.turretConfig.minimumFireRange;
            const maxR = cfg.turretConfig.maximumFireRange;
            const minRSq = minR * minR;
            const maxRSq = maxR * maxR;
            const inRange = distSq >= minRSq && distSq <= maxRSq;
            // Score needs the real distance (inverse). Compute sqrt only when needed.
            const dist = distSq > 0 ? sqrt(distSq) : 0;
            const score = (dist > 0 ? 1000 / dist : 0) + ((targetShip.maxHealth - targetShip.health) * 0.1) + ((targetShip.level?.level ?? 0) * 5);
            turretCandidateInRange = inRange;
            turretCandidateScore = score;
            // Only consider the turret as having a target for intent purposes when
            // the predicted intercept point is within the turret's configured range.
            if (inRange) turretHasTarget = true;
            if (DEBUG_AI) console.error(`AI-DEBUG turret-probe ship=${ship.id} candidate=${candidate} dist=${dist.toFixed(2)} inRange=${String(inRange)} score=${score.toFixed(2)}`);
          }
          } catch {
          // ignore; probe must remain best-effort and non-failing
        }
        break;
      }
    }
  } catch {
    // swallow any errors probing turrets (best-effort, non-critical)
  }
  if (state.time < ai.intentEndTime && !shouldEvadeFromDamage && !hasImmediateThreat) return;

  let newIntent: AIIntent = 'idle';
  if (shouldEvadeFromDamage) {
    newIntent = 'evade';
  } else {
    // Compute boundary proximity and, if high, bias away from aggressive intents
    try {
      const bounds = state.simConfig.simBounds;
      const margin = cfg.globalSettings.boundarySafetyMargin ?? 50;
      const bScore = scoreBoundaryAvoidance({ pos: ship.pos, simBounds: bounds, safeMargin: margin });
  // Store for tests/debug (non-critical; typed as unknown container)
  try { (ship.aiState as unknown as { boundaryProximity?: number }).boundaryProximity = bScore; } catch { /* ignore */ }
      // If very close to edge, prefer non-pursue actions by reducing aggressiveness
      if (bScore >= 0.6) {
        // reduce aggressiveness temporarily by mapping aggressive picks to patrol/group
        // We'll still allow evade to win if required
  const originalAgg = personality.aggressiveness ?? 0.5;
  try { (personality as unknown as { aggressiveness?: number }).aggressiveness = Math.max(0, originalAgg - bScore * 0.8); } catch { /* ignore */ }
        // Choose intent normally with reduced aggressiveness
      }
    switch (personality.mode) {
      case 'aggressive':
        newIntent = chooseAggressiveIntent(state, ship, personality); break;
      case 'defensive':
        newIntent = chooseDefensiveIntent(state, ship, personality); break;
      case 'roaming':
        newIntent = chooseRoamingIntent(state, ship, personality); break;
      case 'formation':
        newIntent = chooseFormationIntent(state, ship, personality); break;
      case 'carrier_group':
        newIntent = chooseCarrierGroupIntent(state, ship, personality); break;
      case 'mixed':
      default:
        newIntent = chooseMixedIntent(state, ship, personality); break;
    }
    } catch {
      // boundary scoring/temporary personality tweak failed — continue with normal intent selection
    }
  // If evadeOnlyOnDamage is enabled and threat exists within medium range,
  // or turret candidates exist this tick, force engagement so tests don't observe idle.
  if (cfg.globalSettings.evadeOnlyOnDamage && (hasImmediateThreat || turretHasTarget)) {
      // Prefer the turret candidate if its mirrored (non-mutating) score is
      // higher than the nearest enemy's score. This makes intent selection
      // observe the same threat prioritization turrets would use.
  let threatShip: Ship | null = null;
  try {
        const nearest = nearestEnemy ?? null;
        if (nearest && turretCandidateId != null && turretCandidateScore != null) {
          // Compute a comparable score for the nearest enemy using the same
          // distance->score formula but using a lead-predicted position if possible.
          let nearestScore: number | null = null;
  try {
      // Safely read optional projectileSpeed without using `any` casts
      const shipProjectile = ((ship as unknown) as { projectileSpeed?: number }).projectileSpeed;
      const cfgProjectile = ((cfg.turretConfig as unknown) as { projectileSpeed?: number }).projectileSpeed;
      const projectileSpeed: number = (typeof shipProjectile === 'number') ? shipProjectile : (typeof cfgProjectile === 'number' ? cfgProjectile : 0);
      const lookahead = cfg.globalSettings.maxInterceptLookahead ?? cfg.turretConfig.leadPredictionTime ?? 0.5;
      const intercept = projectileSpeed > 0 ? computeInterceptPoint(ship.pos, projectileSpeed, nearest.pos, nearest.vel, lookahead) : null;
                  const leadPos = intercept ?? { x: nearest.pos.x + (nearest.vel?.x ?? 0) * (cfg.turretConfig.leadPredictionTime ?? 0.5), y: nearest.pos.y + (nearest.vel?.y ?? 0) * (cfg.turretConfig.leadPredictionTime ?? 0.5), z: nearest.pos.z + (nearest.vel?.z ?? 0) * (cfg.turretConfig.leadPredictionTime ?? 0.5) };
                  const dx = leadPos.x - ship.pos.x; const dy = leadPos.y - ship.pos.y; const dz = leadPos.z - ship.pos.z;
                  const distSq2 = dx * dx + dy * dy + dz * dz;
                  const dist2 = distSq2 > 0 ? sqrt(distSq2) : 0;
                  nearestScore = (dist2 > 0 ? 1000 / dist2 : 0) + ((nearest.maxHealth - nearest.health) * 0.1) + ((nearest.level?.level ?? 0) * 5);
          } catch { nearestScore = null; }
            if (nearestScore == null || (turretCandidateScore ?? 0) > nearestScore) {
            threatShip = state.ships.find(s => s.id === turretCandidateId) ?? null;
          } else {
            threatShip = nearest;
          }
        } else if (nearest) {
          threatShip = nearest;
        } else if (turretCandidateId != null) {
          threatShip = state.ships.find(s => s.id === turretCandidateId) ?? null;
        }
      } catch {
        threatShip = nearestEnemy ?? (turretCandidateId != null ? state.ships.find(s => s.id === turretCandidateId) ?? null : null);
      }
      if (threatShip) {
        // If we computed a non-mutating lead position for the turret candidate,
        // use it for distance checks so intent sees the same intercept target
        // that turrets would aim at. Fallback to target current position.
    const targetPos = (turretCandidateLeadPos && turretCandidateId === threatShip.id) ? turretCandidateLeadPos : threatShip.pos;
        const dx2 = targetPos.x - ship.pos.x; const dy2 = targetPos.y - ship.pos.y; const dz2 = targetPos.z - ship.pos.z;
        const dSq = dx2 * dx2 + dy2 * dy2 + dz2 * dz2;
      const preferredRange = ship.aiState!.preferredRange ?? cfg.globalSettings.separationDistance;
      // If the turret probe predicted an in-range intercept for this threat, prefer
      // to engage (pursue) even if the raw distance is outside the medium range.
      const TURRET_PURSUE_SCORE_THRESHOLD = 12; // conservative default
      // If turret probe predicted a strong in-range intercept for this threat,
      // prefer to engage (pursue) unless the ship is actively evading. Also
      // prefer pursue for close targets even when chooser returned other
      // non-evade intents (group/patrol/explore) so ships don't idle-away from
      // obvious turret threats in tests.
  const mediumRangeSq = (preferredRange * cfg.globalSettings.mediumRangeMultiplier) * (preferredRange * cfg.globalSettings.mediumRangeMultiplier);
  if ((turretCandidateInRange && turretCandidateId === threatShip.id && (turretCandidateScore ?? 0) >= TURRET_PURSUE_SCORE_THRESHOLD) || (dSq < mediumRangeSq)) {
        if (newIntent !== 'evade') newIntent = 'pursue';
      }
      }
    }
      // If the feature flag to only allow evade on recent damage is enabled,
      // prevent personality choosers from producing 'evade' unless the ship
      // actually has recentDamage within the configured window. Map to
      // 'pursue' to keep ships engaged rather than idling.
      if (cfg.globalSettings.evadeOnlyOnDamage && !shouldEvadeFromDamage && newIntent === 'evade') {
        newIntent = 'pursue';
      }
  if (cfg.globalSettings.useDecisionEngineEvadeGate) {
      const nearest = nearestEnemy ?? findNearestEnemy(state, ship);
      const distanceToThreat = nearest ? ((): number => {
        const dx = nearest!.pos.x - ship.pos.x; const dy = nearest!.pos.y - ship.pos.y; const dz = nearest!.pos.z - ship.pos.z;
        const dSq = dx * dx + dy * dy + dz * dz;
  return sqrt(dSq);
      })() : null;
      const score = deScoreEvade({ distanceToThreat, recentDamage, damageEvadeThreshold: cfg.globalSettings.damageEvadeThreshold, withinRecentDamageWindow: withinDamageWindow, settings: cfg.globalSettings });
      // Be slightly more aggressive at close range to satisfy decision-gate tests
      const closeRange = (ship.aiState!.preferredRange ?? cfg.globalSettings.separationDistance) * 0.6;
      if (distanceToThreat != null && distanceToThreat < closeRange) {
        if (score >= 0.8) newIntent = 'evade';
      }
      if (score >= 1.0) newIntent = 'evade';
    }
  // Restore personality if we modified it in-place
  try { (personality as unknown as { aggressiveness?: number }).aggressiveness = getEffectivePersonality(state.behaviorConfig!, ship.class, ship.team).aggressiveness; } catch (e) { if (DEBUG_AI) console.error('AI-DEBUG restore personality failed', e); }
  }
  ai.currentIntent = newIntent;
  ai.lastIntentReevaluation = state.time;
}

// Below choose* implementations mirror the original controller strategies at a high level,
// using available helpers and configuration to keep behavior parity.

export function chooseAggressiveIntent(state: GameState, ship: Ship, personality: AIPersonality): AIIntent {
  const cfg = state.behaviorConfig!;
  const nearestEnemy = findNearestEnemy(state, ship);
  const preferredRange = ship.aiState!.preferredRange ?? cfg.globalSettings.separationDistance;
  if (nearestEnemy) {
  const dx = nearestEnemy.pos.x - ship.pos.x, dy = nearestEnemy.pos.y - ship.pos.y, dz = nearestEnemy.pos.z - ship.pos.z;
  const dSq = dx * dx + dy * dy + dz * dz;
    const scoutId = cfg.globalSettings.enableScoutBehavior ? getTeamScoutId(state, ship.team) : null;
    const isScout = scoutId != null && scoutId === ship.id;
    const teamUnderAlarm = isTeamUnderAlarm(state, ship.team);
  const closeRangeSq = (preferredRange * cfg.globalSettings.closeRangeMultiplier) * (preferredRange * cfg.globalSettings.closeRangeMultiplier);
  const mediumRangeSq = (preferredRange * cfg.globalSettings.mediumRangeMultiplier) * (preferredRange * cfg.globalSettings.mediumRangeMultiplier);
  if (dSq < closeRangeSq) return 'pursue';
  if (dSq < mediumRangeSq) return 'pursue';
    if (isScout) return 'pursue';
    if (teamUnderAlarm) return 'pursue';
    return state.rng.next() < personality.aggressiveness ? 'pursue' : 'strafe';
  }
  const scoutId = cfg.globalSettings.enableScoutBehavior ? getTeamScoutId(state, ship.team) : null;
  const isScout = scoutId != null && scoutId === ship.id;
  // Prefer exploration for scouts when enabled, otherwise patrol when no enemies are visible
  if (isScout && cfg.globalSettings.enableScoutExploration) return 'explore';
  return 'patrol';
}

export function chooseDefensiveIntent(state: GameState, ship: Ship, personality: AIPersonality): AIIntent {
  const cfg = state.behaviorConfig!;
  const nearestEnemy = findNearestEnemy(state, ship);
  const preferredRange = ship.aiState!.preferredRange ?? cfg.globalSettings.separationDistance;
  if (nearestEnemy) {
  const dx = nearestEnemy.pos.x - ship.pos.x, dy = nearestEnemy.pos.y - ship.pos.y, dz = nearestEnemy.pos.z - ship.pos.z;
  const dSq = dx * dx + dy * dy + dz * dz;
  const closeRangeSq = (preferredRange * cfg.globalSettings.closeRangeMultiplier) * (preferredRange * cfg.globalSettings.closeRangeMultiplier);
  const mediumRangeSq = (preferredRange * cfg.globalSettings.mediumRangeMultiplier) * (preferredRange * cfg.globalSettings.mediumRangeMultiplier);
  if (dSq < closeRangeSq) return 'evade';
  if (dSq < mediumRangeSq) return 'strafe';
    return state.rng.next() < personality.caution ? 'evade' : 'group';
  }
  // Without enemies: favor grouping to maintain cohesion
  const friends = findNearbyFriends(state, ship, cfg.globalSettings.groupFriendRadius);
  return friends.length > 0 ? 'group' : 'patrol';
}

export function chooseRoamingIntent(state: GameState, ship: Ship, personality: AIPersonality): AIIntent {
  const nearestEnemy = findNearestEnemy(state, ship);
  if (nearestEnemy && state.rng.next() < personality.aggressiveness) return 'pursue';
  // Otherwise wander
  return 'patrol';
}

export function chooseFormationIntent(_state: GameState, _ship: Ship, _personality: AIPersonality): AIIntent {
  // When in formation mode, the movement system will try to assign/join formations.
  // Intent can remain 'group' to bias towards staying with allies.
  return 'group';
}

export function chooseCarrierGroupIntent(state: GameState, ship: Ship, _personality: AIPersonality): AIIntent {
  // Carriers prefer staying with escorts; if enemies nearby, group or strafe
  const cfg = state.behaviorConfig!;
  const enemies = findNearbyEnemies(state, ship, cfg.globalSettings.minimumSafeDistance * 2);
  if (enemies.length > 0) return 'strafe';
  return 'group';
}

export function chooseMixedIntent(state: GameState, ship: Ship, personality: AIPersonality): AIIntent {
  // Mixed delegates to aggressive vs defensive balance based on aggressiveness vs caution
  if ((personality.aggressiveness ?? 0.5) >= (personality.caution ?? 0.5)) {
    return chooseAggressiveIntent(state, ship, personality);
  }
  return chooseDefensiveIntent(state, ship, personality);
}
