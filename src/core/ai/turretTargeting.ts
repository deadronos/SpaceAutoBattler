import type { GameState, Ship, TurretState } from '../../types/index.js';
import { DEBUG_AI } from '../../utils/env';
import logger from '../../utils/logger';
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
  let bestScore = -Infinity;
  for (const c of state.ships) {
    if (c.team === ship.team) continue;
    if (c.health <= 0) continue;

    const dx = c.pos.x - ship.pos.x;
    const dy = c.pos.y - ship.pos.y;
    const dz = c.pos.z - ship.pos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const score = scoreTurretTarget(dist, c);
    const inRange = dist >= cfg.minimumFireRange && dist <= cfg.maximumFireRange;

  logger.debugIf(DEBUG_AI, () => `DEBUG_AI: turret pickCandidate: ship=${ship.id} turret=${turret.id} candidate=${c.id} dist=${dist.toFixed(2)} hp=${c.health} level=${c.level?.level ?? c.level} score=${score} inRange=${inRange} rangeMin=${cfg.minimumFireRange} rangeMax=${cfg.maximumFireRange}`);

    if (!inRange) continue;
    if (score == null) continue;
    if (score > bestScore) {
      bestScore = score;
      bestId = c.id;
    }
  }

  logger.debugIf(DEBUG_AI, () => `DEBUG_AI: turret pickBestTurretTarget result for ship=${ship.id} turret=${turret.id} => ${bestId ?? 'null'}`);

  return bestId;
}
