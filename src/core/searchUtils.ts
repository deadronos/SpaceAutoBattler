import type { GameState, Ship, Vector3 } from '../types/index.js';

/**
 * Small shared search utilities used by AI and game state logic.
 * These prefer the spatial grid when available, but fall back to linear
 * searches so behavior is consistent regardless of configuration.
 */
export function distanceSq(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function getDistance(a: Vector3, b: Vector3): number {
  return Math.sqrt(distanceSq(a, b));
}

// The spatial grid is now updated incrementally by updateSpatialGrid in gameState.ts
// No need for a full rebuild here.

// Enhanced per-tick target cache with more comprehensive caching.
// Cache nearest enemies, nearby results, and spatial queries to avoid redundant work.
const searchCache = {
  nearest: new Map<number, { frame: number; targetId: number | null }>(),
  nearby: new Map<string, { frame: number; results: Ship[] }>(),
  separation: new Map<number, { frame: number; pos: Vector3; neighbors: Ship[] }>(),
};

export function findNearestEnemy(state: GameState, ship: Ship): Ship | null {
  // Enhanced per-frame cache: if we've already resolved a nearest enemy for this ship
  // during the current frame, reuse it to avoid multiple queryKNearest calls.
  const frame = (state as { frame?: number }).frame ?? 0;
  const cached = searchCache.nearest.get(ship.id);
  if (cached && cached.frame === frame) {
    return cached.targetId != null ? state.shipIndex?.get(cached.targetId) || null : null;
  }
  if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
    const targetTeam = ship.team === 'red' ? 'blue' : 'red';
    const nearest = state.spatialGrid.queryKNearest(ship.pos, 2, targetTeam);
    if (!nearest || nearest.length === 0) return null;
    // Deterministic: choose min distance then lowest id if tied
    let best = nearest[0];
    if (nearest.length > 1) {
      const a = state.shipIndex?.get(nearest[0].id);
      const b = state.shipIndex?.get(nearest[1].id);
      if (a && b) {
        const dax = a.pos.x - ship.pos.x,
          day = a.pos.y - ship.pos.y,
          daz = a.pos.z - ship.pos.z;
        const dbx = b.pos.x - ship.pos.x,
          dby = b.pos.y - ship.pos.y,
          dbz = b.pos.z - ship.pos.z;
        const da = dax * dax + day * day + daz * daz;
        const db = dbx * dbx + dby * dby + dbz * dbz;
        if (db < da || (db === da && b.id < a.id)) best = nearest[1];
      }
    }
    const res = state.shipIndex?.get(best.id) || null;
    searchCache.nearest.set(ship.id, { frame, targetId: res?.id ?? null });
    return res;
  }

  // Linear fallback
  let best: Ship | null = null;
  let bestD = Infinity;
  for (const s of state.ships) {
    if (s.team === ship.team || s.health <= 0) continue;
    const d2 = distanceSq(ship.pos, s.pos);
    if (d2 < bestD * bestD) {
      bestD = Math.sqrt(d2);
      best = s;
    }
  }
  searchCache.nearest.set(ship.id, { frame, targetId: best?.id ?? null });
  return best;
}

export function findNearbyEnemies(state: GameState, ship: Ship, range: number): Ship[] {
  if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
    const out: Ship[] = [];
    state.spatialGrid.forEachInRadius(ship.pos, range, (_dx, _dy, _dz, _distSq, entity) => {
      if (entity.team !== ship.team) {
        const s = state.shipIndex?.get(entity.id);
        if (s && s.health > 0) out.push(s);
      }
    });
    // Sort using squared distances to avoid expensive Math.sqrt calls
    return out.sort((a, b) => {
      const dax = a.pos.x - ship.pos.x,
        day = a.pos.y - ship.pos.y,
        daz = a.pos.z - ship.pos.z;
      const dbx = b.pos.x - ship.pos.x,
        dby = b.pos.y - ship.pos.y,
        dbz = b.pos.z - ship.pos.z;
      return dax * dax + day * day + daz * daz - (dbx * dbx + dby * dby + dbz * dbz);
    });
  }

  const enemies: Ship[] = [];
  const rangeSq = range * range;
  for (const s of state.ships) {
    if (s.team === ship.team || s.health <= 0) continue;
    const d2 = distanceSq(ship.pos, s.pos);
    if (d2 <= rangeSq) enemies.push(s);
  }
  // Sort using squared distances
  return enemies.sort((a, b) => {
    const dax = a.pos.x - ship.pos.x,
      day = a.pos.y - ship.pos.y,
      daz = a.pos.z - ship.pos.z;
    const dbx = b.pos.x - ship.pos.x,
      dby = b.pos.y - ship.pos.y,
      dbz = b.pos.z - ship.pos.z;
    return dax * dax + day * day + daz * daz - (dbx * dbx + dby * dby + dbz * dbz);
  });
}

// Grouped k-nearest queries per cell for callers that need many per frame.
// Returns a function that yields k-nearest from a shared candidate set.
export function makeCellNearestResolver(state: GameState, radius: number) {
  const grid = state.spatialGrid;
  if (!grid) return null;
  const cellSize = state.simConfig.spatialGrid.cellSize;
  const map = new Map<string, import('../types/index.js').Ship[]>();
  return (center: Vector3, team?: string) => {
    const cx = Math.floor(center.x / cellSize);
    const cy = Math.floor(center.y / cellSize);
    const cz = Math.floor(center.z / cellSize);
    const key = `${cx}|${cy}|${cz}`;
    let list = map.get(key);
    if (!list) {
      const buf = grid.getPooledResults();
      grid.queryRadius(center, radius, buf);
      list = [];
      for (const e of buf) {
        const s = state.shipIndex?.get(e.id);
        if (s && s.health > 0 && (team == null || s.team === team)) list.push(s);
      }
      grid.releasePooledResults(buf);
      map.set(key, list);
    }
    return list!;
  };
}

// Choose k nearest from a provided candidate list without additional queries.
export function pickKNearestFromCandidates(
  center: Vector3,
  candidates: readonly Ship[],
  k: number,
): Ship[] {
  if (candidates.length <= k) return [...candidates];
  type C = { s: Ship; d2: number };
  const best: C[] = [];
  let maxIdx = -1,
    maxD2 = -1;
  for (const s of candidates) {
    const dx = s.pos.x - center.x,
      dy = s.pos.y - center.y,
      dz = s.pos.z - center.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (best.length < k) {
      best.push({ s, d2 });
      if (d2 > maxD2) {
        maxD2 = d2;
        maxIdx = best.length - 1;
      }
    } else if (d2 < maxD2) {
      best[maxIdx] = { s, d2 };
      maxD2 = -1;
      maxIdx = 0;
      for (let i = 0; i < best.length; i++)
        if (best[i].d2 > maxD2) {
          maxD2 = best[i].d2;
          maxIdx = i;
        }
    }
  }
  // Stable deterministic order: distance first, then id tie-breaker
  best.sort((a, b) => (a.d2 === b.d2 ? a.s.id - b.s.id : a.d2 - b.d2));
  return best.map((b) => b.s);
}

export function findNearbyFriends(state: GameState, ship: Ship, range: number): Ship[] {
  if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
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
  const rangeSq = range * range;
  for (const s of state.ships) {
    if (s.team !== ship.team || s.health <= 0 || s.id === ship.id) continue;
    const d2 = distanceSq(ship.pos, s.pos);
    if (d2 <= rangeSq) friends.push(s);
  }
  return friends;
}

/**
 * Linear helper used by separation logic to find nearby friendly ships within a distance.
 * Kept as a separate helper so existing code can call it where a streaming spatial
 * query is not desired.
 */
export function getNearbySeparationShipsLinear(
  state: GameState,
  ship: Ship,
  separationDistance: number,
): Ship[] {
  const nearby: Ship[] = [];
  const sepSq = separationDistance * separationDistance;
  for (const other of state.ships) {
    if (other.team !== ship.team || other.health <= 0 || other.id === ship.id) continue;
    const d2 = distanceSq(ship.pos, other.pos);
    if (d2 > 0 && d2 < sepSq) nearby.push(other);
  }
  return nearby;
}
