import type { GameState, TurretEntity } from '../types/index.js';

export function registerTurret(state: GameState, shipId: number, turret: TurretEntity): void {
  try {
    const map = state.turretsByShip;
    if (!map) return;
    const set = map.get(shipId) ?? new Set<TurretEntity>();
    set.add(turret);
    map.set(shipId, set);
  } catch {
    // ignore
  }
}

export function unregisterTurret(state: GameState, shipId: number, turret: TurretEntity): void {
  try {
    const map = state.turretsByShip;
    if (!map) return;
    const set = map.get(shipId);
    if (!set) return;
    set.delete(turret);
    if (set.size === 0) map.delete(shipId);
  } catch {
    // ignore
  }
}
