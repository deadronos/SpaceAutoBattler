import type { GameState, Ship, Team, Vector3 } from '../../types/index.js';

// Minimal extraction: release and assign anchors. Keep logic conservative.

export function releaseRoamingAnchor(state: GameState, ship: Ship): void {
  if (!ship.aiState?.roamingAnchor) return;
  const registry = getTeamAnchors(state, ship.team);
  const idx = registry.findIndex((a) => a.shipId === ship.id);
  if (idx !== -1) registry.splice(idx, 1);
  ship.aiState.roamingAnchor = undefined;
}

export function assignRoamingAnchor(state: GameState, ship: Ship): Vector3 {
  // Assign an anchor that maintains minimum separation from other anchors
  const anchors = getTeamAnchors(state, ship.team);
  if (ship.aiState?.roamingAnchor) return ship.aiState.roamingAnchor;
  // Use renderer/world bounds from state.ui?.canvas size if available, otherwise fallback
  const maybeBounds = state as unknown as {
    bounds?: { width: number; height: number; depth: number };
    worldBounds?: { width: number; height: number; depth: number };
  };
  const bounds = maybeBounds.bounds ??
    maybeBounds.worldBounds ?? { width: 1000, height: 1000, depth: 1000 };
  const minSep = state.behaviorConfig?.globalSettings.roamingAnchorMinSeparation ?? 150;
  const maxAttempts = state.behaviorConfig?.globalSettings.roamingAnchorMaxAttempts ?? 20;
  // Try sampling nearby candidates using the state's RNG to find a spot satisfying min separation
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = {
      x: Math.min(Math.max(ship.pos.x + (state.rng.next() - 0.5) * minSep * 2, 0), bounds.width),
      y: Math.min(Math.max(ship.pos.y + (state.rng.next() - 0.5) * minSep * 2, 0), bounds.height),
      z: Math.min(Math.max(ship.pos.z + (state.rng.next() - 0.5) * minSep * 2, 0), bounds.depth),
    } as Vector3;
    let ok = true;
    for (const a of anchors) {
      const dx = a.pos.x - candidate.x;
      const dy = a.pos.y - candidate.y;
      const dz = a.pos.z - candidate.z;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq < minSep * minSep) {
        ok = false;
        break;
      }
    }
    if (ok) {
      anchors.push({ pos: candidate, shipId: ship.id });
      ship.aiState =
        ship.aiState ??
        ({ currentIntent: 'idle', intentEndTime: 0, lastIntentReevaluation: 0 } as Ship['aiState']);
      ship.aiState!.roamingAnchor = candidate;
      return candidate;
    }
  }
  // Fall back to clamped ship position if no candidate found
  const fallback = {
    x: Math.min(Math.max(ship.pos.x, 0), bounds.width),
    y: Math.min(Math.max(ship.pos.y, 0), bounds.height),
    z: Math.min(Math.max(ship.pos.z, 0), bounds.depth),
  } as Vector3;
  anchors.push({ pos: fallback, shipId: ship.id });
  ship.aiState =
    ship.aiState ??
    ({ currentIntent: 'idle', intentEndTime: 0, lastIntentReevaluation: 0 } as Ship['aiState']);
  ship.aiState!.roamingAnchor = fallback;
  return fallback;
}

type AnchorEntry = { pos: Vector3; shipId: number };
const teamAnchorMap: WeakMap<GameState, Map<Team, AnchorEntry[]>> = new WeakMap();
function getTeamAnchors(state: GameState, team: Team): AnchorEntry[] {
  let m = teamAnchorMap.get(state);
  if (!m) {
    m = new Map();
    teamAnchorMap.set(state, m);
  }
  let arr = m.get(team);
  if (!arr) {
    arr = [];
    m.set(team, arr);
  }
  return arr;
}
