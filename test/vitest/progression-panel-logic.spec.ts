import { describe, it, expect } from 'vite-plus/test';
import type { ProgressionEvent, ShipEntity } from '../../src/types/index.js';
import { createProgressionDefaults } from '../../src/game/progression.js';
import {
  buildProgressionPanelData,
  DEFAULT_MAX_EVENTS_PER_SHIP,
  DEFAULT_MAX_PROGRESSION_SHIPS,
} from '../../src/components/progressionPanelData.js';

// Test the real shipped transform used by ProgressionPanel, not a duplicated copy.
describe('Progression Panel Data Transformation', () => {
  it('transforms GameState ships to progression panel format', () => {
    // Create mock ship data
    const mockShips = [
      {
        id: 1,
        ship: {
          team: 'blue',
          hull: 'fighter',
          hp: 100,
          maxHp: 100,
          shield: 50,
          maxShield: 50,
          cooldown: 0,
          fireRate: 1,
          damage: 10,
          projectileSpeed: 100,
          range: 200,
          speed: 50,
          velocity: { x: 0, y: 0, z: 0 } as any,
          angularVelocity: { x: 0, y: 0, z: 0 } as any,
          lateralAcceleration: 0,
          motion: {} as any,
          ...createProgressionDefaults('fighter'),
          xp: 150,
          level: 2,
          xpToNext: 50,
        },
        transform: {
          position: { x: 0, y: 0, z: 0 } as any,
          rotation: { x: 0, y: 0, z: 0, w: 1 } as any,
          scale: 1,
        },
      },
    ] as any;

    const progressionEvents = new Map<number, ProgressionEvent[]>();
    progressionEvents.set(1, [
      {
        ts: Date.now() - 5000,
        type: 'damage',
        deltaXp: 10,
        source: 'bullet:laser',
        details: '15.0 damage dealt with bullet:laser [bullet]',
      },
    ]);

    const progressionShips = buildProgressionPanelData(mockShips, progressionEvents);

    // Validate transformation
    expect(progressionShips).toHaveLength(1);
    expect(progressionShips[0]).toEqual({
      id: 1,
      name: 'fighter-1',
      type: 'fighter',
      team: 'blue',
      level: 2,
      xp: 150,
      xpToNext: 50,
      events: [
        {
          ts: expect.any(Number),
          type: 'damage',
          deltaXp: 10,
          source: 'bullet:laser',
          details: '15.0 damage dealt with bullet:laser [bullet]',
        },
      ],
    });
  });

  it('sorts ships by level descending then XP descending', () => {
    const mockShips = [
      {
        id: 1,
        ship: { level: 1, xp: 50, hull: 'fighter', team: 'blue' },
      },
      {
        id: 2,
        ship: { level: 2, xp: 30, hull: 'destroyer', team: 'red' },
      },
      {
        id: 3,
        ship: { level: 1, xp: 75, hull: 'corvette', team: 'blue' },
      },
    ] as any;

    const progressionShips = buildProgressionPanelData(mockShips, undefined);

    // Should be: Level 2 first, then Level 1 ships ordered by XP
    expect(
      progressionShips.map((ship) => ({
        id: ship.id,
        level: ship.level,
        xp: ship.xp,
      })),
    ).toEqual([
      { id: 2, level: 2, xp: 30 }, // Level 2
      { id: 3, level: 1, xp: 75 }, // Level 1, higher XP
      { id: 1, level: 1, xp: 50 }, // Level 1, lower XP
    ]);
  });

  it('limits events to last N entries', () => {
    const events: ProgressionEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push({
        ts: Date.now() - (10 - i) * 1000,
        type: 'damage',
        deltaXp: i + 1,
        details: `Event ${i + 1}`,
      });
    }

    const mockShips = [
      {
        id: 1,
        ship: { level: 1, xp: 0, hull: 'fighter', team: 'blue' },
      },
    ] as any;

    const progressionShips = buildProgressionPanelData(
      mockShips,
      new Map<number, ProgressionEvent[]>([[1, events]]),
    );

    const limitedEvents = progressionShips[0]!.events;
    expect(limitedEvents).toHaveLength(DEFAULT_MAX_EVENTS_PER_SHIP);
    expect(limitedEvents[0]!.details).toBe('Event 6');
    expect(limitedEvents[4]!.details).toBe('Event 10');
  });

  it('caps the number of ships to the configured maximum', () => {
    const mockShips: ShipEntity[] = [];
    for (let i = 0; i < 60; i++) {
      mockShips.push({
        id: i,
        ship: { level: 1, xp: i, hull: 'fighter', team: 'blue' },
      } as unknown as ShipEntity);
    }

    const progressionShips = buildProgressionPanelData(mockShips, undefined);

    expect(progressionShips).toHaveLength(DEFAULT_MAX_PROGRESSION_SHIPS);

    const limited = buildProgressionPanelData(mockShips, undefined, { maxShips: 3 });
    expect(limited).toHaveLength(3);
  });
});
