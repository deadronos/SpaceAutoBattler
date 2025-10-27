import type { GameState, ProgressionEvent } from '../../types/index.js';

export const DEFAULT_MAX_PROGRESSION_EVENTS = 20;

export function appendCappedHistory(
  events: ProgressionEvent[],
  event: ProgressionEvent,
  cap = DEFAULT_MAX_PROGRESSION_EVENTS,
): ProgressionEvent[] {
  const next = events.slice();
  next.push(event);
  if (next.length > cap) {
    next.splice(0, next.length - cap);
  }
  return next;
}

export interface AddProgressionEventOptions {
  maxEvents?: number;
  timestamp?: number;
}

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
}
