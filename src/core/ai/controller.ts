import type { GameState, Ship } from '../../types/index.js';
import { IntentManager } from './intentManager.js';
import { updateTeamAlarms, updateScoutAssignments, TeamSystems } from './teamSystems.js';
import { updateShieldRegeneration } from './defense.js';
import { findNearestEnemy, updateTurretLeads } from './targeting.js';
import { calculateSeparationForceWithCount, SpatialHelpers } from './spatial.js';
import { calculatePreferredRange, reevaluateIntent } from './intent.js';
import { calculateEscapeScore as calcEscape } from './steering.js';
import { scoreEvade as deScoreEvade } from './decisionEngine.js';

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

  public async updateAllShips(dt: number) {
    if (!this.state.behaviorConfig?.globalSettings.aiEnabled) return;
    this.spatial.resetTick();
    updateTeamAlarms(this.state);
    updateScoutAssignments(this.state);
    for (const ship of this.state.ships) {
      if (ship.health <= 0) continue;
      await this.updateShipAI(ship, dt);
    }
  }

  // Test visibility for team systems (back-compat expectations)
  public get teamScouts() { return this.teams.teamScouts; }
  public get teamAlarmTimes() { return this.teams.teamAlarmTimes; }

  public async updateShipAI(ship: Ship, dt: number) {
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

    // Intent reevaluation (do this before targeting so first pass can select non-idle)
    const { getEffectivePersonality } = await import('../../config/behaviorConfig.js');
    const personality = getEffectivePersonality(this.state.behaviorConfig!, ship.class, ship.team);
    reevaluateIntent(this.state, ship, personality);
    updateShieldRegeneration(this.state, ship, dt);

    // Example targeting updates preserved from original controller
    updateTurretLeads(this.state, ship);

    // Maintain targetId behavior similar to original logic; be eager when threats exist
    const turretTargets = ship.turrets
      .map(t => t.aiState?.targetId)
      .filter((id): id is number => typeof id === 'number');
    if (turretTargets.length > 0) {
      const counts = new Map<number, number>();
      for (const id of turretTargets) counts.set(id, (counts.get(id) || 0) + 1);
      let bestId: number | null = null;
      let bestCount = 0;
      for (const [id, count] of counts.entries()) {
        if (count > bestCount) { bestCount = count; bestId = id; }
      }
      ship.targetId = bestId ?? null;
    } else {
      const nearest = findNearestEnemy(this.state, ship);
      // Eagerly set targetId when any enemy is present to match legacy expectations
      ship.targetId = nearest ? nearest.id : null;
      // If we were idle and now have a target, bias to pursue and prime turrets
      if (nearest && ship.aiState && ship.aiState.currentIntent === 'idle') {
        ship.aiState.currentIntent = 'pursue' as any;
        for (const t of ship.turrets) {
          if (!t.aiState) t.aiState = {} as any;
          t.cooldown = 0;
          (t.aiState as any).targetId = nearest.id;
        }
      }
    }
  }

  // Preserve public API used by tests
  public calculateSeparationForceWithCount(ship: Ship) {
    return this.spatial.calculateSeparationForceWithCount(ship);
  }

  // Back-compat: expose intent helpers expected by older tests
  public async chooseAggressiveIntent(ship: Ship, personality: any) {
    const { chooseAggressiveIntent } = await import('./intent.js');
    return chooseAggressiveIntent(this.state, ship, personality);
  }
  public executeIdle(ship: Ship, dt: number) {
    // Idle executes separation only; reuse spatial helper to nudge velocity
    const { force } = this.spatial.calculateSeparationForceWithCount(ship);
    ship.vel.x += force.x * dt * ship.speed;
    ship.vel.y += force.y * dt * ship.speed;
    ship.vel.z += force.z * dt * ship.speed;
  }
  public async moveTowards(ship: Ship, targetPos: any, dt: number) {
    const { moveTowards } = await import('./steering.js');
    return moveTowards(ship, targetPos, dt, this.state.behaviorConfig!.globalSettings);
  }
  public calculateEscapeScore(ship: Ship, targetPos: any, threatsShips: readonly Ship[]) {
    const threats = threatsShips.map(s => s.pos);
    const friends = this.state.ships.filter(s => s.team === ship.team && s.id !== ship.id).map(s => s.pos);
    const bounds = this.state.bounds || { width: 1000, height: 1000, depth: 1000 } as any;
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
