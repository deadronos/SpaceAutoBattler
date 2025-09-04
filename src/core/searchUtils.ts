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

// Simple per-tick target cache to avoid repeated nearest searches for the
// same ship. The game loop should bump `state.frame` each tick; if that
// isn't available, this cache will still help within a single call site.
const nearestCache: Map<number, { frame: number; targetId: number | null }> = new Map();

export function findNearestEnemy(state: GameState, ship: Ship): Ship | null {
  // Per-frame cache: if we've already resolved a nearest enemy for this ship
  // during the current frame, reuse it to avoid multiple queryKNearest calls.
  const frame = (state as any).frame ?? 0;
  const cached = nearestCache.get(ship.id);
  if (cached && cached.frame === frame) {
    return cached.targetId != null ? (state.shipIndex?.get(cached.targetId) || null) : null;
  }
  if (state.spatialGrid && state.behaviorConfig?.globalSettings.enableSpatialIndex) {
    ensureSpatialGridPopulated(state);
    const targetTeam = ship.team === 'red' ? 'blue' : 'red';
    const nearest = state.spatialGrid.queryKNearest(ship.pos, 1, targetTeam);
    if (!nearest || nearest.length === 0) return null;
    const res = state.shipIndex?.get(nearest[0].id) || null;
    nearestCache.set(ship.id, { frame, targetId: res?.id ?? null });
    return res;
  }

  // Linear fallback
  let best: Ship | null = null;
  let bestD = Infinity;
  for (const s of state.ships) {
    if (s.team === ship.team || s.health <= 0) continue;
    const d = getDistance(ship.pos, s.pos);
    if (d < bestD) { bestD = d; best = s; }
  }
  nearestCache.set(ship.id, { frame, targetId: best?.id ?? null });
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

// Grouped k-nearest queries per cell for callers that need many per frame.
// Returns a function that yields k-nearest from a shared candidate set.
export function makeCellNearestResolver(state: GameState, radius: number) {
  const grid = state.spatialGrid;
  if (!grid) return null;
  const cellSize = (grid as any).cellSize ?? state.simConfig.spatialGrid.cellSize;
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
export function pickKNearestFromCandidates(center: Vector3, candidates: readonly Ship[], k: number): Ship[] {
  if (candidates.length <= k) return [...candidates];
  type C = { s: Ship; d2: number };
  const best: C[] = [];
  let maxIdx = -1, maxD2 = -1;
  for (const s of candidates) {
    const dx = s.pos.x - center.x, dy = s.pos.y - center.y, dz = s.pos.z - center.z;
    const d2 = dx*dx + dy*dy + dz*dz;
    if (best.length < k) {
      best.push({ s, d2 });
      if (d2 > maxD2) { maxD2 = d2; maxIdx = best.length - 1; }
    } else if (d2 < maxD2) {
      best[maxIdx] = { s, d2 };
      maxD2 = -1; maxIdx = 0;
      for (let i=0;i<best.length;i++) if (best[i].d2 > maxD2) { maxD2 = best[i].d2; maxIdx = i; }
    }
  }
  best.sort((a,b)=>a.d2-b.d2);
  return best.map(b=>b.s);
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
