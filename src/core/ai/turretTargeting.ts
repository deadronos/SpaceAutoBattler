import type { GameState, Ship, TurretState } from '../../types/index.js';
import type { BehaviorConfig } from '../../config/behaviorConfig.js';

// Compute legacy turret score exactly as in AIController.findBestTurretTarget
export function scoreTurretTarget(distance: number, target: Ship): number {
  // Legacy logic:
  // score = 1000 / distance + (maxHealth - health) * 0.1 + level * 5
  let score = 0;
  if (distance > 0) score += 1000 / distance;
  score += (target.maxHealth - target.health) * 0.1;
  score += target.level.level * 5;
  return score;
}

export function isWithinTurretRange(distance: number, cfg: BehaviorConfig['turretConfig']): boolean {
  return distance >= cfg.minimumFireRange && distance <= cfg.maximumFireRange;
}

// Pick best target for a turret, matching legacy semantics (strictly greater replaces, first wins ties)
export function pickBestTurretTarget(state: GameState, ship: Ship, turret: TurretState, cfg: BehaviorConfig['turretConfig']): number | null {
  let bestId: number | null = null;
  let bestScore = 0;
  for (const target of state.ships) {
    if (target.team === ship.team || target.health <= 0) continue;
    const dx = target.pos.x - ship.pos.x;
    const dy = target.pos.y - ship.pos.y;
    const dz = target.pos.z - ship.pos.z;
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (!isWithinTurretRange(distance, cfg)) continue;
    const score = scoreTurretTarget(distance, target);
    if (score > bestScore) {
      bestScore = score;
      bestId = target.id;
    }
  }
  return bestId;
}
