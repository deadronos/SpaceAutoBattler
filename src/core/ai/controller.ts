import type { GameState, Ship } from '../../types/index.js';
import { IntentManager } from './intentManager.js';
import { updateTeamAlarms, updateScoutAssignments, TeamSystems } from './teamSystems.js';
import { updateShieldRegeneration } from './defense.js';
import { findNearestEnemy, findNearbyEnemies, findNearbyFriends, findBestTurretTarget, updateTurretLeads } from './targeting.js';
import { calculateSeparationForceWithCount, ensureSpatialGridUpdated, SpatialHelpers } from './spatial.js';
import { calculatePreferredRange } from './intent.js';
import { assignRoamingAnchor, releaseRoamingAnchor } from './roaming.js';
import { findBestFormation, getFormationCenter, assignFormationSlot, clearFormationSlot } from './formation.js';
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

  public updateAllShips(dt: number) {
    if (!this.state.behaviorConfig?.globalSettings.aiEnabled) return;
    this.spatial.resetTick();
    updateTeamAlarms(this.state);
    updateScoutAssignments(this.state);
    for (const ship of this.state.ships) {
      if (ship.health <= 0) continue;
      this.updateShipAI(ship, dt);
    }
  }

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
    // Maintain lazy init for AI state fields used across modules
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

    updateShieldRegeneration(this.state, ship, dt);

    // Example targeting updates preserved from original controller
    updateTurretLeads(this.state, ship);

    // Maintain targetId behavior similar to original logic
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
      ship.targetId = nearest ? nearest.id : null;
    }
  }

  // Preserve public API used by tests
  public calculateSeparationForceWithCount(ship: Ship) {
    return this.spatial.calculateSeparationForceWithCount(ship);
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
