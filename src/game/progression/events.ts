import type { GameState, ProgressionEvent } from '../../types/index.js';
import { appendCappedImmutable } from '../../utils/cappedBuffer.js';

/** Default maximum number of progression events to keep per ship. */
export const DEFAULT_MAX_PROGRESSION_EVENTS = 20;

/**
 * Appends an event to the history, capping the size.
 *
 * @param {ProgressionEvent[]} events - The current event history.
 * @param {ProgressionEvent} event - The new event to add.
 * @param {number} [cap=DEFAULT_MAX_PROGRESSION_EVENTS] - The maximum history size.
 * @returns {ProgressionEvent[]} A new array with the event added and history capped.
 */
export function appendCappedHistory(
  events: ProgressionEvent[],
  event: ProgressionEvent,
  cap = DEFAULT_MAX_PROGRESSION_EVENTS,
): ProgressionEvent[] {
  return appendCappedImmutable(events, event, cap);
}

/**
 * Options for adding a progression event.
 */
export interface AddProgressionEventOptions {
  /** Maximum number of events to keep. */
  maxEvents?: number;
  /** Timestamp for the event. Defaults to Date.now(). */
  timestamp?: number;
}

/**
 * Adds a progression event to the game state for a specific ship.
 *
 * @param {GameState | null | undefined} state - The game state.
 * @param {number} shipId - The ID of the ship.
 * @param {Omit<ProgressionEvent, 'ts'>} event - The event data (timestamp is auto-filled).
 * @param {AddProgressionEventOptions} [options] - Additional options.
 */
export function addProgressionEvent(
  state: GameState | null | undefined,
  shipId: number,
  event: Omit<ProgressionEvent, 'ts'>,
  options: AddProgressionEventOptions = {},
): void {
  if (!state) return;

  const maxEvents = options.maxEvents ?? DEFAULT_MAX_PROGRESSION_EVENTS;
  const timestamp = options.timestamp ?? Date.now();
  const events = state.progressionEvents.get(shipId) ?? [];
  const nextEvent: ProgressionEvent = { ...event, ts: timestamp };
  const updated = appendCappedHistory(events, nextEvent, maxEvents);
  state.progressionEvents.set(shipId, updated);
  // Progression events appended to GameState (logging removed).
}

/**
 * Check if progression events should be logged.
 * Events are logged when both state and shipId are valid.
 *
 * @param {GameState | null} [state] - The game state.
 * @param {number} [shipId] - The ship ID.
 * @returns {boolean} True if logging is possible.
 */
export function shouldLogProgressionEvent(state?: GameState | null, shipId?: number): boolean {
  return state != null && shipId !== undefined;
}
