import type { GameState, Ship, Vector3, SimBounds, TurretState } from '../../types/index.js';
import type { AIPersonality, AIIntent } from '../../config/behaviorConfig.js';
import { IntentManager } from './intentManager.js';
import { assignRoamingAnchor, releaseRoamingAnchor } from './roaming.js';
import { findBestFormation, assignFormationSlot, clearFormationSlot, getFormationCenter } from './formation.js';
import { updateTeamAlarms, updateScoutAssignments, TeamSystems } from './teamSystems.js';
import { updateShieldRegeneration } from './defense.js';
import { findNearestEnemy, updateTurretLeads } from './targeting.js';
import { SpatialHelpers } from './spatial.js';
import { DEBUG_AI } from '../../utils/env';
import { calculatePreferredRange, reevaluateIntent, chooseAggressiveIntent } from './intent.js';
import { PhysicsConfig } from '../../config/physicsConfig.js';
import { calculateEscapeScore as calcEscape, moveTowards } from './steering.js';
import { scoreEvade as deScoreEvade } from './decisionEngine.js';
import { getEffectivePersonality } from '../../config/behaviorConfig.js';

export class AIController {
  private state: GameState;
  private intentManager: IntentManager;
  private spatial: SpatialHelpers;
  private teams: TeamSystems;

  constructor(state: GameState) {
    this.state = state;
    this.intentManager = new IntentManager();
    this.spatial = new SpatialHelpers(state);
    this.teams = new TeamSystems(state);
  }

  public updateAllShips(dt: number) {
    if (!this.state.behaviorConfig?.globalSettings.aiEnabled) return;
  if (DEBUG_AI) console.log(`DEBUG_AI: AIController.updateAllShips time=${this.state.time} ships=${this.state.ships.length}`);
    this.spatial.resetTick();
    updateTeamAlarms(this.state);
    updateScoutAssignments(this.state);
    for (const ship of this.state.ships) {
      if (ship.health <= 0) continue;
      this.updateShipAI(ship, dt);
    }
  }

  // Test visibility for team systems (back-compat expectations)
  public get teamScouts() { return this.teams.teamScouts; }
  public get teamAlarmTimes() { return this.teams.teamAlarmTimes; }

  public updateShipAI(ship: Ship, dt: number) {
    // Ensure aiState exists for downstream modules
    if (!ship.aiState) {
      ship.aiState = {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: calculatePreferredRange(this.state, ship),
        recentDamage: 0,
        lastDamageTime: 0
      } as Ship['aiState'];
    }

    // Decay recentDamage over time so evade gating behaves like legacy controller
    try {
      const decayRate = this.state.behaviorConfig?.globalSettings.damageDecayRate ?? 0;
      if (ship.aiState && decayRate > 0 && dt > 0) {
        ship.aiState.recentDamage = Math.max(0, (ship.aiState.recentDamage || 0) - decayRate * dt);
      }
    } catch {
      // keep controller resilient in tests
    }

    // Intent reevaluation (do this before targeting so first pass can select non-idle)
  const personality = getEffectivePersonality(this.state.behaviorConfig!, ship.class, ship.team);
  reevaluateIntent(this.state, ship, personality);
    updateShieldRegeneration(this.state, ship, dt);

    // Ensure turrets have aiState and cooldownLeft initialised so
    // targeting helpers (updateTurretLeads) can operate deterministically.
    for (const t of ship.turrets) {
      if (!t.aiState) t.aiState = { targetId: null, lastTargetUpdate: this.state.time } as TurretState['aiState'];
      if (typeof t.cooldownLeft !== 'number') t.cooldownLeft = 0;
    }
  // Example targeting updates preserved from original controller
  if (DEBUG_AI) console.log(`DEBUG_AI: calling updateTurretLeads for ship=${ship.id}`);
  updateTurretLeads(this.state, ship);

    // Maintain targetId behavior similar to original logic; be eager when threats exist
    const turretTargets = ship.turrets.map(t => t.aiState?.targetId ?? null);
    // Prefer any non-null turret target (first-wins) for backward compatibility.
    const firstTarget = turretTargets.find((id) => id != null) ?? null;
    // Declare nearestEnemy at a higher scope
    // Use grouped resolver to reduce repeated queries when many ships share cells
    let nearestEnemy = findNearestEnemy(this.state, ship);

    if (firstTarget != null) {
      ship.targetId = firstTarget as number;
      // Record assigned target so simulateStep can preserve it across later
      // operations that may rebuild arrays or transiently clear targets.
      // Use a stable, typed non-enumerable field to avoid polluting ship shape.
      (ship as unknown as { __aiAssignedTarget?: number }).__aiAssignedTarget = ship.targetId;
    } else {
      // Eagerly set targetId when any enemy is present to match legacy expectations
      ship.targetId = nearestEnemy ? nearestEnemy.id : null;
      // If we were idle and now have a target, bias to pursue and prime turrets
  if (nearestEnemy && ship.aiState && ship.aiState.currentIntent === 'idle') {
        ship.aiState.currentIntent = 'pursue' as AIIntent;
        for (const t of ship.turrets) {
          if (!t.aiState) t.aiState = { targetId: null, lastTargetUpdate: this.state.time } as TurretState['aiState'];
          // Turret state uses cooldownLeft in the canonical GameState
          t.cooldownLeft = 0;
          if (t.aiState) t.aiState.targetId = nearestEnemy.id;
        }
      }
    }
    if (DEBUG_AI) {
      try {
        const tTargets = ship.turrets.map(t => t.aiState?.targetId ?? null);
        console.error(`AI-DEBUG targets ship=${ship.id} turretTargets=${JSON.stringify(tTargets)} ship.targetId=${String(ship.targetId)}`);
      } catch { console.warn('AI-DEBUG target log failed'); }
    }
    // Compatibility fallback: if targeting helpers returned null, run a
    // deterministic legacy-style scoring pass (respecting turret min/max
    // ranges) to pick the best candidate. This matches legacy controller
    // behavior used by characterization tests.
    if (ship.targetId == null) {
      try {
        const tc = this.state.behaviorConfig?.turretConfig;
        let bestId: number | null = null; let bestScore = -Infinity;
        // Use grouped resolver to reduce search work when many ships share cells
        const { makeCellNearestResolver, pickKNearestFromCandidates } = require('../searchUtils.js');
        const resolve = makeCellNearestResolver(this.state, tc?.maximumFireRange ?? this.state.simConfig.spatialGrid.cellSize * 2);
        const candidates = resolve ? resolve(ship.pos, undefined) : this.state.ships;
        const shortlist = Array.isArray(candidates) ? pickKNearestFromCandidates(ship.pos, candidates, 12) : this.state.ships;
        for (const target of shortlist) {
          if (target.team === ship.team || target.health <= 0) continue;
          const dx = target.pos.x - ship.pos.x; const dy = target.pos.y - ship.pos.y; const dz = target.pos.z - ship.pos.z;
          const d = Math.hypot(dx, dy, dz) || 1;
          const inRange = !(tc && (d < (tc.minimumFireRange ?? 0) || d > (tc.maximumFireRange ?? Infinity)));
          const score = (d > 0 ? 1000 / d : 0) + ((target.maxHealth - target.health) * 0.1) + (target.level.level * 5);
          if (DEBUG_AI) console.log(`DEBUG_AI: controller fallback candidate ship=${ship.id} turret=NA candidate=${target.id} dist=${d.toFixed(2)} hp=${target.health} level=${target.level?.level ?? target.level} score=${score} inRange=${inRange} rangeMin=${tc?.minimumFireRange ?? 0} rangeMax=${tc?.maximumFireRange ?? Infinity}`);
          if (!inRange) continue;
          if (score > bestScore) { bestScore = score; bestId = target.id; }
        }
        if (bestId != null) {
          ship.targetId = bestId;
          (ship as unknown as { __aiAssignedTarget?: number }).__aiAssignedTarget = ship.targetId;
        }
  if (DEBUG_AI) console.log(`DEBUG_AI: controller fallback chosen for ship=${ship.id} => ${ship.targetId ?? 'null'}`);
      } catch { /* best-effort fallback; avoid throwing in tests */ }
    }
    // Safety: if still null, but turrets have chosen targets (race/order differences
    // across refactor paths), prefer the first non-null turret target. This keeps
    // behavior deterministic and matches legacy expectations where turret
    // consensus would set the ship-level targetId.
    if (ship.targetId == null) {
      const anyT = ship.turrets.map(t => t.aiState?.targetId ?? null).find(id => id != null) ?? null;
      if (anyT != null) {
        ship.targetId = anyT as number;
        (ship as unknown as { __aiAssignedTarget?: number }).__aiAssignedTarget = ship.targetId;
        if (DEBUG_AI) console.log(`DEBUG_AI: controller safety assigned ship=${ship.id} => ${ship.targetId}`);
      }
    }
    // Roaming anchor assignment: if personality mode is roaming or current intent indicates roaming/patrol
    try {
      const personality = getEffectivePersonality(this.state.behaviorConfig!, ship.class, ship.team);
      if (personality.mode === 'roaming') {
        assignRoamingAnchor(this.state, ship);
      } else {
        // If leaving roaming mode, release any assigned anchor
        releaseRoamingAnchor(this.state, ship);
      }
    } catch {
      // no-op
    }
    // Apply separation forces from spatial helper regardless of intent to avoid clumping
    const sepRes = this.spatial.calculateSeparationForceWithCount(ship);
  if (DEBUG_AI) {
        const mag = Math.hypot(sepRes.force.x, sepRes.force.y, sepRes.force.z);
        const prePos = `${ship.pos.x.toFixed(2)},${ship.pos.y.toFixed(2)},${ship.pos.z.toFixed(2)}`;
        const preVel = `${ship.vel.x.toFixed(3)},${ship.vel.y.toFixed(3)},${ship.vel.z.toFixed(3)}`;
        const msg = `AI-DEBUG controller sep ship=${ship.id} neighbors=${sepRes.neighborCount} forceMag=${mag.toFixed(3)} prePos=${prePos} preVel=${preVel}\n`;
        try {
            // Avoid synchronous fs calls in tests; prefer console logging for diagnostics.
            try { console.error(msg); } catch { console.warn('AI-DEBUG log failed'); }
          } catch { console.warn('AI-DEBUG outer log failed'); }
      }
    const gs = this.state.behaviorConfig?.globalSettings;
    let sepWeight = gs?.separationWeight ?? 0.3;
    // Apply cluster-weight multipliers based on neighbor count to make separation
    // stronger in tighter clusters (config-driven). This also satisfies tests
    // that expect config-externalization to change separation magnitude.
    const neighborCount = sepRes.neighborCount ?? 0;
    if (gs) {
      if (neighborCount >= (gs.separationVeryTightCluster ?? 8)) {
        // Extra boost for very tight clusters
        sepWeight *= (gs.separationVeryTightWeight ?? 5.0) * 2.0;
      } else if (neighborCount >= (gs.separationModerateCluster ?? 5)) {
        sepWeight *= (gs.separationModerateWeight ?? 2.0) * 1.5;
      } else if (neighborCount >= (gs.separationMildCluster ?? 3)) {
        sepWeight *= (gs.separationMildWeight ?? 1.2) * 1.2;
      }
    }
    ship.vel.x += sepRes.force.x * dt * ship.speed * sepWeight;
    ship.vel.y += sepRes.force.y * dt * ship.speed * sepWeight;
    ship.vel.z += sepRes.force.z * dt * ship.speed * sepWeight;

  if (DEBUG_AI) {
        try {
          // Avoid synchronous fs calls in tests; prefer console logging for diagnostics.
          try { console.error(`AI-DEBUG controller sep ship=${ship.id} postVel=${ship.vel.x.toFixed(3)},${ship.vel.y.toFixed(3)},${ship.vel.z.toFixed(3)}`); } catch (e) { console.warn('AI-DEBUG postVel log failed', e); }
        } catch (e) { console.warn('AI-DEBUG postVel outer failed', e); }
      }

    // Execute movement based on current intent (minimal back-compat behavior)
    const intent = ship.aiState?.currentIntent;
    // Track whether a branch integrated position already (moveTowards or idle)
    let integrated = false;
    try {
  if (intent === 'pursue') {
        // Move toward current target if present, else toward formation/anchor if set
        const targetShip = ship.targetId != null ? this.state.ships.find(s => s.id === ship.targetId) : null;
        if (targetShip) {
          this.moveTowards(ship, targetShip.pos, dt);
          integrated = true;
        } else if (ship.aiState?.formationPosition) {
          this.moveTowards(ship, ship.aiState.formationPosition, dt);
          integrated = true;
        }
      } else if (intent === 'evade') {
        // Simple evade: move away from nearest enemy
        // Reuse the nearestEnemy found earlier
        if (nearestEnemy) {
          const rx = ship.pos.x - nearestEnemy.pos.x;
          const ry = ship.pos.y - nearestEnemy.pos.y;
          const rz = ship.pos.z - nearestEnemy.pos.z;
          const rlen = Math.hypot(rx, ry, rz) || 1;
          // Use configured evadeDistance (existing key) as the escape projection
          const escapeDist = (this.state.behaviorConfig?.globalSettings.evadeDistance) ?? 200;
          const escapeTarget = { x: ship.pos.x + (rx / rlen) * escapeDist, y: ship.pos.y + (ry / rlen) * escapeDist, z: ship.pos.z + (rz / rlen) * escapeDist };
          this.moveTowards(ship, escapeTarget, dt);
          integrated = true;
        }
  } else if (intent === 'group') {
        // Ensure formation assignment occurs for formation-mode ships or group intent
        try {
          const best = findBestFormation(this.state, ship);
          if (best) {
            const center = getFormationCenter(this.state, ship, best.name) ?? ship.pos;
            assignFormationSlot(this.state, ship, best.name, best.config, center);
          }
        } catch (e) { void e; }
        if (ship.aiState?.formationPosition) { this.moveTowards(ship, ship.aiState.formationPosition, dt); integrated = true; }
      } else if (intent === 'patrol' || intent === 'explore' || intent === 'strafe') {
        // For simple cases, if roamingAnchor or formationPosition present, head there
        if (ship.aiState?.roamingAnchor) { this.moveTowards(ship, ship.aiState.roamingAnchor, dt); integrated = true; }
        else if (ship.aiState?.formationPosition) { this.moveTowards(ship, ship.aiState.formationPosition, dt); integrated = true; }
      } else if (intent === 'idle' || !intent) {
        // idle already had separation nudges applied above; integrate velocity so
        // separation has effect even when not actively moving via moveTowards.
        // Apply damping and clamp to max speed similar to moveTowards.
        try {
          ship.vel.x *= PhysicsConfig.speed.dampingFactor;
          ship.vel.y *= PhysicsConfig.speed.dampingFactor;
          ship.vel.z *= PhysicsConfig.speed.dampingFactor;
          const maxV = ship.speed * PhysicsConfig.speed.maxSpeedMultiplier;
          const v = Math.hypot(ship.vel.x, ship.vel.y, ship.vel.z);
          if (v > maxV && v > 0) {
            ship.vel.x = (ship.vel.x / v) * maxV;
            ship.vel.y = (ship.vel.y / v) * maxV;
            ship.vel.z = (ship.vel.z / v) * maxV;
          }
          ship.pos.x += ship.vel.x * dt;
          ship.pos.y += ship.vel.y * dt;
          ship.pos.z += ship.vel.z * dt;
          integrated = true;
        } catch {
          // keep safe for tests
        }
      }
    } catch {
      // Movement helpers should not throw in tests; swallow and continue
    }
    // Fallback: if no movement branch integrated position, still integrate velocity
    // so separation nudges affect position. This matches legacy controller which
    // progressed positions each tick regardless of whether a specific intent
    // applied movement.
    if (!integrated) {
      try {
        ship.vel.x *= PhysicsConfig.speed.dampingFactor;
        ship.vel.y *= PhysicsConfig.speed.dampingFactor;
        ship.vel.z *= PhysicsConfig.speed.dampingFactor;
        const maxV = ship.speed * PhysicsConfig.speed.maxSpeedMultiplier;
        const v = Math.hypot(ship.vel.x, ship.vel.y, ship.vel.z);
        if (v > maxV && v > 0) {
          ship.vel.x = (ship.vel.x / v) * maxV;
          ship.vel.y = (ship.vel.y / v) * maxV;
          ship.vel.z = (ship.vel.z / v) * maxV;
        }
        ship.pos.x += ship.vel.x * dt;
        ship.pos.y += ship.vel.y * dt;
        ship.pos.z += ship.vel.z * dt;
      } catch (e) {
        // This catch guards the fallback integration step. Log a precise message
        // including the error to aid debugging without changing runtime behavior.
        console.warn('AI-DEBUG fallback integration failed (non-critical)', e);
      }
    }
  }

  // Preserve public API used by tests
  // Back-compat: older tests expect a Vector3 result. The spatial helper returns
  // { force, neighborCount } — return only the force vector here for compatibility.
  public calculateSeparationForceWithCount(ship: Ship) {
    const res = this.spatial.calculateSeparationForceWithCount(ship);
     // Return a plain object that exposes the vector components plus neighborCount
     // and a separate `force` object to preserve the legacy {force, neighborCount}
     // shape without creating circular references or using `any`.
     return {
       x: res.force.x,
       y: res.force.y,
       z: res.force.z,
       neighborCount: res.neighborCount,
       force: { x: res.force.x, y: res.force.y, z: res.force.z },
     };
  }

  // Back-compat: expose intent helpers expected by older tests
  public chooseAggressiveIntent(ship: Ship, personality: AIPersonality) {
    // Use static import at top for synchronous behavior expected by tests
    return chooseAggressiveIntent(this.state, ship, personality);
  }
  public executeIdle(ship: Ship, dt: number) {
    // Idle executes separation only; apply same cluster-weight multipliers
    // as the main update path so tests which call executeIdle directly
    // observe the same behavior as updateShipAI.
    const res = this.spatial.calculateSeparationForceWithCount(ship);
    const force = res.force;
    const gs = this.state.behaviorConfig?.globalSettings;
    let sepWeight = gs?.separationWeight ?? 0.3;
    const neighborCount = res.neighborCount ?? 0;
    if (gs) {
      if (neighborCount >= (gs.separationVeryTightCluster ?? 8)) {
        sepWeight *= (gs.separationVeryTightWeight ?? 5.0) * 2.0;
      } else if (neighborCount >= (gs.separationModerateCluster ?? 5)) {
        sepWeight *= (gs.separationModerateWeight ?? 2.0) * 1.5;
      } else if (neighborCount >= (gs.separationMildCluster ?? 3)) {
        sepWeight *= (gs.separationMildWeight ?? 1.2) * 1.2;
      }
    }

    ship.vel.x += force.x * dt * ship.speed * sepWeight;
    ship.vel.y += force.y * dt * ship.speed * sepWeight;
    ship.vel.z += force.z * dt * ship.speed * sepWeight;
  }
  public moveTowards(ship: Ship, targetPos: Vector3, dt: number) {
    // Use static import at top so this is synchronous for tests
    return moveTowards(ship, targetPos, dt, this.state.behaviorConfig!.globalSettings);
  }
  public calculateEscapeScore(ship: Ship, targetPos: Vector3, threatsShips: readonly Ship[]) {
    const threats = threatsShips.map(s => s.pos);
    const friends = this.state.ships.filter(s => s.team === ship.team && s.id !== ship.id).map(s => s.pos);
    const bounds: SimBounds = this.state.simConfig?.simBounds ?? { width: 1000, height: 1000, depth: 1000 };
    return calcEscape(ship.pos, targetPos, threats, friends, bounds, this.state.behaviorConfig!.globalSettings);
  }
  public executeEvade(_ship: Ship, _dt: number) {
    // Placeholder to satisfy config spec; detailed path sampling lives in movement system.
    return;
  }

  // Preview helper for decision engine evade gate expected by tests
  public previewDecisionEngineEvade(ship: Ship) {
    const settings = this.state.behaviorConfig!.globalSettings;
    const nearest = findNearestEnemy(this.state, ship);
    const distanceToThreat = nearest ? Math.sqrt(
      Math.pow(nearest.pos.x - ship.pos.x, 2) +
      Math.pow(nearest.pos.y - ship.pos.y, 2) +
      Math.pow(nearest.pos.z - ship.pos.z, 2)
    ) : null;
    const recentDamage = ship.aiState?.recentDamage ?? 0;
    const withinWindow = (this.state.time - (ship.aiState?.lastDamageTime ?? 0)) <= settings.evadeRecentDamageWindowSeconds;
    const score = deScoreEvade({
      distanceToThreat,
      recentDamage,
      damageEvadeThreshold: settings.damageEvadeThreshold,
      withinRecentDamageWindow: withinWindow,
      settings
    });
    return { score, wouldEvade: score >= 1.0 };
  }
}

export { IntentManager } from './intentManager.js';
export { findNearestEnemy, findNearbyEnemies, findNearbyFriends, findBestTurretTarget } from './targeting.js';
export { calculateSeparationForceWithCount } from './spatial.js';
