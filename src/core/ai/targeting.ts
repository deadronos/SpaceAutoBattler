import type { GameState, Ship, EntityId, TurretState, Vector3 } from '../../types/index.js';
import { computeInterceptPoint } from '../math/ballisticIntercept.js';
import { DEBUG_AI } from '../../utils/env';
import { pickBestTurretTarget } from './turretTargeting.js';
import { findNearestEnemy as sharedFindNearestEnemy, findNearbyEnemies as sharedFindNearbyEnemies, findNearbyFriends as sharedFindNearbyFriends } from '../searchUtils.js';

// Per-frame turret target cache to avoid repeated nearest/radius queries per turret
const turretTargetCache: Map<string, { frame: number; targetId: EntityId | null }> = new Map();
function cacheKey(frame: number, shipId: number, turretId: string) { return `${frame}|${shipId}|${turretId}`; }

export function findNearestEnemy(state: GameState, ship: Ship): Ship | null { return sharedFindNearestEnemy(state, ship); }
export function findNearbyEnemies(state: GameState, ship: Ship, range: number): Ship[] { return sharedFindNearbyEnemies(state, ship, range); }
export function findNearbyFriends(state: GameState, ship: Ship, range: number): Ship[] { return sharedFindNearbyFriends(state, ship, range); }

export function findBestTurretTarget(state: GameState, ship: Ship, turret: TurretState): EntityId | null {
  const cfg = state.behaviorConfig!;
  const turretConfig = cfg.turretConfig;
  if (cfg.globalSettings.useTurretTargetingHelper) {
    // Check per-frame cache first
    const frame = (state as any).frame ?? state.tick;
    const key = cacheKey(frame, ship.id, turret.id);
    const cached = turretTargetCache.get(key);
    if (cached && cached.frame === frame) return cached.targetId ?? null;

    const id = pickBestTurretTarget(state, ship, turret, turretConfig);
    if (DEBUG_AI) {
      console.error(`AI-DEBUG findBestTurretTarget ship=${ship.id} chosen=${String(id)}`);
    }
    turretTargetCache.set(key, { frame, targetId: id ?? null });
    return id ?? null;
  }
  let best: Ship | null = null; let scoreBest = 0;
  for (const target of state.ships) {
    if (target.team === ship.team || target.health <= 0) continue;
    const dx = target.pos.x - ship.pos.x; const dy = target.pos.y - ship.pos.y; const dz = target.pos.z - ship.pos.z;
    const d = Math.sqrt(dx*dx+dy*dy+dz*dz);
    if (d < turretConfig.minimumFireRange || d > turretConfig.maximumFireRange) {
      if (DEBUG_AI) console.log(`DEBUG_AI: local scoring candidate OUT_OF_RANGE ship=${ship.id} candidate=${target.id} dist=${d.toFixed(2)} rangeMin=${turretConfig.minimumFireRange} rangeMax=${turretConfig.maximumFireRange}`);
      continue;
    }
    let score = 1000 / d;
    score += (target.maxHealth - target.health) * 0.1;
    score += target.level.level * 5;
  if (DEBUG_AI) console.log(`DEBUG_AI: local scoring candidate ship=${ship.id} candidate=${target.id} dist=${d.toFixed(2)} hp=${target.health} level=${target.level?.level ?? target.level} score=${score}`);
    if (score > scoreBest) { scoreBest = score; best = target; }
  }
  if (DEBUG_AI) console.log(`DEBUG_AI: local scoring chosen for ship=${ship.id} => ${best?.id ?? 'null'}`);
  return best?.id ?? null;
}

export function updateTurretLeads(state: GameState, ship: Ship) {
  const cfg = state.behaviorConfig!;
  for (const turretState of ship.turrets) {
    const targetId = findBestTurretTarget(state, ship, turretState);
    if (!turretState.aiState) turretState.aiState = { targetId: null, lastTargetUpdate: state.time } as TurretState['aiState'];
    turretState.aiState!.targetId = targetId ?? null;
    // Use globalSettings.maxInterceptLookahead and turretConfig.leadPredictionTime per config
    if (targetId != null) {
      const targetShip = state.ships.find(s => s.id === targetId && s.health > 0);
      if (targetShip) {
        const projectileSpeed = (ship as any).projectileSpeed ?? (cfg.turretConfig as any).projectileSpeed ?? 0;
        const lookahead = cfg.globalSettings.maxInterceptLookahead ?? cfg.turretConfig.leadPredictionTime ?? 0.5;
        const intercept = projectileSpeed > 0 ? computeInterceptPoint(ship.pos, projectileSpeed, targetShip.pos, targetShip.vel, lookahead) : null;
        if (intercept) {
          turretState.aiState!.leadTargetPos = intercept as Vector3;
        } else {
          const lt = cfg.turretConfig.leadPredictionTime ?? 0.5;
          turretState.aiState!.leadTargetPos = {
            x: targetShip.pos.x + (targetShip.vel?.x ?? 0) * lt,
            y: targetShip.pos.y + (targetShip.vel?.y ?? 0) * lt,
            z: targetShip.pos.z + (targetShip.vel?.z ?? 0) * lt
          };
        }
      }
    } else if (turretState.aiState) {
      delete turretState.aiState!.leadTargetPos;
    }
  }
}
