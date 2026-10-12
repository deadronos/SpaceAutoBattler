import type { ShipEntity, ProgressionEvent } from '../types/index.js';

/**
 * A single ship row rendered by the progression panel.
 *
 * Kept separate from {@link ShipEntity} so the React layer only receives the
 * fields it needs and can compare rows cheaply for stable-identity reuse.
 */
export interface ProgressionPanelShip {
  id: number;
  name?: string;
  type?: string;
  team: 'blue' | 'red';
  level: number;
  xp: number;
  xpToNext: number;
  events: ProgressionEvent[]; // capped to recent N
}

/** Default maximum number of ships shown in the panel. */
export const DEFAULT_MAX_PROGRESSION_SHIPS = 50;
/** Default maximum number of recent events retained per ship. */
export const DEFAULT_MAX_EVENTS_PER_SHIP = 5;

/**
 * Options controlling how much data the panel transform keeps.
 */
export interface BuildProgressionPanelDataOptions {
  /** Maximum number of ships to return (defaults to 50). */
  maxShips?: number;
  /** Maximum number of recent events per ship (defaults to 5). */
  maxEventsPerShip?: number;
}

/**
 * Pure transform from simulation entities to the progression panel's row shape.
 *
 * Ships are sorted by level (descending) then XP (descending) and capped to
 * `maxShips`; each ship's event history is sliced to the most recent
 * `maxEventsPerShip` entries. The function performs no caching and allocates a
 * fresh array on every call, so callers can safely rebuild it each tick even
 * when `progressionEvents` is mutated in place.
 */
export function buildProgressionPanelData(
  ships: readonly ShipEntity[],
  progressionEvents: Map<number, ProgressionEvent[]> | undefined,
  options?: BuildProgressionPanelDataOptions,
): ProgressionPanelShip[] {
  const maxShips = options?.maxShips ?? DEFAULT_MAX_PROGRESSION_SHIPS;
  const maxEventsPerShip = options?.maxEventsPerShip ?? DEFAULT_MAX_EVENTS_PER_SHIP;

  const progressionShips: ProgressionPanelShip[] = [];

  for (const ship of ships) {
    // Get events for this ship from GameState
    const events = progressionEvents?.get(ship.id) || [];

    progressionShips.push({
      id: ship.id,
      name: `${ship.ship.hull}-${ship.id}`,
      type: ship.ship.hull,
      team: ship.ship.team,
      level: ship.ship.level,
      xp: ship.ship.xp,
      xpToNext: ship.ship.xpToNext,
      events: events.slice(-maxEventsPerShip),
    });
  }

  // Sort by level descending, then by XP
  progressionShips.sort((a, b) => {
    if (a.level !== b.level) return b.level - a.level;
    return b.xp - a.xp;
  });

  return progressionShips.slice(0, maxShips); // Cap for performance
}
