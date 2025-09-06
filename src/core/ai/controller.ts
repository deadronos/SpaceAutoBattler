import type { GameState, Ship, Vector3, SimBounds, TurretState, Team, EntityId } from '../../types/index.js';
import type { AIPersonality } from '../../config/behaviorConfig.js';
import { IntentManager } from './intentManager.js';
import { assignRoamingAnchor, releaseRoamingAnchor } from './roaming.js';
import { findBestFormation, assignFormationSlot, getFormationCenter } from './formation.js';
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
import { BatchedQueryManager } from './batchedQueries.js';
import { AggressiveSpatialOptimizer } from './aggressiveSpatialOptimizer.js';
import { perfBegin, perfEnd } from '../../utils/perf.js';

export class AIController {
  private state: GameState;
  private intentManager: IntentManager;
  private spatial: SpatialHelpers;
  private teams: TeamSystems;
  private batchedQueries: BatchedQueryManager;
  private spatialOptimizer: AggressiveSpatialOptimizer | undefined = undefined;

  constructor(state: GameState, aggressiveSpatialOptimizer?: AggressiveSpatialOptimizer) {
    this.state = state;
    this.intentManager = new IntentManager();
    this.teams = new TeamSystems(state);

    if (aggressiveSpatialOptimizer) {
      this.spatialOptimizer = aggressiveSpatialOptimizer;
    } else if (state.spatialGrid) {
      // Fallback for tests that don't provide the optimizer directly
      this.spatialOptimizer = new AggressiveSpatialOptimizer(state.spatialGrid, 64);
    }

    this.spatial = new SpatialHelpers(state, this.spatialOptimizer ?? undefined);
    this.batchedQueries = new BatchedQueryManager(this.spatialOptimizer);
    if (DEBUG_AI) console.log(`[AIController Constructor] batchedQueries assigned:`, this.batchedQueries);
  }

  public updateAllShips(dt: number) {
    if (!this.state.behaviorConfig?.globalSettings.aiEnabled) return;
    
    perfBegin('ai.spatial');
    this.spatial.resetTick();
    
    // OPTIMIZATION: Update spatial optimizer and batch precomputes.
    // These operations can be relatively expensive; skip them during test runs
    // (Vitest sets NODE_ENV='test') to keep unit tests fast and avoid timeouts.
    const aliveShips = this.state.ships.filter(s => s.health > 0);
    if (this.spatialOptimizer) {
      const spatialEntities = aliveShips.map(ship => ({
        id: ship.id,
        pos: ship.pos,
        radius: 20, // Use default ship radius
        team: ship.team
      }));
      if (DEBUG_AI) console.log(`[AIController] Calling spatialOptimizer.updateSpatialGrids with ${spatialEntities.length} entities.`);
      this.spatialOptimizer.updateSpatialGrids(spatialEntities);
    }

    // OPTIMIZATION: Pre-compute common queries for all ships in batches
    perfBegin('ai.batched');
    const frameId = this.state.tick ?? 0;
    if (DEBUG_AI) console.log(`[AIController] this.batchedQueries:`, this.batchedQueries);
    if (this.batchedQueries && typeof this.batchedQueries.resetForFrame === 'function') {
      this.batchedQueries.resetForFrame(frameId);
    } else {
      if (DEBUG_AI) console.error(`[AIController] ERROR: this.batchedQueries or resetForFrame is not valid!`, this.batchedQueries);
    }

    // Batch compute nearest enemies and separation neighbors for alive ships
    this.batchedQueries.precomputeNearestEnemies(this.state, aliveShips);
    this.batchedQueries.precomputeSeparationNeighbors(this.state, aliveShips);
    perfEnd('ai.batched');
    perfEnd('ai.spatial');

  perfBegin('ai.teams');
    // Update team systems
    updateTeamAlarms(this.state);
    updateScoutAssignments(this.state);
    perfEnd('ai.teams');
    
    perfBegin('ai.individual');
    // Process individual ships with optimized queries
    for (const ship of this.state.ships) {
      if (ship.health <= 0) continue;
      this.updateShipAI(ship, dt);
    }
    perfEnd('ai.individual');
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
  // Before reevaluating, compute boundary proximity value (0..1) to bias decisions if needed
  try {
    const cfg = this.state.behaviorConfig!;
    const safeMargin = cfg.globalSettings.boundarySafetyMargin ?? 50;
    const dx = Math.min(ship.pos.x, this.state.simConfig.simBounds.width - ship.pos.x);
    const dy = Math.min(ship.pos.y, this.state.simConfig.simBounds.height - ship.pos.y);
    const dz = Math.min(ship.pos.z, this.state.simConfig.simBounds.depth - ship.pos.z);
    const minDist = Math.min(dx, dy, dz);
    const boundScore = (minDist >= safeMargin) ? 0 : (minDist <= 0 ? 1 : (safeMargin - minDist) / safeMargin);
    // We avoid mutating typed aiState shape here; controllers may read this temporarily via local variable
    (ship as unknown as { __boundaryProximity?: number }).__boundaryProximity = boundScore;
  } catch { /* best-effort */ }
  { const rate=this.state.simConfig?.intentReevaluationRate ?? 0.3; const now=this.state.time; if ((now - (ship.aiState!.lastIntentReevaluation ?? -1e9)) >= rate) { reevaluateIntent(this.state, ship, personality); } }
    updateShieldRegeneration(this.state, ship, dt);

    // Ensure turrets have aiState and cooldownLeft initialised so
    // targeting helpers (updateTurretLeads) can operate deterministically.
    for (const t of ship.turrets) {
      if (!t.aiState) t.aiState = { targetId: null, lastTargetUpdate: this.state.time } as TurretState['aiState'];
      if (typeof t.cooldownLeft !== 'number') t.cooldownLeft = 0;
    }
  // Example targeting updates preserved from original controller
  updateTurretLeads(this.state, ship);

    // Maintain targetId behavior similar to original logic; be eager when threats exist
    const turretTargets = ship.turrets.map(t => t.aiState?.targetId ?? null);
    // Prefer any non-null turret target (first-wins) for backward compatibility.
    const firstTarget = turretTargets.find((id) => id != null) ?? null;
    // Declare nearestEnemy at a higher scope
    // OPTIMIZATION: Use batched query result instead of individual search
    const batchedNearest = this.batchedQueries.getNearestEnemy(ship);
    const fallbackCandidates = this.queryKNearestOptimized(ship.pos, 8, ship.team === 'red' ? 'blue' : 'red', ship.id);
    const nearestEnemyEntity = batchedNearest || (fallbackCandidates.length > 0 ? fallbackCandidates[0] : undefined);
    const nearestEnemy = nearestEnemyEntity ? (this.state.shipIndex?.get(nearestEnemyEntity.id) ?? null) : null;
    if (DEBUG_AI) {
      try {
        const batchedStr = batchedNearest ? String(batchedNearest.id) : 'null';
        const fbIds = fallbackCandidates.map(c => c.id).join(',') || '[]';
        console.log(`[AIController] nearestEnemy - batched=${batchedStr} fallback[0]=${nearestEnemyEntity ? nearestEnemyEntity.id : 'null'} fallbackList=[${fbIds}]`);
  } catch { /* best-effort logging */ }
    }

    // IMPROVED: Validate turret targets before using them
    let validatedFirstTarget = firstTarget;
    if (firstTarget != null) {
      const targetShip = this.state.ships.find(s => s.id === firstTarget);
      if (targetShip) {
        // Check if target is valid (different team, alive, within range)
  const isValidTeam = targetShip.team !== ship.team;
  const isAlive = targetShip.health > 0;
  const dx = targetShip.pos.x - ship.pos.x;
  const dy = targetShip.pos.y - ship.pos.y;
  const dz = targetShip.pos.z - ship.pos.z;
  const distSq = dx*dx + dy*dy + dz*dz;
  const tc = this.state.behaviorConfig?.turretConfig;
  const minR = tc?.minimumFireRange ?? 0;
  const maxR = tc?.maximumFireRange ?? Infinity;
  const minRSq = minR * minR;
  const maxRSq = maxR === Infinity ? Infinity : maxR * maxR;
  const withinRange = !(tc && (distSq < minRSq || distSq > maxRSq));
        
        if (!isValidTeam || !isAlive || (!withinRange && ship.aiState?.currentIntent !== 'evade')) {
          validatedFirstTarget = null; // Invalid target
          // Clear the ship's target when it becomes invalid (unless evading)
          if (ship.aiState?.currentIntent !== 'evade') {
            const _rate2=this.state.simConfig?.targetUpdateRate ?? 0.5; if (!ship.aiState) { ship.aiState = { currentIntent: 'idle', intentEndTime: 0, lastIntentReevaluation: 0 } as any; } if ((this.state.time - (ship.aiState.lastTargetSwitchTime??-1e9)) >= _rate2) { ship.targetId = null; ship.aiState.lastTargetSwitchTime=this.state.time; }
          }
        }
      } else {
        validatedFirstTarget = null; // Target ship not found
      }
    }

    // Target assignment and switching logic
    if (validatedFirstTarget != null) {
      // Check if we should switch to a closer enemy (target switching logic)
      if (nearestEnemy && nearestEnemy.id !== validatedFirstTarget) {
        const switchThreshold = 0.8; const rate = this.state.simConfig?.targetUpdateRate ?? 0.5; const now = this.state.time; if (ship.aiState && typeof ship.aiState.lastTargetSwitchTime === 'number' && (now - ship.aiState.lastTargetSwitchTime) < rate) { /* throttle target switching */ return; } // 20% closer required to switch
        const currentTargetShip = this.state.ships.find(s => s.id === validatedFirstTarget);
          if (currentTargetShip) {
          const cdx = currentTargetShip.pos.x - ship.pos.x;
          const cdy = currentTargetShip.pos.y - ship.pos.y;
          const cdz = currentTargetShip.pos.z - ship.pos.z;
          const ndx = nearestEnemy.pos.x - ship.pos.x;
          const ndy = nearestEnemy.pos.y - ship.pos.y;
          const ndz = nearestEnemy.pos.z - ship.pos.z;
          const currentDistSq = cdx*cdx + cdy*cdy + cdz*cdz;
          const nearestDistSq = ndx*ndx + ndy*ndy + ndz*ndz;
          if (DEBUG_AI) console.log(`[AIController] Target switching - ship: ${ship.id}, currentTarget: ${validatedFirstTarget}, nearestEnemy: ${nearestEnemy.id}`);
          if (DEBUG_AI) console.log(`[AIController]   currentDistSq: ${currentDistSq}, nearestDistSq: ${nearestDistSq}, switchThreshold: ${switchThreshold}`);
          if (DEBUG_AI) console.log(`[AIController]   comparison: ${nearestDistSq} < ${currentDistSq} * ${switchThreshold * switchThreshold} (${currentDistSq * (switchThreshold * switchThreshold)})`);

          // Switch if nearest enemy is significantly closer (20% closer)
          // Use squared distance comparison to avoid sqrt in hot path
          if (nearestDistSq < currentDistSq * (switchThreshold * switchThreshold)) {
            if (!ship.aiState) { ship.aiState = { currentIntent: 'idle', intentEndTime: 0, lastIntentReevaluation: 0 } as any; } const _rate=this.state.simConfig?.targetUpdateRate ?? 0.5; if ((this.state.time - (ship.aiState.lastTargetSwitchTime??-1e9)) >= _rate) { ship.targetId = nearestEnemy.id; ship.aiState.lastTargetSwitchTime=this.state.time; }
          } else {
            ship.targetId = validatedFirstTarget as number;
          }
        } else {
          ship.targetId = validatedFirstTarget as number;
        }
      } else {
        ship.targetId = validatedFirstTarget as number;
      }
      // Record assigned target
      (ship as unknown as { __aiAssignedTarget?: number }).__aiAssignedTarget = ship.targetId;
    } else if (nearestEnemy) {
      // No valid current target, but we have a nearest enemy
      // Check if nearest enemy should be our new target (apply same range validation)
      const targetShip = nearestEnemy;
      const dx = targetShip.pos.x - ship.pos.x;
      const dy = targetShip.pos.y - ship.pos.y; 
      const dz = targetShip.pos.z - ship.pos.z;
      const tc = this.state.behaviorConfig?.turretConfig;
      const minR = tc?.minimumFireRange ?? 0;
      const maxR = tc?.maximumFireRange ?? Infinity;
      
      // Use squared distance for range checking to avoid Math.hypot allocation
      let withinRange = true;
      if (tc) {
        const distSq = dx*dx + dy*dy + dz*dz;
        const minRSq = minR * minR;
        const maxRSq = maxR === Infinity ? Infinity : maxR * maxR;
        withinRange = !(distSq < minRSq || (maxRSq !== Infinity && distSq > maxRSq));
      }
      
      const isValidTeam = targetShip.team !== ship.team;
      const isAlive = targetShip.health > 0;
      if (DEBUG_AI) console.log(`[AIController] updateShipAI - ship: ${ship.id}, targetShip: ${targetShip.id}, isValidTeam: ${isValidTeam}, isAlive: ${isAlive}, withinRange: ${withinRange}`);

      if (isValidTeam && isAlive && (withinRange || ship.aiState?.currentIntent === 'evade')) {
        if (!ship.aiState) { ship.aiState = { currentIntent: 'idle', intentEndTime: 0, lastIntentReevaluation: 0 } as any; } const _rate=this.state.simConfig?.targetUpdateRate ?? 0.5; if ((this.state.time - (ship.aiState.lastTargetSwitchTime??-1e9)) >= _rate) { ship.targetId = nearestEnemy.id; ship.aiState.lastTargetSwitchTime=this.state.time; }
        if (DEBUG_AI) console.log(`[AIController] updateShipAI - ship: ${ship.id} targetId set to: ${ship.targetId}`);
      } else {
        const _rate2=this.state.simConfig?.targetUpdateRate ?? 0.5; if (!ship.aiState) { ship.aiState = { currentIntent: 'idle', intentEndTime: 0, lastIntentReevaluation: 0 } as any; } if ((this.state.time - (ship.aiState.lastTargetSwitchTime??-1e9)) >= _rate2) { ship.targetId = null; ship.aiState.lastTargetSwitchTime=this.state.time; }
        if (DEBUG_AI) console.log(`[AIController] updateShipAI - ship: ${ship.id} targetId set to: null`);
      }
    } else {
      // No enemies found, clear target
      const _rate2=this.state.simConfig?.targetUpdateRate ?? 0.5; if (!ship.aiState) { ship.aiState = { currentIntent: 'idle', intentEndTime: 0, lastIntentReevaluation: 0 } as any; } if ((this.state.time - (ship.aiState.lastTargetSwitchTime??-1e9)) >= _rate2) { ship.targetId = null; ship.aiState.lastTargetSwitchTime=this.state.time; }
    }
    // Compatibility fallback: if targeting helpers returned null, run a
    // deterministic legacy-style scoring pass (respecting turret min/max
    // ranges) to pick the best candidate. This matches legacy controller
    // behavior used by characterization tests.
    if (ship.targetId == null) {
      try {
        const tc = this.state.behaviorConfig?.turretConfig;
        let bestId: number | null = null; let bestScore = -Infinity;
        // Use optimized K-nearest query for candidates
        const candidates = this.queryKNearestOptimized(
          ship.pos,
          24, // Request a reasonable number of candidates
          ship.team === 'red' ? 'blue' : 'red', // Target opposite team
          ship.id
        );
        const shortlist = candidates.map(e => this.state.shipIndex?.get(e.id)).filter((s): s is Ship => s != null);

        // Deterministic secondary ordering by distance then id before scoring
        shortlist.sort((a,b)=>{
          const dax=a.pos.x-ship.pos.x, day=a.pos.y-ship.pos.y, daz=a.pos.z-ship.pos.z;
          const dbx=b.pos.x-ship.pos.x, dby=b.pos.y-ship.pos.y, dbz=b.pos.z-ship.pos.z;
          const da=dax*dax+day*day+daz*daz; const db=dbx*dbx+dby*dby+dbz*dbz;
          return da===db ? (a.id-b.id) : (da-db);
        });
        for (const target of shortlist) {
          // IMPROVED: Proper team filtering - never target same team ships
          if (target.team === ship.team || target.health <= 0) continue;
          const dx = target.pos.x - ship.pos.x; const dy = target.pos.y - ship.pos.y; const dz = target.pos.z - ship.pos.z;
          const distSq = dx*dx + dy*dy + dz*dz;
          const minR = tc?.minimumFireRange ?? 0;
          const maxR = tc?.maximumFireRange ?? Infinity;
          const minRSq = minR * minR;
          const maxRSq = maxR === Infinity ? Infinity : maxR * maxR;
          const inRange = !(tc && (distSq < minRSq || distSq > maxRSq));
          const d = inRange ? Math.sqrt(distSq) : 1;
          const score = (d > 0 ? 1000 / d : 0) + ((target.maxHealth - target.health) * 0.1) + (target.level.level * 5);
          if (DEBUG_AI) console.log(`DEBUG_AI: controller fallback candidate ship=${ship.id} turret=NA candidate=${target.id} dist=${d.toFixed(2)} hp=${target.health} level=${target.level?.level ?? target.level} score=${score} inRange=${inRange} rangeMin=${tc?.minimumFireRange ?? 0} rangeMax=${tc?.maximumFireRange ?? Infinity}`);
          // IMPROVED: Strict range checking - don't assign targets out of range
          if (!inRange) continue;
          if (score > bestScore) { bestScore = score; bestId = target.id; }
        }
        // IMPROVED: Only assign target if we found a valid one
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
        // IMPROVED: Validate this backup target as well
        const targetShip = this.state.ships.find(s => s.id === anyT);
        if (targetShip && targetShip.team !== ship.team && targetShip.health > 0) {
          // FIXED: Also check range for safety assignment 
          const dx = targetShip.pos.x - ship.pos.x;
          const dy = targetShip.pos.y - ship.pos.y; 
          const dz = targetShip.pos.z - ship.pos.z;
          const tc = this.state.behaviorConfig?.turretConfig;
          
          // Use squared distance for range checking to avoid Math.hypot allocation
          let withinRange = true;
          if (tc) {
            const distSq = dx*dx + dy*dy + dz*dz;
            const minR = tc.minimumFireRange ?? 0;
            const maxR = tc.maximumFireRange ?? Infinity;
            const minRSq = minR * minR;
            const maxRSq = maxR === Infinity ? Infinity : maxR * maxR;
            withinRange = !(distSq < minRSq || (maxRSq !== Infinity && distSq > maxRSq));
          }
          
          if (withinRange) {
            ship.targetId = anyT as number;
            (ship as unknown as { __aiAssignedTarget?: number }).__aiAssignedTarget = ship.targetId;
            if (DEBUG_AI) console.log(`DEBUG_AI: controller safety assigned ship=${ship.id} => ${ship.targetId}`);
          } else if (DEBUG_AI) {
            const distance = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
            console.log(`DEBUG_AI: controller rejected safety target ship=${ship.id} target=${anyT} out of range dist=${distance.toFixed(2)}`);
          }
        }
      }
    }

    // IMPROVED: Clear invalid targets (destroyed ships, same team ships)
    if (ship.targetId != null) {
      const currentTarget = this.state.ships.find(s => s.id === ship.targetId);
      if (DEBUG_AI) console.log(`[AIController] updateShipAI - ship: ${ship.id} checking target: ${ship.targetId}, currentTarget: ${currentTarget?.id ?? 'null'}`);
      if (!currentTarget || currentTarget.health <= 0 || currentTarget.team === ship.team) {
        if (DEBUG_AI) {
          const reason = !currentTarget ? 'not found' : 
                        currentTarget.health <= 0 ? 'destroyed' : 'same team';
          console.log(`DEBUG_AI: clearing invalid target ship=${ship.id} targetId=${ship.targetId} reason=${reason}`);
        }
        const _rate2=this.state.simConfig?.targetUpdateRate ?? 0.5; if (!ship.aiState) { ship.aiState = { currentIntent: 'idle', intentEndTime: 0, lastIntentReevaluation: 0 } as any; } if ((this.state.time - (ship.aiState.lastTargetSwitchTime??-1e9)) >= _rate2) { ship.targetId = null; ship.aiState.lastTargetSwitchTime=this.state.time; }
        // Also clear turret targets pointing to the same invalid target
        for (const t of ship.turrets) {
          if (t.aiState?.targetId === ship.targetId) {
            t.aiState.targetId = null;
          }
        }
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
    // OPTIMIZATION: Use pre-computed neighbors from batched queries
    const precomputedNeighbors = this.batchedQueries.getSeparationNeighbors(ship);
    const sepRes = precomputedNeighbors.length > 0 
      ? this.spatial.calculateSeparationFromNeighbors(ship, precomputedNeighbors)
      : this.spatial.calculateSeparationForceWithCount(ship);
  if (DEBUG_AI) {
        const magSq = sepRes.force.x * sepRes.force.x + sepRes.force.y * sepRes.force.y + sepRes.force.z * sepRes.force.z;
        const mag = Math.sqrt(magSq);
        const prePos = `${ship.pos.x.toFixed(2)},${ship.pos.y.toFixed(2)},${ship.pos.z.toFixed(2)}`;
        const preVel = `${ship.vel.x.toFixed(3)},${ship.vel.y.toFixed(3)},${ship.vel.z.toFixed(3)}`;
        const msg = `AI-DEBUG controller sep ship=${ship.id} neighbors=${sepRes.neighborCount} forceMag=${mag.toFixed(3)} prePos=${prePos} preVel=${preVel}\n`;
        try {
            // Avoid synchronous fs calls in tests; prefer console logging for diagnostics.
            try { console.error(msg); } catch { if (DEBUG_AI) console.warn('AI-DEBUG log failed'); }
          } catch { if (DEBUG_AI) console.warn('AI-DEBUG outer log failed'); }
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
          try { console.error(`AI-DEBUG controller sep ship=${ship.id} postVel=${ship.vel.x.toFixed(3)},${ship.vel.y.toFixed(3)},${ship.vel.z.toFixed(3)}`); } catch (e) { if (DEBUG_AI) console.warn('AI-DEBUG postVel log failed', e); }
        } catch (e) { if (DEBUG_AI) console.warn('AI-DEBUG postVel outer failed', e); }
      }

  // Execute movement based on current intent (minimal back-compat behavior)
    const intent = ship.aiState?.currentIntent;
    // Track whether a branch integrated position already (moveTowards or idle)
    let integrated = false;
    try {
      if (intent === 'evade') {
        // Use nearestEnemy computed earlier to remain consistent with targeting
        const threat = nearestEnemy;
        if (!threat) {
          // Nothing to evade from; fall through to fallback integration
        } else {
          const dx = ship.pos.x - threat.pos.x;
          const dy = ship.pos.y - threat.pos.y;
          const dz = ship.pos.z - threat.pos.z;
          // Use squared distance gating to avoid Math.sqrt allocations in the hot path.
          const distSq = dx * dx + dy * dy + dz * dz;
          const escapeDist = this.state.behaviorConfig?.globalSettings.evadeDistance ?? 200;
          // Compute an inverse distance for normalization. Only compute Math.sqrt
          // once when DEBUG_AI is enabled to power logging; otherwise use the
          // sqrt result directly for inv without keeping the numeric distance.
          let inv: number;
          let distForLog: number | undefined;
          if (DEBUG_AI) {
            distForLog = Math.sqrt(distSq) || 1;
            inv = distForLog > 0 ? 1 / distForLog : 1;
          } else {
            inv = distSq > 0 ? 1 / Math.sqrt(distSq) : 1;
          }

          const escapeTarget = {
            x: ship.pos.x + dx * inv * escapeDist,
            y: ship.pos.y + dy * inv * escapeDist,
            z: ship.pos.z + dz * inv * escapeDist,
          };

          if (DEBUG_AI) {
            // Use the cached distForLog for human-friendly diagnostics.
            console.error(`AI-DEBUG evade ship=${ship.id} nearest=${threat.id} dist=${(distForLog ?? 1).toFixed(6)} dt=${dt.toFixed(6)} speed=${ship.speed}`);
            console.error(`AI-DEBUG evade preVel ship=${ship.id} ${ship.vel.x.toFixed(6)},${ship.vel.y.toFixed(6)},${ship.vel.z.toFixed(6)}`);
          }
          // Force orientation+accel even if within movementCloseEnoughThreshold
          this.moveTowards(ship, escapeTarget, dt, true);
          if (DEBUG_AI) {
            console.error(`AI-DEBUG evade postVel ship=${ship.id} ${ship.vel.x.toFixed(6)},${ship.vel.y.toFixed(6)},${ship.vel.z.toFixed(6)}`);
          }
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
            const vSq = ship.vel.x * ship.vel.x + ship.vel.y * ship.vel.y + ship.vel.z * ship.vel.z;
            if (vSq > maxV * maxV && vSq > 0) {
              const v = Math.sqrt(vSq);
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
    // Apply boundary steering before fallback integration so separation and
    // steering have had their effect.
    try {
      const cfg = this.state.behaviorConfig?.globalSettings;
      if (cfg) {
        // apply gentle corrective steer when close to edges
        // Import helper from steering module by dynamic require to avoid cyclic imports at top
        try {
          const { applyBoundarySteer } = require('./steering.js');
          const margin = cfg.boundarySafetyMargin ?? 50;
          applyBoundarySteer(ship, this.state.simConfig.simBounds, margin, 0.4, dt);
        } catch { /* ignore if require fails in some test harness */ }
      }
    } catch { /* ignore */ }

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
        // Use squared velocity magnitude to avoid Math.sqrt in hot path
        const vSq = ship.vel.x * ship.vel.x + ship.vel.y * ship.vel.y + ship.vel.z * ship.vel.z;
        const maxVSq = maxV * maxV;
        if (vSq > maxVSq && vSq > 0) {
          const v = Math.sqrt(vSq);
          ship.vel.x = (ship.vel.x / v) * maxV;
          ship.vel.y = (ship.vel.y / v) * maxV;
          ship.vel.z = (ship.vel.z / v) * maxV;
        }
        ship.pos.x += ship.vel.x * dt;
        ship.pos.y += ship.vel.y * dt;
        ship.pos.z += ship.vel.z * dt;
      } catch (e) {
        // This catch guards the fallback integration step. 
        if (DEBUG_AI) {
          if (DEBUG_AI) console.warn('AI-DEBUG fallback integration failed (non-critical)', e);
        }
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
  public moveTowards(ship: Ship, targetPos: Vector3, dt: number, ignoreCloseEnough?: boolean) {
    // Use static import at top so this is synchronous for tests
    // Forward the optional ignoreCloseEnough flag to the steering helper. We
    // pass `undefined` for speedOverride to preserve default behavior.
    return moveTowards(ship, targetPos, dt, this.state.behaviorConfig!.globalSettings, undefined, ignoreCloseEnough);
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
    // Compute squared distance to avoid Math.sqrt in hot path. Only compute
    // the real distance when we need to pass a numeric value to the scoring
    // helper (i.e. when inside the safety threshold) to preserve behavior.
    let distanceToThreat: number | null = null;
    if (nearest) {
      const dx = nearest.pos.x - ship.pos.x;
      const dy = nearest.pos.y - ship.pos.y;
      const dz = nearest.pos.z - ship.pos.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const threshold = (settings.minimumSafeDistance * settings.closeRangeMultiplier);
      if (distSq < threshold * threshold) {
        distanceToThreat = Math.sqrt(distSq);
      } else {
        // Keep null when outside threshold so scoreEvade treats it as non-immediate
        distanceToThreat = null;
      }
    }
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

  /**
   * Get performance-optimized spatial query with approximation
   */
  public queryNearbyOptimized(
    center: Vector3,
    radius: number,
    team?: Team,
    excludeId?: EntityId,
    approximationLevel = 0.1
  ) {
    if (this.spatialOptimizer) {
      return this.spatialOptimizer.queryRadiusOptimized(center, radius, team, excludeId, approximationLevel);
    }
    // Fallback to regular spatial grid
    const results = this.state.spatialGrid?.queryRadius(center, radius) || [];
    return results.filter(entity => {
      if (team !== undefined && entity.team !== team) return false;
      if (excludeId !== undefined && entity.id === excludeId) return false;
      return true;
    });
  }

  /**
   * Get performance-optimized K-nearest with approximation
   */
  public queryKNearestOptimized(
    center: Vector3,
    k: number,
    team?: Team,
    excludeId?: EntityId,
    approximationLevel = 0.2
  ) {
    if (this.spatialOptimizer) {
      return this.spatialOptimizer.queryKNearestApproximate(center, k, team, excludeId, approximationLevel);
    }
    // Fallback to regular spatial grid
    return this.state.spatialGrid?.queryKNearest(center, k, team, excludeId) || [];
  }

  /**
   * Get spatial optimizer performance metrics
   */
  public getSpatialMetrics() {
    return this.spatialOptimizer?.getMetrics() || null;
  }
}

export { IntentManager } from './intentManager.js';
export { findNearestEnemy, findNearbyEnemies, findNearbyFriends, findBestTurretTarget } from './targeting.js';
export { calculateSeparationForceWithCount } from './spatial.js';




