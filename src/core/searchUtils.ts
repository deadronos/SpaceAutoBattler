import type { GameState, Ship, Vector3 } from '../types/index.js';

/**
 * Small shared search utilities used by AI and game state logic.
 * These prefer the spatial grid when available, but fall back to linear
 * searches so behavior is consistent regardless of configuration.
 */
export function getDistance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function ensureSpatialGridPopulated(state: GameState) {
  if (!state.spatialGrid) return;
  // Rebuild the spatial grid from current ships to provide a consistent
  // snapshot for queries when called outside the main update pass.
  state.spatialGrid.clear();
  for (const s of state.ships) {
    if (s.health > 0) {
      state.spatialGrid.insert({ id: s.id, pos: s.pos, radius: 16, team: s.team });
    }
  }
}

export function findNearestEnemy(state: GameState, ship: Ship): Ship | null {
  if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
    ensureSpatialGridPopulated(state);
    const targetTeam = ship.team === 'red' ? 'blue' : 'red';
    const nearest = state.spatialGrid.queryKNearest(ship.pos, 1, targetTeam);
    if (!nearest || nearest.length === 0) return null;
    return state.shipIndex?.get(nearest[0].id) || null;
  }

  // Linear fallback
  let best: Ship | null = null;
  let bestD = Infinity;
  for (const s of state.ships) {
    if (s.team === ship.team || s.health <= 0) continue;
    const d = getDistance(ship.pos, s.pos);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

export function findNearbyEnemies(state: GameState, ship: Ship, range: number): Ship[] {
  if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
    ensureSpatialGridPopulated(state);
    const out: Ship[] = [];
    state.spatialGrid.forEachInRadius(ship.pos, range, (_dx, _dy, _dz, _distSq, entity) => {
      if (entity.team !== ship.team) {
        const s = state.shipIndex?.get(entity.id);
        if (s && s.health > 0) out.push(s);
      }
    });
    return out.sort((a, b) => getDistance(ship.pos, a.pos) - getDistance(ship.pos, b.pos));
  }

  const enemies: Ship[] = [];
  for (const s of state.ships) {
    if (s.team === ship.team || s.health <= 0) continue;
    const d = getDistance(ship.pos, s.pos);
    if (d <= range) enemies.push(s);
  }
  return enemies.sort((a, b) => getDistance(ship.pos, a.pos) - getDistance(ship.pos, b.pos));
}

export function findNearbyFriends(state: GameState, ship: Ship, range: number): Ship[] {
  if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
    ensureSpatialGridPopulated(state);
    const out: Ship[] = [];
    state.spatialGrid.forEachInRadius(ship.pos, range, (_dx, _dy, _dz, _distSq, entity) => {
      if (entity.team === ship.team && entity.id !== ship.id) {
        const s = state.shipIndex?.get(entity.id);
        if (s && s.health > 0) out.push(s);
      }
    });
    return out;
  }

  const friends: Ship[] = [];
  for (const s of state.ships) {
    if (s.team !== ship.team || s.health <= 0 || s.id === ship.id) continue;
    const d = getDistance(ship.pos, s.pos);
    if (d <= range) friends.push(s);
  }
  return friends;
}

/**
 * Linear helper used by separation logic to find nearby friendly ships within a distance.
 * Kept as a separate helper so existing code can call it where a streaming spatial
 * query is not desired.
 */
export function getNearbySeparationShipsLinear(state: GameState, ship: Ship, separationDistance: number): Ship[] {
  const nearby: Ship[] = [];
  for (const other of state.ships) {
    if (other.team !== ship.team || other.health <= 0 || other.id === ship.id) continue;
    const dist = getDistance(ship.pos, other.pos);
    if (dist > 0 && dist < separationDistance) nearby.push(other);
  }
  return nearby;
}
