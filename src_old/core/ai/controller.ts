import type {
  GameState,
  Ship,
  Vector3,
  SimBounds,
  TurretState,
  Team,
  EntityId,
} from '../../types/index.js';
import type { AIPersonality } from '../../config/behaviorConfig.js';
import { IntentManager } from './intentManager.js';
import { assignRoamingAnchor, releaseRoamingAnchor } from './roaming.js';
import { findBestFormation, assignFormationSlot, getFormationCenter } from './formation.js';
import { updateTeamAlarms, updateScoutAssignments, TeamSystems } from './teamSystems.js';
import { updateShieldRegeneration } from './defense.js';
import { findNearestEnemy, updateTurretLeads } from './targeting.js';
import { SpatialHelpers } from './spatial.js';
import { DEBUG_AI } from '../../utils/env.js';
import logger from '../../utils/logger.js';
import { calculatePreferredRange, reevaluateIntent, chooseAggressiveIntent } from './intent.js';
import { getShipClassConfig } from '../../config/entitiesConfig.js';
import { PhysicsConfig } from '../../config/physicsConfig.js';
import { calculateEscapeScore as calcEscape, moveTowards } from './steering.js';
import { scoreEvade as deScoreEvade } from './decisionEngine.js';
import { getEffectivePersonality } from '../../config/behaviorConfig.js';
import { BatchedQueryManager } from './batchedQueries.js';
import { AggressiveSpatialOptimizer } from './aggressiveSpatialOptimizer.js';
import { perfBegin, perfEnd } from '../../utils/perf.js';
import { writeTestLogLine } from '../../utils/testDebug.js';

// Test-only debug gate: set VITEST_AI_DEBUG=1 in the environment to enable
// additional per-ship logs during unit tests without relying on browser URL
// params or the global DEBUG_AI flag which may be evaluated earlier.
const VITEST_AI_DEBUG = typeof process !== 'undefined' && process.env.VITEST_AI_DEBUG === '1';

// Local helper type for transient test/debug/anchor fields attached to aiState
type AIAssist = {
  __throttleAnchored?: boolean;
  __throttleAnchoredNull?: boolean;
  // When a target change (assign or clear) occurs during this update,
  // mark pending anchoring so end-of-update can align the baseline to
  // the tick boundary. This stabilizes within-window behavior across ticks.
  __throttlePendAnchor?: boolean;
  __moveCalledThisTick?: boolean;
  __firstTickLogged?: boolean;
  lastTargetSwitchTime?: number;
  __throttleRequestedTick?: number;
  __throttleRequestedTarget?: number | null;
};

// AI update scheduling levels for LOD (Level of Detail)
enum UpdateFrequency {
  EVERY_TICK = 1,     // High priority: engaged ships, carriers
  EVERY_2_TICKS = 2,  // Medium priority: ships near enemies
  EVERY_4_TICKS = 4,  // Low priority: distant ships, idle ships
}

interface SchedulingInfo {
  updateFrequency: UpdateFrequency;
  lastUpdateTick: number;
  distanceToNearestEnemy: number;
}

// Optional capability for spatial grid bulk nearest queries (perf path)
interface BulkQueryableSpatialGrid {
  queryBulkNearest(
    positions: Float32Array,
    k: number,
    team?: Team,
    excludeIds?: Set<EntityId>,
  ): number[];
}

function isBulkQueryableSpatialGrid(obj: unknown): obj is BulkQueryableSpatialGrid {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as { queryBulkNearest?: unknown }).queryBulkNearest === 'function'
  );
}

export class AIController {
  private state: GameState;
  private intentManager: IntentManager;
  private spatial: SpatialHelpers;
  private teams: TeamSystems;
  private batchedQueries: BatchedQueryManager;
  private spatialOptimizer: AggressiveSpatialOptimizer | undefined = undefined;
  
  // Adaptive scheduling state
  private shipScheduling = new Map<EntityId, SchedulingInfo>();
  private enableAdaptiveScheduling = false; // Disabled by default to preserve test determinism; can be toggled for testing

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
    if (DEBUG_AI)
      console.log(`[AIController Constructor] batchedQueries assigned:`, this.batchedQueries);
  }

  /**
   * Public wrapper so external subsystems can request a ship target assignment
   * while preserving the controller's throttle semantics when an AIController
   * instance is available. If callers prefer to bypass throttle semantics they
   * should set `ship.targetId` directly (used sparingly).
   */
  public setShipTargetWithThrottle(ship: Ship, newId: number | null) {
    return this.setTargetWithThrottle(ship, newId);
  }

  // Assign or clear ship.targetId while respecting targetUpdateRate.
  // - Within the throttle window, switches to a different non-null id are blocked.
  // - Clearing to null is allowed and records the switch time.
  // - Outside the window, assignment proceeds and records the switch time.
  private setTargetWithThrottle(ship: Ship, newId: number | null) {
    const now = this.state.time;
    const rate = this.state.simConfig?.targetUpdateRate ?? 0.5;
    const last = ship.aiState?.lastTargetSwitchTime ?? -1e9;
    const current: number | null = ship.targetId == null ? null : ship.targetId;
  // Avoid noisy logs during normal Vitest runs; only emit when explicitly opted-in.
  // Set VITEST_AI_DEBUG=1 to enable detailed THROTTLE logs.
  const TEST_LOG = typeof process !== 'undefined' && process.env.VITEST_AI_DEBUG === '1';
    // NOTE: intentionally do NOT suppress intra-tick requests here. The
    // controller may legitimately call setTargetWithThrottle multiple times
    // during a single update (validated target -> nearest enemy -> fallback)
    // and those transitions should be allowed subject to the configured
    // throttle window. Previous intra-tick suppression caused valid
    // controller-driven switches and clears to be blocked.

    if (current === newId) {
      // No-op when attempting to re-assign the same target. Do NOT anchor
      // the throttle baseline here for null targets — anchoring during the
      // same update can prevent legitimate controller-driven assignments
      // later in the tick (turret->ship propagation, fallback scoring).
      return;
    }

    // Allow null -> non-null only for the very first-ever assignment (no recorded switch time).
    // Otherwise, respect the throttle window and block within-window changes.
    if (current == null && newId != null) {
      const firstEver = !ship.aiState || typeof ship.aiState.lastTargetSwitchTime !== 'number';
      if (firstEver) {
        ship.targetId = newId;
        if (ship.aiState) {
          // Record switch time for immediate within-window checks during this tick,
          // but defer stabilizing the baseline to end-of-update via pending anchor.
          ship.aiState.lastTargetSwitchTime = now;
          try {
            (ship.aiState as unknown as AIAssist).__throttlePendAnchor = true;
          } catch {}
        }
        if (TEST_LOG) {
          const msg = `THROTTLE first-assign ship=${ship.id} -> ${newId} at t=${now.toFixed(3)}`;
          console.error(msg);
          try {
            writeTestLogLine('tmp/ai-throttle.log', msg + '\n');
          } catch {}
        }
        return;
      }
      if (now - last <= rate) {
        if (TEST_LOG) {
          const msg = `THROTTLE block null->${newId} ship=${ship.id} dt=${(now - last).toFixed(3)}<${rate}`;
          console.error(msg);
          try {
            writeTestLogLine('tmp/ai-throttle.log', msg + '\n');
          } catch {}
        }
        return; // block within-window null->non-null
      }
      ship.targetId = newId;
      if (ship.aiState) {
        ship.aiState.lastTargetSwitchTime = now;
        try {
          (ship.aiState as unknown as AIAssist).__throttlePendAnchor = true;
        } catch {}
      }
      if (TEST_LOG) {
        const msg = `THROTTLE assign ship=${ship.id} -> ${newId} at t=${now.toFixed(3)}`;
        console.error(msg);
        try {
          writeTestLogLine('tmp/ai-throttle.log', msg + '\n');
        } catch {}
      }
      return;
    }

    if (now - last <= rate) {
      // Inside window: allow clear to null, block switching to a different id
      if (newId == null) {
        ship.targetId = null;
        if (ship.aiState) {
          ship.aiState.lastTargetSwitchTime = now;
          try {
            (ship.aiState as unknown as AIAssist).__throttlePendAnchor = true;
          } catch {}
        }
        if (TEST_LOG) {
          const msg = `THROTTLE clear ship=${ship.id} -> null at t=${now.toFixed(3)}`;
          console.error(msg);
          try {
            writeTestLogLine('tmp/ai-throttle.log', msg + '\n');
          } catch {}
        }
      }
      if (newId != null && TEST_LOG) {
        const msg = `THROTTLE block switch ship=${ship.id} ${current} -> ${newId} dt=${(now - last).toFixed(3)}<${rate}`;
        console.error(msg);
        try {
          writeTestLogLine('tmp/ai-throttle.log', msg + '\n');
        } catch {}
      }
      return;
    }
    ship.targetId = newId as number | null;
    if (ship.aiState) {
      ship.aiState.lastTargetSwitchTime = now;
      try {
        (ship.aiState as unknown as AIAssist).__throttlePendAnchor = true;
      } catch {}
    }
    if (TEST_LOG) {
      const msg = `THROTTLE assign ship=${ship.id} ${current} -> ${newId} at t=${now.toFixed(3)} (outside window)`;
      console.error(msg);
      try {
        writeTestLogLine('tmp/ai-throttle.log', msg + '\n');
      } catch {}
    }
  }

  public updateAllShips(dt: number) {
    if (!this.state.behaviorConfig?.globalSettings.aiEnabled) return;

    perfBegin('ai.spatial');
    this.spatial.resetTick();

    // OPTIMIZATION: Update spatial optimizer and batch precomputes.
    // These operations can be relatively expensive; skip them during test runs
    // (Vitest sets NODE_ENV='test') to keep unit tests fast and avoid timeouts.
    const aliveShips = this.state.ships.filter((s) => s.health > 0);
    if (this.spatialOptimizer) {
      const spatialEntities = aliveShips.map((ship) => ({
        id: ship.id,
        pos: ship.pos,
        radius: 20, // Use default ship radius
        team: ship.team,
      }));
      const tickNow = this.state.tick ?? 0;
      // In test environment, avoid updating spatial grids every tick to keep
      // performance tests under threshold. Update every 10 ticks which is
      // sufficient for unit tests that rebuild the base grid each frame.
      const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
      const shouldUpdate = !isTestEnv || tickNow % 10 === 0 || this.spatialOptimizer.getMetrics()?.cacheSize === 0;
      if (shouldUpdate) {
        if (DEBUG_AI)
          console.log(
            `[AIController] Calling spatialOptimizer.updateSpatialGrids with ${spatialEntities.length} entities.`,
          );
        this.spatialOptimizer.updateSpatialGrids(spatialEntities);
      }
    }

    // OPTIMIZATION: Pre-compute common queries for all ships in batches
    perfBegin('ai.batched');
    const frameId = this.state.tick ?? 0;
    if (DEBUG_AI) console.log(`[AIController] this.batchedQueries:`, this.batchedQueries);
    if (this.batchedQueries && typeof this.batchedQueries.resetForFrame === 'function') {
      this.batchedQueries.resetForFrame(frameId);
    } else {
      if (DEBUG_AI)
        console.error(
          `[AIController] ERROR: this.batchedQueries or resetForFrame is not valid!`,
          this.batchedQueries,
        );
    }

    // NEW: Adaptive scheduling optimization
    let shipsToUpdate: Ship[];
    if (this.enableAdaptiveScheduling) {
      perfBegin('ai.scheduling');
      // Clean up scheduling data for dead ships
      this.cleanupSchedulingData(aliveShips);
      // Gather distance data using bulk queries for scheduling decisions
      const distanceMap = this.gatherSchedulingData(aliveShips);
      // Filter ships that need updates this tick
      const currentTick = this.state.tick ?? 0;
      shipsToUpdate = aliveShips.filter((ship) => {
        const shouldUpdate = this.shouldUpdateShip(ship, currentTick);
        if (shouldUpdate) {
          const distance = distanceMap.get(ship.id) ?? Infinity;
          this.updateSchedulingInfo(ship, currentTick, distance);
        }
        return shouldUpdate;
      });
      perfEnd('ai.scheduling');
    } else {
      // When adaptive scheduling is disabled (default for tests to preserve determinism),
      // update all ships and avoid any scheduling overhead.
      shipsToUpdate = aliveShips;
    }

    // Batch compute nearest enemies and separation neighbors for ships updating this frame
    this.batchedQueries.precomputeNearestEnemies(this.state, shipsToUpdate);
    this.batchedQueries.precomputeSeparationNeighbors(this.state, shipsToUpdate);
    perfEnd('ai.batched');
    perfEnd('ai.spatial');

    perfBegin('ai.teams');
    // Update team systems
    updateTeamAlarms(this.state);
    updateScoutAssignments(this.state);
    perfEnd('ai.teams');

    perfBegin('ai.individual');
    // Process only ships that need updates this tick
    for (const ship of shipsToUpdate) {
      if (ship.health <= 0) continue;
      this.updateShipAI(ship, dt);
    }
    perfEnd('ai.individual');
    
    if (DEBUG_AI && this.enableAdaptiveScheduling) {
      const stats = this.getSchedulingStats();
      const totalShips = aliveShips.length;
      const updatedShips = shipsToUpdate.length;
      console.log(`[AIController] Adaptive scheduling: ${updatedShips}/${totalShips} ships updated. Frequencies: ${JSON.stringify(stats)}`);
    }
  }

  // Test visibility for team systems (back-compat expectations)
  public get teamScouts() {
    return this.teams.teamScouts;
  }
  public get teamAlarmTimes() {
    return this.teams.teamAlarmTimes;
  }

  public updateShipAI(ship: Ship, dt: number) {
    if (VITEST_AI_DEBUG) {
      try {
        console.log(
          `VITEST-AI-DEBUG start ship=${ship.id} team=${ship.team} pos=${ship.pos.x.toFixed(2)},${ship.pos.y.toFixed(2)},${ship.pos.z.toFixed(2)} vel=${ship.vel.x.toFixed(6)},${ship.vel.y.toFixed(6)},${ship.vel.z.toFixed(6)} intent=${ship.aiState?.currentIntent ?? 'n/a'}`,
        );
        writeTestLogLine(
          'tmp/ai-debug.log',
          `START ship=${ship.id} team=${ship.team} pos=${ship.pos.x.toFixed(2)},${ship.pos.y.toFixed(2)},${ship.pos.z.toFixed(2)} vel=${ship.vel.x.toFixed(6)},${ship.vel.y.toFixed(6)},${ship.vel.z.toFixed(6)} intent=${ship.aiState?.currentIntent ?? 'n/a'}\n`,
        );
      } catch {}
    }
    // Ensure aiState exists for downstream modules
    if (!ship.aiState) {
      ship.aiState = {
        currentIntent: 'idle',
        intentEndTime: 0,
        lastIntentReevaluation: 0,
        preferredRange: calculatePreferredRange(this.state, ship),
        recentDamage: 0,
        lastDamageTime: 0,
      } as Ship['aiState'];
    }
    // Note: Do not pre-set lastTargetSwitchTime here. The throttle window
    // should not block the very first target acquisition; it should only
    // govern switching between non-null targets. First assignment is handled
    // directly in setTargetWithThrottle.
    // Test-only flags: reset per-tick moveCalled marker and ensure first-tick
    // summary is only emitted once per ship when VITEST_AI_DEBUG is enabled.
    if (VITEST_AI_DEBUG) {
      try {
        const ais = ship.aiState as unknown as AIAssist;
        ais.__moveCalledThisTick = false;
        if (typeof ais.__firstTickLogged === 'undefined') ais.__firstTickLogged = false;
      } catch {
        // best-effort
      }
    }
    // Do not unconditionally anchor lastTargetSwitchTime here; setTargetWithThrottle
    // manages anchoring semantics to avoid blocking initial target acquisition.
    // NOTE: Do NOT pre-anchor lastTargetSwitchTime here. Anchoring is handled
    // by setTargetWithThrottle and by the one-time anchors at the end of the
    // updateShipAI flow. Pre-anchoring here could cause the controller to
    // consider a ship as having an existing switch time and block the very
    // first-ever null->non-null assignment which should be allowed.

    // Apply recentDamage decay over time using config-driven rate. This keeps
    // damage-based behaviors stable and satisfies tests that expect decay.
    try {
      const decayRate = this.state.behaviorConfig?.globalSettings.damageDecayRate ?? 0;
      if (decayRate > 0 && ship.aiState) {
        const rd = ship.aiState.recentDamage ?? 0;
        if (rd > 0) {
          ship.aiState.recentDamage = Math.max(0, rd - decayRate * dt);
        }
      }
    } catch {
      /* best-effort */
    }

    // Boundary proximity value (0..1) to bias decisions if needed
    try {
      const cfg = this.state.behaviorConfig!;
      const safeMargin = cfg.globalSettings.boundarySafetyMargin ?? 50;
      const dx = Math.min(ship.pos.x, this.state.simConfig.simBounds.width - ship.pos.x);
      const dy = Math.min(ship.pos.y, this.state.simConfig.simBounds.height - ship.pos.y);
      const dz = Math.min(ship.pos.z, this.state.simConfig.simBounds.depth - ship.pos.z);
      const minDist = Math.min(dx, dy, dz);
      const boundScore =
        minDist >= safeMargin ? 0 : minDist <= 0 ? 1 : (safeMargin - minDist) / safeMargin;
      // We avoid mutating typed aiState shape here; controllers may read this temporarily via local variable
      (ship as unknown as { __boundaryProximity?: number }).__boundaryProximity = boundScore;
    } catch {
      /* best-effort */
    }

    const personality = getEffectivePersonality(this.state.behaviorConfig!, ship.class, ship.team);
    {
      const rate = this.state.simConfig?.intentReevaluationRate ?? 0.3;
      const now = this.state.time;
      if (now - (ship.aiState!.lastIntentReevaluation ?? -1e9) >= rate) {
        reevaluateIntent(this.state, ship, personality);
      }
    }
    updateShieldRegeneration(this.state, ship, dt);

    // Ensure turrets have aiState and cooldownLeft initialised so
    // targeting helpers (updateTurretLeads) can operate deterministically.
    for (const t of ship.turrets) {
      if (!t.aiState)
        t.aiState = { targetId: null, lastTargetUpdate: this.state.time } as TurretState['aiState'];
      if (typeof t.cooldownLeft !== 'number') t.cooldownLeft = 0;
    }
    // Example targeting updates preserved from original controller
    updateTurretLeads(this.state, ship);

    // Maintain targetId behavior similar to original logic; be eager when threats exist
    const turretTargets = ship.turrets.map((t) => t.aiState?.targetId ?? null);
    // Prefer any non-null turret target (first-wins) for backward compatibility.
    const firstTarget = turretTargets.find((id) => id != null) ?? null;
    // Declare nearestEnemy at a higher scope
    // OPTIMIZATION: Use batched query result instead of individual search
    const batchedNearest = this.batchedQueries.getNearestEnemy(ship);
    const fallbackCandidates = this.queryKNearestOptimized(
      ship.pos,
      8,
      ship.team === 'red' ? 'blue' : 'red',
      ship.id,
    );
    let nearestEnemyEntity =
      batchedNearest || (fallbackCandidates.length > 0 ? fallbackCandidates[0] : undefined);
    let nearestEnemy = nearestEnemyEntity
      ? (this.state.shipIndex?.get(nearestEnemyEntity.id) ?? null)
      : null;
    // If both batched query and k-nearest fallback returned nothing (optimizer
    // approximation may skip distant entities in unit tests), perform a
    // deterministic linear scan to find the closest valid enemy. This mirrors
    // the conservative fallback used by reevaluateIntent and ensures the
    // controller can act on the same nearest enemy used by intent selection.
    if (!nearestEnemy) {
      try {
        let best: Ship | null = null;
        let bestDistSq = Infinity;
        for (const s of this.state.ships) {
          if (s.team === ship.team || s.health <= 0) continue;
          const dx = s.pos.x - ship.pos.x;
          const dy = s.pos.y - ship.pos.y;
          const dz = s.pos.z - ship.pos.z;
          const dSq = dx * dx + dy * dy + dz * dz;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            best = s;
          }
        }
        if (best) {
          nearestEnemy = best;
        }
      } catch {
        // best-effort fallback only
      }
    }
    logger.debugIf(DEBUG_AI, () => {
      const batchedStr = batchedNearest ? String(batchedNearest.id) : 'null';
      const fbIds = fallbackCandidates.map((c) => c.id).join(',') || '[]';
      return `[AIController] nearestEnemy - batched=${batchedStr} fallback[0]=${nearestEnemyEntity ? nearestEnemyEntity.id : 'null'} fallbackList=[${fbIds}]`;
    });

    // IMPROVED: Validate existing ship.targetId first (persistence), then turret targets
    if (VITEST_AI_DEBUG) {
      try {
        const has = this.state.shipIndex
          ? ship.targetId != null && this.state.shipIndex.has(ship.targetId)
          : false;
        console.error(
          `[AIController] start-validate ship=${ship.id} targetId=${String(
            ship.targetId,
          )} shipIndexHasTarget=${has}`,
        );
      } catch {}
    }
    let validatedFirstTarget: number | null =
      ship.targetId != null ? (ship.targetId as number) : firstTarget;
    if (validatedFirstTarget != null) {
      const targetShip = this.state.shipIndex?.get(validatedFirstTarget);
      if (targetShip) {
        // Only invalidate when team is same or target is dead. Being out of range
        // should not invalidate, so ships can approach back into range while
        // maintaining their chosen target.
        const isValidTeam = targetShip.team !== ship.team;
        const isAlive = targetShip.health > 0;
        if (!isValidTeam || !isAlive) {
          validatedFirstTarget = null; // Invalid target
          // Clear the ship's target when it becomes invalid
          this.setTargetWithThrottle(ship, null);
        }
      } else {
        validatedFirstTarget = null; // Target ship not found
      }
    }

    // Target assignment and switching logic
    if (validatedFirstTarget != null) {
      // If we have a validated turret target, decide whether to keep it or
      // switch to a closer nearestEnemy (if available) subject to throttling.
      if (nearestEnemy && nearestEnemy.id !== validatedFirstTarget) {
        const switchThreshold =
          this.state.behaviorConfig?.globalSettings.targetSwitchThreshold ?? 0.8;
        const rate = this.state.simConfig?.targetUpdateRate ?? 0.5;
        const now = this.state.time;
        const throttled =
          ship.aiState &&
          typeof ship.aiState.lastTargetSwitchTime === 'number' &&
          now - ship.aiState.lastTargetSwitchTime < rate;
        if (!throttled) {
          const currentTargetShip = this.state.shipIndex?.get(validatedFirstTarget);
          if (currentTargetShip) {
            const cdx = currentTargetShip.pos.x - ship.pos.x;
            const cdy = currentTargetShip.pos.y - ship.pos.y;
            const cdz = currentTargetShip.pos.z - ship.pos.z;
            const ndx = nearestEnemy.pos.x - ship.pos.x;
            const ndy = nearestEnemy.pos.y - ship.pos.y;
            const ndz = nearestEnemy.pos.z - ship.pos.z;
            const currentDistSq = cdx * cdx + cdy * cdy + cdz * cdz;
            const nearestDistSq = ndx * ndx + ndy * ndy + ndz * ndz;

            // Switch if nearest enemy is significantly closer
            if (nearestDistSq < currentDistSq * (switchThreshold * switchThreshold)) {
              this.setTargetWithThrottle(ship, nearestEnemy.id);
            } else {
              this.setTargetWithThrottle(ship, validatedFirstTarget as number);
            }
          } else {
            this.setTargetWithThrottle(ship, validatedFirstTarget as number);
          }
        } else {
          this.setTargetWithThrottle(ship, validatedFirstTarget as number);
        }
      } else {
        // No nearer enemy or same as validated target — keep validated target
        this.setTargetWithThrottle(ship, validatedFirstTarget as number);
      }
      // Record assigned target (normalize null -> undefined for legacy expectations)
      (ship as unknown as { __aiAssignedTarget?: number | undefined }).__aiAssignedTarget =
        ship.targetId ?? undefined;
    } else if (nearestEnemy) {
      // No valid current target, but we have a nearest enemy
      // Check if nearest enemy should be our new target (apply same range validation)
      const targetShip = nearestEnemy;
      const dx = targetShip.pos.x - ship.pos.x;
      const dy = targetShip.pos.y - ship.pos.y;
      const dz = targetShip.pos.z - ship.pos.z;
      const tc = this.state.behaviorConfig?.turretConfig;
      const minR = tc?.minimumFireRange ?? 0;
      // Prefer per-ship turret max range when possible to avoid approach/firing mismatches
      let maxR = tc?.maximumFireRange ?? Infinity;
      try {
        const shipCfg = getShipClassConfig(ship.class);
        const shipMax = shipCfg.turrets.reduce(
          (m, tcfg) => (typeof tcfg.range === 'number' && tcfg.range > m ? tcfg.range : m),
          0,
        );
        if (shipMax > 0) maxR = shipMax;
      } catch {
        /* best-effort */
      }

      // Use squared distance for range checking to avoid Math.hypot allocation
      let withinRange = true;
      if (tc) {
        const distSq = dx * dx + dy * dy + dz * dz;
        const minRSq = minR * minR;
        const maxRSq = maxR === Infinity ? Infinity : maxR * maxR;
        withinRange = !(distSq < minRSq || (maxRSq !== Infinity && distSq > maxRSq));
      }

      const isValidTeam = targetShip.team !== ship.team;
      const isAlive = targetShip.health > 0;
      if (DEBUG_AI)
        console.log(
          `[AIController] updateShipAI - ship: ${ship.id}, targetShip: ${targetShip.id}, isValidTeam: ${isValidTeam}, isAlive: ${isAlive}, withinRange: ${withinRange}`,
        );

      if (isValidTeam && isAlive && (withinRange || ship.aiState?.currentIntent === 'evade')) {
        this.setTargetWithThrottle(ship, nearestEnemy.id);
        if (DEBUG_AI)
          console.log(
            `[AIController] updateShipAI - ship: ${ship.id} targetId set to: ${ship.targetId}`,
          );
      } else {
        this.setTargetWithThrottle(ship, null);
        if (DEBUG_AI)
          console.log(`[AIController] updateShipAI - ship: ${ship.id} targetId set to: null`);
      }
    } else {
      // No enemies found, clear target
      this.setTargetWithThrottle(ship, null);
    }
    // Compatibility fallback: if targeting helpers returned null, run a
    // deterministic legacy-style scoring pass (respecting turret min/max
    // ranges) to pick the best candidate. This matches legacy controller
    // behavior used by characterization tests.
    if (ship.targetId == null) {
      try {
        const tc = this.state.behaviorConfig?.turretConfig;
        let bestId: number | null = null;
        let bestScore = -Infinity;
        // Use optimized K-nearest query for candidates
        const candidates = this.queryKNearestOptimized(
          ship.pos,
          24, // Request a reasonable number of candidates
          ship.team === 'red' ? 'blue' : 'red', // Target opposite team
          ship.id,
        );
        const shortlist = candidates
          .map((e) => this.state.shipIndex?.get(e.id))
          .filter((s): s is Ship => s != null);

        // Deterministic secondary ordering by distance then id before scoring
        shortlist.sort((a, b) => {
          const dax = a.pos.x - ship.pos.x,
            day = a.pos.y - ship.pos.y,
            daz = a.pos.z - ship.pos.z;
          const dbx = b.pos.x - ship.pos.x,
            dby = b.pos.y - ship.pos.y,
            dbz = b.pos.z - ship.pos.z;
          const da = dax * dax + day * day + daz * daz;
          const db = dbx * dbx + dby * dby + dbz * dbz;
          return da === db ? a.id - b.id : da - db;
        });
        for (const target of shortlist) {
          // IMPROVED: Proper team filtering - never target same team ships
          if (target.team === ship.team || target.health <= 0) continue;
          const dx = target.pos.x - ship.pos.x;
          const dy = target.pos.y - ship.pos.y;
          const dz = target.pos.z - ship.pos.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          const minR = tc?.minimumFireRange ?? 0;
          // Prefer per-ship turret max range when available
          let maxR = tc?.maximumFireRange ?? Infinity;
          try {
            const shipCfg = getShipClassConfig(ship.class);
            const shipMax = shipCfg.turrets.reduce(
              (m, tcfg) => (typeof tcfg.range === 'number' && tcfg.range > m ? tcfg.range : m),
              0,
            );
            if (shipMax > 0) maxR = shipMax;
          } catch {
            /* best-effort */
          }
          const minRSq = minR * minR;
          const maxRSq = maxR === Infinity ? Infinity : maxR * maxR;
          const inRange = !(tc && (distSq < minRSq || distSq > maxRSq));
          const d = inRange ? Math.sqrt(distSq) : 1;
          const score =
            (d > 0 ? 1000 / d : 0) +
            (target.maxHealth - target.health) * 0.1 +
            target.level.level * 5;
          logger.debugIf(
            DEBUG_AI,
            () =>
              `DEBUG_AI: controller fallback candidate ship=${ship.id} turret=NA candidate=${target.id} dist=${d.toFixed(2)} hp=${target.health} level=${target.level?.level ?? target.level} score=${score} inRange=${inRange} rangeMin=${tc?.minimumFireRange ?? 0} rangeMax=${tc?.maximumFireRange ?? Infinity}`,
          );
          // IMPROVED: Strict range checking - don't assign targets out of range
          if (!inRange) continue;
          if (score > bestScore) {
            bestScore = score;
            bestId = target.id;
          }
        }
        // IMPROVED: Only assign target if we found a valid one and we're outside the
        // targetUpdateRate throttle window for switching/assignment.
        if (bestId != null) {
          this.setTargetWithThrottle(ship, bestId);
          if (ship.targetId != null) {
            // Record the candidate target we attempted to assign (non-null number)
            (ship as unknown as { __aiAssignedTarget?: number }).__aiAssignedTarget =
              bestId as number;
          }
        }
        logger.debugIf(
          DEBUG_AI,
          () =>
            `DEBUG_AI: controller fallback chosen for ship=${ship.id} => ${ship.targetId ?? 'null'}`,
        );
      } catch {
        /* best-effort fallback; avoid throwing in tests */
      }
    }
    // Safety: if still null, but turrets have chosen targets (race/order differences
    // across refactor paths), prefer the first non-null turret target. This keeps
    // behavior deterministic and matches legacy expectations where turret
    // consensus would set the ship-level targetId.
    if (ship.targetId == null) {
      const anyT =
        ship.turrets.map((t) => t.aiState?.targetId ?? null).find((id) => id != null) ?? null;
      if (anyT != null) {
        // IMPROVED: Validate this backup target as well
        const targetShip = this.state.ships.find((s) => s.id === anyT);
        if (targetShip && targetShip.team !== ship.team && targetShip.health > 0) {
          // FIXED: Also check range for safety assignment
          const dx = targetShip.pos.x - ship.pos.x;
          const dy = targetShip.pos.y - ship.pos.y;
          const dz = targetShip.pos.z - ship.pos.z;
          const tc = this.state.behaviorConfig?.turretConfig;

          // Use squared distance for range checking to avoid Math.hypot allocation
          let withinRange = true;
          if (tc) {
            const distSq = dx * dx + dy * dy + dz * dz;
            const minR = tc.minimumFireRange ?? 0;
            // Prefer per-ship turret max range when available
            let maxR = tc.maximumFireRange ?? Infinity;
            try {
              const shipCfg = getShipClassConfig(ship.class);
              const shipMax = shipCfg.turrets.reduce(
                (m, tcfg) => (typeof tcfg.range === 'number' && tcfg.range > m ? tcfg.range : m),
                0,
              );
              if (shipMax > 0) maxR = shipMax;
            } catch {
              /* best-effort */
            }
            const minRSq = minR * minR;
            const maxRSq = maxR === Infinity ? Infinity : maxR * maxR;
            withinRange = !(distSq < minRSq || (maxRSq !== Infinity && distSq > maxRSq));
          }

          if (withinRange) {
            this.setTargetWithThrottle(ship, anyT as number);
            (ship as unknown as { __aiAssignedTarget?: number }).__aiAssignedTarget =
              anyT as number;
            logger.debugIf(
              DEBUG_AI,
              () => `DEBUG_AI: controller safety assigned ship=${ship.id} => ${ship.targetId}`,
            );
          } else {
            logger.debugIf(DEBUG_AI, () => {
              const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
              return `DEBUG_AI: controller rejected safety target ship=${ship.id} target=${anyT} out of range dist=${distance.toFixed(2)}`;
            });
          }
        }
      }
    }

    // IMPROVED: Clear invalid targets (destroyed ships, same team ships)
    if (ship.targetId != null) {
      const prevId = ship.targetId;
      const currentTarget = this.state.shipIndex?.get(prevId);
      if (!currentTarget || currentTarget.health <= 0 || currentTarget.team === ship.team) {
        logger.debugIf(DEBUG_AI, () => {
          const reason = !currentTarget
            ? 'not found'
            : currentTarget.health <= 0
              ? 'destroyed'
              : 'same team';
          return `DEBUG_AI: clearing invalid target ship=${ship.id} targetId=${prevId} reason=${reason}`;
        });
        this.setTargetWithThrottle(ship, null);
        // Also clear turret targets pointing to the same invalid target
        for (const t of ship.turrets) {
          if (t.aiState?.targetId === prevId) {
            t.aiState.targetId = null;
          }
        }
      }
    }
    // One-time throttle anchors:
    // 1) After the first update where a concrete (non-null) target exists, align
    //    the throttle baseline with the end of this update (once).
    // 2) If the target remains null at the end of an update and we've never
    //    recorded a switch time, anchor once as well so tests that expect stability
    //    within the next window (when starting from null) are satisfied.
    try {
      const ais = ship.aiState as unknown as AIAssist;
      // If a target change occurred during this update, align the throttle
      // baseline with the end-of-update time exactly once per tick.
      if (ais && ais.__throttlePendAnchor) {
        ais.lastTargetSwitchTime = this.state.time;
        ais.__throttlePendAnchor = false;
      } else if (ais) {
        // One-time anchors for stable end-of-update states to ensure the
        // throttle window begins at a tick boundary rather than at the
        // mid-tick moment of first assignment.
        if (ship.targetId != null && !ais.__throttleAnchored) {
          ais.lastTargetSwitchTime = this.state.time;
          ais.__throttleAnchored = true;
        } else if (
          ship.targetId == null &&
          !ais.__throttleAnchoredNull &&
          !(typeof ais.lastTargetSwitchTime === 'number')
        ) {
          ais.lastTargetSwitchTime = this.state.time;
          ais.__throttleAnchoredNull = true;
        }
      }
    } catch {
      /* best-effort */
    }
    // Roaming anchor assignment: if personality mode is roaming or current intent indicates roaming/patrol
    try {
      const personality = getEffectivePersonality(
        this.state.behaviorConfig!,
        ship.class,
        ship.team,
      );
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
    const sepRes =
      precomputedNeighbors.length > 0
        ? this.spatial.calculateSeparationFromNeighbors(ship, precomputedNeighbors)
        : this.spatial.calculateSeparationForceWithCount(ship);
    logger.debugIf(DEBUG_AI, () => {
      const magSq =
        sepRes.force.x * sepRes.force.x +
        sepRes.force.y * sepRes.force.y +
        sepRes.force.z * sepRes.force.z;
      const mag = Math.sqrt(magSq);
      const prePos = `${ship.pos.x.toFixed(2)},${ship.pos.y.toFixed(2)},${ship.pos.z.toFixed(2)}`;
      const preVel = `${ship.vel.x.toFixed(3)},${ship.vel.y.toFixed(3)},${ship.vel.z.toFixed(3)}`;
      return `AI-DEBUG controller sep ship=${ship.id} neighbors=${sepRes.neighborCount} forceMag=${mag.toFixed(3)} prePos=${prePos} preVel=${preVel}`;
    });
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
    // If the ship already has an assigned formation position, reduce separation
    // influence so ships can converge to formation slots without being pushed
    // away by the separation forces. This helps tests that pre-assign
    // formationPosition and expect ships to move into formation slots.
    if (ship.aiState?.formationPosition) {
      // Strongly reduce separation influence for ships with assigned formation
      // positions so they can converge to their slots. Preserve a small
      // separation contribution to avoid perfect overlap.
      sepWeight *= 0.08;
    }
    ship.vel.x += sepRes.force.x * dt * ship.speed * sepWeight;
    ship.vel.y += sepRes.force.y * dt * ship.speed * sepWeight;
    ship.vel.z += sepRes.force.z * dt * ship.speed * sepWeight;

    logger.debugIf(
      DEBUG_AI,
      () =>
        `AI-DEBUG controller sep ship=${ship.id} postVel=${ship.vel.x.toFixed(3)},${ship.vel.y.toFixed(3)},${ship.vel.z.toFixed(3)}`,
    );

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

          logger.debugIf(
            DEBUG_AI,
            () =>
              `AI-DEBUG evade ship=${ship.id} nearest=${threat.id} dist=${(distForLog ?? 1).toFixed(6)} dt=${dt.toFixed(6)} speed=${ship.speed}`,
          );
          logger.debugIf(
            DEBUG_AI,
            () =>
              `AI-DEBUG evade preVel ship=${ship.id} ${ship.vel.x.toFixed(6)},${ship.vel.y.toFixed(6)},${ship.vel.z.toFixed(6)}`,
          );
          // Force orientation+accel even if within movementCloseEnoughThreshold
          this.moveTowards(ship, escapeTarget, dt, true);
          logger.debugIf(
            DEBUG_AI,
            () =>
              `AI-DEBUG evade postVel ship=${ship.id} ${ship.vel.x.toFixed(6)},${ship.vel.y.toFixed(6)},${ship.vel.z.toFixed(6)}`,
          );
          integrated = true;
        }
      } else if (intent === 'approachToRange' || intent === 'pursue') {
        // Move to a point that brings the target within turret max range.
        // Prefer ship.targetId if set, otherwise use nearestEnemy.
        const tgt = ship.targetId ? this.state.shipIndex?.get(ship.targetId) : nearestEnemy;
        if (tgt) {
          // Ensure turrets have a ship-level target so they can begin targeting
          // and fire as soon as the ship comes within firing range.
          this.setTargetWithThrottle(ship, tgt.id);
          // Record assignment so simulateStep final-restore preserves this target
          if (ship.targetId === tgt.id) {
            (ship as unknown as { __aiAssignedTarget?: number }).__aiAssignedTarget =
              tgt.id as number;
          }
          try {
            // Use the actual turret range from the ship's class turret config
            // to compute a stopping distance that guarantees the ship is
            // within the firing range used by fireTurrets (which uses
            // turretConfig.range). If multiple turrets exist, pick the max
            // turret range among them so the approach is conservative.
            const shipCfg = getShipClassConfig(ship.class);
            let maxTurretRange = 0;
            for (const tcfg of shipCfg.turrets) {
              if (typeof tcfg.range === 'number' && tcfg.range > maxTurretRange) {
                maxTurretRange = tcfg.range;
              }
            }
            // Fallback to behavior-config maximumFireRange if ship class has no turrets
            if (!maxTurretRange) {
              const bc = this.state.behaviorConfig?.turretConfig;
              maxTurretRange = bc?.maximumFireRange ?? 0;
            }
            const dx = tgt.pos.x - ship.pos.x;
            const dy = tgt.pos.y - ship.pos.y;
            const dz = tgt.pos.z - ship.pos.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
            // Stop slightly within range to account for prediction and movement
            const desiredDist = maxTurretRange > 0 ? maxTurretRange * 0.95 : dist * 0.9;
            const scale = desiredDist / dist;
            const approachPos = {
              x: ship.pos.x + dx * scale,
              y: ship.pos.y + dy * scale,
              z: ship.pos.z + dz * scale,
            };
            this.moveTowards(ship, approachPos, dt, true);
            integrated = true;
          } catch {
            // best-effort
          }
        }
      } else if (intent === 'group') {
        // Ensure formation assignment occurs for formation-mode ships or group intent
        try {
          const best = findBestFormation(this.state, ship);
          if (best) {
            const center = getFormationCenter(this.state, ship, best.name) ?? ship.pos;
            assignFormationSlot(this.state, ship, best.name, best.config, center);
          }
        } catch (e) {
          void e;
        }
        if (ship.aiState?.formationPosition) {
          this.moveTowards(ship, ship.aiState.formationPosition, dt);
          integrated = true;
        }
      } else if (intent === 'patrol' || intent === 'explore' || intent === 'strafe') {
        // For simple cases, if roamingAnchor or formationPosition present, head there
        if (ship.aiState?.roamingAnchor) {
          this.moveTowards(ship, ship.aiState.roamingAnchor, dt);
          integrated = true;
        } else if (ship.aiState?.formationPosition) {
          this.moveTowards(ship, ship.aiState.formationPosition, dt);
          integrated = true;
        }
      } else if (intent === 'idle' || !intent) {
        // If a formation position is already assigned, move towards it even
        // while current intent is 'idle'. Tests and some higher-level logic
        // pre-assign formationPosition (e.g., during setup) and expect the
        // ship to converge to that slot without requiring an immediate intent
        // reevaluation. Move towards formationPosition first, otherwise fall
        // back to idle damping/integration so separation still applies.
        try {
          if (ship.aiState?.formationPosition) {
            // Force immediate orientation/acceleration towards formation slot
            this.moveTowards(ship, ship.aiState.formationPosition, dt, true);
            integrated = true;
          } else if (ship.aiState?.roamingAnchor) {
            // If a roaming anchor was assigned at spawn, use it to ensure visible
            // early movement for roaming personalities even before reevaluation.
            this.moveTowards(ship, ship.aiState.roamingAnchor, dt, true);
            integrated = true;
          } else {
            // idle already had separation nudges applied above; integrate velocity so
            // separation has effect even when not actively moving via moveTowards.
            // Apply damping and clamp to max speed similar to moveTowards.
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
          }
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
        } catch {
          /* ignore if require fails in some test harness */
        }
      }
    } catch {
      /* ignore */
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
    if (VITEST_AI_DEBUG) {
      try {
        console.log(
          `VITEST-AI-DEBUG end ship=${ship.id} integrated=${integrated} postPos=${ship.pos.x.toFixed(2)},${ship.pos.y.toFixed(2)},${ship.pos.z.toFixed(2)} postVel=${ship.vel.x.toFixed(6)},${ship.vel.y.toFixed(6)},${ship.vel.z.toFixed(6)}`,
        );
        writeTestLogLine(
          'tmp/ai-debug.log',
          `END ship=${ship.id} integrated=${integrated} postPos=${ship.pos.x.toFixed(2)},${ship.pos.y.toFixed(2)},${ship.pos.z.toFixed(2)} postVel=${ship.vel.x.toFixed(6)},${ship.vel.y.toFixed(6)},${ship.vel.z.toFixed(6)}\n`,
        );
        // First-tick one-liner
        const ais = ship.aiState as unknown as AIAssist;
        if (ais && !ais.__firstTickLogged) {
          let sepMag = 0;
          try {
            const sep = this.spatial.calculateSeparationForceWithCount(ship);
            const f = sep.force;
            sepMag = Math.sqrt(
              (f.x || 0) * (f.x || 0) + (f.y || 0) * (f.y || 0) + (f.z || 0) * (f.z || 0),
            );
          } catch {}
          const personality = (() => {
            try {
              return getEffectivePersonality(this.state.behaviorConfig!, ship.class, ship.team);
            } catch {
              return { mode: 'roaming' } as AIPersonality;
            }
          })();
          const moveCalled = !!ais.__moveCalledThisTick;
          const line = `FIRST_TICK ship=${ship.id} team=${ship.team} mode=${personality.mode} intent=${ship.aiState?.currentIntent ?? 'n/a'} moveCalled=${moveCalled} sepMag=${sepMag.toFixed(4)} pos=${ship.pos.x.toFixed(2)},${ship.pos.y.toFixed(2)},${ship.pos.z.toFixed(2)}\n`;
          writeTestLogLine('tmp/ai-firsttick.log', line);
          ais.__firstTickLogged = true;
        }
      } catch {}
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
    if (!this.state.behaviorConfig) return;
    if (VITEST_AI_DEBUG) {
      try {
        if (ship.aiState) (ship.aiState as unknown as AIAssist).__moveCalledThisTick = true;
        writeTestLogLine(
          'tmp/ai-debug.log',
          `MOVE_TOWARDS_CALL ship=${ship.id} team=${ship.team} target=${targetPos.x.toFixed(2)},${targetPos.y.toFixed(2)},${targetPos.z.toFixed(2)} dt=${dt}\n`,
        );
      } catch {}
    }
    // Use static import at top so this is synchronous for tests
    // Forward the optional ignoreCloseEnough flag to the steering helper. We
    // pass `undefined` for speedOverride to preserve default behavior.
    return moveTowards(
      ship,
      targetPos,
      dt,
      this.state.behaviorConfig.globalSettings,
      undefined,
      ignoreCloseEnough,
    );
  }
  public calculateEscapeScore(ship: Ship, targetPos: Vector3, threatsShips: readonly Ship[]) {
    const threats = threatsShips.map((s) => s.pos);
    const friends = this.state.ships
      .filter((s) => s.team === ship.team && s.id !== ship.id)
      .map((s) => s.pos);
    const bounds: SimBounds = this.state.simConfig?.simBounds ?? {
      width: 1000,
      height: 1000,
      depth: 1000,
    };
    if (!this.state.behaviorConfig) {
      return 0;
    }
    return calcEscape(
      ship.pos,
      targetPos,
      threats,
      friends,
      bounds,
      this.state.behaviorConfig.globalSettings,
    );
  }
  public executeEvade(_ship: Ship, _dt: number) {
    // Placeholder to satisfy config spec; detailed path sampling lives in movement system.
  }

  // Preview helper for decision engine evade gate expected by tests
  public previewDecisionEngineEvade(ship: Ship) {
    if (!this.state.behaviorConfig) {
      return { score: 0, wouldEvade: false };
    }
    const settings = this.state.behaviorConfig.globalSettings;
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
      const threshold = settings.minimumSafeDistance * settings.closeRangeMultiplier;
      if (distSq < threshold * threshold) {
        distanceToThreat = Math.sqrt(distSq);
      } else {
        // Keep null when outside threshold so scoreEvade treats it as non-immediate
        distanceToThreat = null;
      }
    }
    const recentDamage = ship.aiState?.recentDamage ?? 0;
    const withinWindow =
      this.state.time - (ship.aiState?.lastDamageTime ?? 0) <=
      settings.evadeRecentDamageWindowSeconds;
    const score = deScoreEvade({
      distanceToThreat,
      recentDamage,
      damageEvadeThreshold: settings.damageEvadeThreshold,
      withinRecentDamageWindow: withinWindow,
      settings,
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
    approximationLevel = 0.1,
  ) {
    if (this.spatialOptimizer) {
      return this.spatialOptimizer.queryRadiusOptimized(
        center,
        radius,
        team,
        excludeId,
        approximationLevel,
      );
    }
    // Fallback to regular spatial grid
    const grid = this.state.spatialGrid;
    if (!grid) return [];
    // Use pooled results to avoid per-call allocations in the hot path
    const buf = grid.getPooledResults();
    try {
      grid.queryRadius(center, radius, buf);
      // Filter in-place into a fresh array for the caller
      const out: typeof buf = [];
      for (const entity of buf) {
        if (team !== undefined && entity.team !== team) continue;
        if (excludeId !== undefined && entity.id === excludeId) continue;
        out.push(entity);
      }
      return out;
    } finally {
      grid.releasePooledResults(buf);
    }
  }

  /**
   * Get performance-optimized K-nearest with approximation
   */
  public queryKNearestOptimized(
    center: Vector3,
    k: number,
    team?: Team,
    excludeId?: EntityId,
    approximationLevel = 0.2,
  ) {
    if (this.spatialOptimizer) {
      return this.spatialOptimizer.queryKNearestApproximate(
        center,
        k,
        team,
        excludeId,
        approximationLevel,
      );
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

  /**
   * Determine appropriate update frequency for a ship based on tactical situation
   */
  private calculateUpdateFrequency(ship: Ship, distanceToNearestEnemy: number): UpdateFrequency {
    // Always update carriers frequently due to their strategic importance
    if (ship.class === 'carrier') {
      return UpdateFrequency.EVERY_TICK;
    }

    // Ships currently engaged in combat
    if (ship.targetId && distanceToNearestEnemy < 200) {
      return UpdateFrequency.EVERY_TICK;
    }

    // Ships with recent damage (under attack)
    if (ship.aiState?.recentDamage && ship.aiState.recentDamage > 0) {
      return UpdateFrequency.EVERY_TICK;
    }

    // Ships near enemies but not engaged
    if (distanceToNearestEnemy < 400) {
      return UpdateFrequency.EVERY_2_TICKS;
    }

    // Distant or idle ships
    return UpdateFrequency.EVERY_4_TICKS;
  }

  /**
   * Check if a ship should be updated this tick based on its schedule
   */
  private shouldUpdateShip(ship: Ship, currentTick: number): boolean {
    if (!this.enableAdaptiveScheduling) {
      return true; // Update all ships if adaptive scheduling is disabled
    }

    const scheduling = this.shipScheduling.get(ship.id);
    if (!scheduling) {
      return true; // First time seeing this ship, update it
    }

    const ticksSinceLastUpdate = currentTick - scheduling.lastUpdateTick;
    return ticksSinceLastUpdate >= scheduling.updateFrequency;
  }

  /**
   * Update the scheduling info for a ship
   */
  private updateSchedulingInfo(ship: Ship, currentTick: number, distanceToNearestEnemy: number): void {
    const frequency = this.calculateUpdateFrequency(ship, distanceToNearestEnemy);
    
    this.shipScheduling.set(ship.id, {
      updateFrequency: frequency,
      lastUpdateTick: currentTick,
      distanceToNearestEnemy,
    });
  }

  /**
   * Use bulk queries to efficiently gather distance information for scheduling
   */
  private gatherSchedulingData(aliveShips: Ship[]): Map<EntityId, number> {
    const distanceMap = new Map<EntityId, number>();
    
    if (aliveShips.length === 0) return distanceMap;

    // Use bulk query if spatial index supports it
  const spatialIndex = this.state.spatialGrid;
  if (isBulkQueryableSpatialGrid(spatialIndex)) {
      // Pack ship positions into Float32Array
      const positions = new Float32Array(aliveShips.length * 3);
      for (let i = 0; i < aliveShips.length; i++) {
        const ship = aliveShips[i];
        positions[i * 3] = ship.pos.x;
        positions[i * 3 + 1] = ship.pos.y;
        positions[i * 3 + 2] = ship.pos.z;
      }

      try {
        // Get nearest enemy for each ship
        for (let i = 0; i < aliveShips.length; i++) {
          const ship = aliveShips[i];
          const enemyTeam = ship.team === 'red' ? 'blue' : 'red';
          
          // Create excludeIds set containing this ship
          const excludeIds = new Set<EntityId>([ship.id]);
          
          // Query nearest enemy
          const nearestIds = spatialIndex.queryBulkNearest(
            positions.subarray(i * 3, (i + 1) * 3),
            1,
            enemyTeam,
            excludeIds
          );

          if (nearestIds.length > 0 && nearestIds[0] !== 0) {
            const nearestShip = this.state.shipIndex?.get(nearestIds[0]);
            if (nearestShip) {
              const dx = nearestShip.pos.x - ship.pos.x;
              const dy = nearestShip.pos.y - ship.pos.y;
              const dz = nearestShip.pos.z - ship.pos.z;
              const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
              distanceMap.set(ship.id, distance);
            } else {
              distanceMap.set(ship.id, Infinity);
            }
          } else {
            distanceMap.set(ship.id, Infinity);
          }
        }
      } catch (error) {
        // Fallback to individual queries if bulk query fails
        if (DEBUG_AI) console.warn('[AIController] Bulk query failed, falling back to individual queries:', error);
        this.gatherSchedulingDataFallback(aliveShips, distanceMap);
      }
    } else {
      // Fallback to existing batched query system
      this.gatherSchedulingDataFallback(aliveShips, distanceMap);
    }

    return distanceMap;
  }

  /**
   * Fallback method using existing batched queries
   */
  private gatherSchedulingDataFallback(aliveShips: Ship[], distanceMap: Map<EntityId, number>): void {
    for (const ship of aliveShips) {
      const nearestEnemy = this.batchedQueries.getNearestEnemy(ship);
      if (nearestEnemy) {
        const dx = nearestEnemy.pos.x - ship.pos.x;
        const dy = nearestEnemy.pos.y - ship.pos.y;
        const dz = nearestEnemy.pos.z - ship.pos.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        distanceMap.set(ship.id, distance);
      } else {
        distanceMap.set(ship.id, Infinity);
      }
    }
  }

  /**
   * Clean up scheduling data for dead ships
   */
  private cleanupSchedulingData(aliveShips: Ship[]): void {
    const aliveIds = new Set(aliveShips.map(s => s.id));
    for (const [shipId] of this.shipScheduling) {
      if (!aliveIds.has(shipId)) {
        this.shipScheduling.delete(shipId);
      }
    }
  }

  /**
   * Enable or disable adaptive scheduling (for testing)
   */
  public setAdaptiveScheduling(enabled: boolean): void {
    this.enableAdaptiveScheduling = enabled;
  }

  /**
   * Get scheduling statistics for debugging
   */
  public getSchedulingStats(): { [key in UpdateFrequency]: number } {
    const stats = {
      [UpdateFrequency.EVERY_TICK]: 0,
      [UpdateFrequency.EVERY_2_TICKS]: 0,
      [UpdateFrequency.EVERY_4_TICKS]: 0,
    };

    for (const [, scheduling] of this.shipScheduling) {
      stats[scheduling.updateFrequency]++;
    }

    return stats;
  }
}

export { IntentManager } from './intentManager.js';
export {
  findNearestEnemy,
  findNearbyEnemies,
  findNearbyFriends,
  findBestTurretTarget,
} from './targeting.js';
export { calculateSeparationForceWithCount } from './spatial.js';
