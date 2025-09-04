import type { GameState, Ship, Team } from '../../types/index.js';

// Use WeakMap to attach per-state registries without mutating GameState type
const alarmTimesStore: WeakMap<GameState, Map<Team, number>> = new WeakMap();
const scoutsStore: WeakMap<GameState, Map<Team, number | null>> = new WeakMap();

function getAlarmTimes(state: GameState) {
  let m = alarmTimesStore.get(state);
  if (!m) { m = new Map<Team, number>([['red', 0], ['blue', 0]]); alarmTimesStore.set(state, m); }
  return m;
}

function getScouts(state: GameState) {
  let m = scoutsStore.get(state);
  if (!m) { m = new Map<Team, number | null>([['red', null], ['blue', null]]); scoutsStore.set(state, m); }
  return m;
}

export class TeamSystems {
  private state: GameState;
  constructor(state: GameState) { this.state = state; }
  get teamAlarmTimes() { return getAlarmTimes(this.state); }
  get teamScouts() { return getScouts(this.state); }
}

export function updateTeamAlarms(state: GameState) {
  const config = state.behaviorConfig!;
  if (!(config as any).globalSettings?.enableAlarmSystem) return;
  const alarmTimes = getAlarmTimes(state);
  for (const ship of state.ships) {
    if (ship.health <= 0 || !ship.aiState) continue;
    const timeSinceLastDamage = state.time - (ship.aiState.lastDamageTime || 0);
    if ((ship.aiState.recentDamage && ship.aiState.recentDamage > 0) && timeSinceLastDamage <= (config as any).globalSettings.alarmSystemWindowSeconds) {
      alarmTimes.set(ship.team, state.time);
    }
  }
}

export function updateScoutAssignments(state: GameState) {
  const config = state.behaviorConfig!;
  if (!(config as any).globalSettings?.enableScoutBehavior) return;
  const scouts = getScouts(state);
  for (const team of ['red', 'blue'] as Team[]) {
    const teamShips = state.ships.filter(s => s.team === team && s.health > 0);
    if (teamShips.length === 0) continue;
    const current = scouts.get(team);
    const currentShip = current ? teamShips.find(s => s.id === current) : null;
    if (!currentShip) {
      // Use grouped resolver to find the friendly ship closest to any enemy
      const { makeCellNearestResolver, pickKNearestFromCandidates } = require('../searchUtils.js');
      const resolve = makeCellNearestResolver(state, state.simConfig.spatialGrid.cellSize * 3);
      const enemies = state.ships.filter(s => s.team !== team && s.health > 0);
      let best = teamShips[0];
      if (enemies.length > 0) {
        let bestD = Infinity;
        for (const ship of teamShips) {
          const candidates = resolve ? resolve(ship.pos) : enemies;
          const shortlist = pickKNearestFromCandidates(ship.pos, candidates, 8);
          for (const e of shortlist) {
            const dx = ship.pos.x - e.pos.x; const dy = ship.pos.y - e.pos.y; const dz = ship.pos.z - e.pos.z;
            const d = Math.sqrt(dx*dx+dy*dy+dz*dz);
            if (d < bestD) { bestD = d; best = ship; }
          }
        }
      }
      scouts.set(team, best.id);
    }
  }
}

export function isTeamUnderAlarm(state: GameState, team: Team): boolean {
  const config = state.behaviorConfig!;
  const t = getAlarmTimes(state).get(team) || 0;
  const since = state.time - t;
  return !!((config as any).globalSettings?.enableAlarmSystem && since <= (config as any).globalSettings.alarmSystemWindowSeconds);
}

export function getTeamScoutId(state: GameState, team: Team): number | null {
  return getScouts(state).get(team) ?? null;
}
