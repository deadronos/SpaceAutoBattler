import type { GameState, Ship, Team, Vector3 } from '../../types/index.js';

// Minimal extraction: release and assign anchors. Keep logic conservative.

export function releaseRoamingAnchor(state: GameState, ship: Ship): void {
  if (!ship.aiState?.roamingAnchor) return;
  const registry = getTeamAnchors(state, ship.team);
  const idx = registry.findIndex(a => a.shipId === ship.id);
  if (idx !== -1) registry.splice(idx, 1);
  ship.aiState.roamingAnchor = undefined;
}

export function assignRoamingAnchor(state: GameState, ship: Ship): Vector3 {
  // Simple assign: reuse existing anchor or place near ship within bounds
  const anchors = getTeamAnchors(state, ship.team);
  if (ship.aiState?.roamingAnchor) return ship.aiState.roamingAnchor;
  // Use renderer/world bounds from state.ui?.canvas size if available, otherwise fallback
  const bounds = (state as any).bounds ?? (state as any).worldBounds ?? { width: 1000, height: 1000, depth: 1000 };
  const anchor = { x: Math.min(Math.max(ship.pos.x, 0), bounds.width), y: Math.min(Math.max(ship.pos.y, 0), bounds.height), z: Math.min(Math.max(ship.pos.z, 0), bounds.depth) } as Vector3;
  anchors.push({ pos: anchor, shipId: ship.id });
  ship.aiState = ship.aiState ?? ({ currentIntent: 'idle', intentEndTime: 0, lastIntentReevaluation: 0 } as Ship['aiState']);
  ship.aiState!.roamingAnchor = anchor;
  return anchor;
}

type AnchorEntry = { pos: Vector3; shipId: number };
const teamAnchorMap: WeakMap<GameState, Map<Team, AnchorEntry[]>> = new WeakMap();
function getTeamAnchors(state: GameState, team: Team): AnchorEntry[] {
  let m = teamAnchorMap.get(state);
  if (!m) { m = new Map(); teamAnchorMap.set(state, m); }
  let arr = m.get(team);
  if (!arr) { arr = []; m.set(team, arr); }
  return arr;
}
