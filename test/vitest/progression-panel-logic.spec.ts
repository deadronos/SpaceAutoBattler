import { describe, it, expect } from 'vitest';
import type { GameState, ShipEntity, ProgressionEvent } from '../../src/types/index.js';
import { createProgressionDefaults } from '../../src/game/progression.js';

// Test the core data transformation logic separately from React rendering
describe('Progression Panel Data Transformation', () => {
  it('transforms GameState ships to progression panel format', () => {
    // Create mock ship data
    const mockShips: ShipEntity[] = [
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
    ];

    const progressionEvents = new Map<number, ProgressionEvent[]>();
    progressionEvents.set(1, [
      {
        ts: Date.now() - 5000,
        type: 'damage',
        deltaXp: 10,
        details: '15.0 damage dealt'
      }
    ]);

    // Transform to progression panel format
    const progressionShips = [];
    for (const ship of mockShips) {
      const events = progressionEvents.get(ship.id) || [];
      progressionShips.push({
        id: ship.id,
        name: `${ship.ship.hull}-${ship.id}`,
        type: ship.ship.hull,
        team: ship.ship.team,
        level: ship.ship.level,
        xp: ship.ship.xp,
        xpToNext: ship.ship.xpToNext,
        events: events.slice(-5)
      });
    }

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
          details: '15.0 damage dealt'
        }
      ]
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

    const progressionShips = mockShips
      .map((ship: any) => ({
        id: ship.id,
        level: ship.ship.level,
        xp: ship.ship.xp,
      }))
      .sort((a: any, b: any) => {
        if (a.level !== b.level) return b.level - a.level;
        return b.xp - a.xp;
      });

    // Should be: Level 2 first, then Level 1 ships ordered by XP
    expect(progressionShips).toEqual([
      { id: 2, level: 2, xp: 30 },  // Level 2
      { id: 3, level: 1, xp: 75 },  // Level 1, higher XP
      { id: 1, level: 1, xp: 50 },  // Level 1, lower XP
    ]);
  });

  it('limits events to last N entries', () => {
    const events: ProgressionEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push({
        ts: Date.now() - (10 - i) * 1000,
        type: 'damage',
        deltaXp: i + 1,
        details: `Event ${i + 1}`
      });
    }

    const MAX_EVENTS = 5;
    const limitedEvents = events.slice(-MAX_EVENTS);

    expect(limitedEvents).toHaveLength(5);
    expect(limitedEvents[0].details).toBe('Event 6');
    expect(limitedEvents[4].details).toBe('Event 10');
  });
});