import { describe, expect, it } from 'vite-plus/test';
import type { GameState, ProgressionEvent } from '../../src/types/index.js';
import {
  addProgressionEvent,
  appendCappedHistory,
  DEFAULT_MAX_PROGRESSION_EVENTS,
} from '../../src/game/progression/events.js';

describe('progression events helpers', () => {
  it('appends events while enforcing a maximum size', () => {
    const base: ProgressionEvent[] = [];
    let events = base;
    for (let i = 0; i < DEFAULT_MAX_PROGRESSION_EVENTS + 5; i += 1) {
      const next = {
        ts: i,
        type: 'damage',
        deltaXp: 1,
        details: `${i}`,
        source: undefined,
      } as ProgressionEvent;
      events = appendCappedHistory(events, next);
    }

    expect(events).toHaveLength(DEFAULT_MAX_PROGRESSION_EVENTS);
    expect(events[0]!.ts).toBe(5);
    expect(events.at(-1)!.ts).toBe(DEFAULT_MAX_PROGRESSION_EVENTS + 4);
  });

  it('adds timestamped events to the game state map', () => {
    const state = {
      progressionEvents: new Map<number, ProgressionEvent[]>(),
    } as unknown as GameState;

    addProgressionEvent(
      state,
      7,
      { type: 'kill', deltaXp: 20, details: 'enemy defeated' },
      { timestamp: 42, maxEvents: 2 },
    );
    addProgressionEvent(
      state,
      7,
      { type: 'damage', deltaXp: 5, details: 'beam hit' },
      { timestamp: 50, maxEvents: 2 },
    );
    addProgressionEvent(
      state,
      7,
      { type: 'damage', deltaXp: 5, details: 'follow-up' },
      { timestamp: 60, maxEvents: 2 },
    );

    const history = state.progressionEvents.get(7);
    expect(history).toHaveLength(2);
    expect(history?.[0]).toMatchObject({ ts: 50, type: 'damage', details: 'beam hit' });
    expect(history?.[1]).toMatchObject({ ts: 60, type: 'damage', details: 'follow-up' });
  });
});
