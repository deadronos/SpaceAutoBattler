import { describe, expect, it } from 'vite-plus/test';
import { Vector3 } from 'three';
import { awardDamageXp, awardKillXp } from '../../src/game/progression/xp.js';
import { XP_CONFIG } from '../../src/config/progression.js';
import { createLevelBonusState } from '../../src/game/progression/leveling.js';
import type { GameState, ShipComponent } from '../../src/types/index.js';
import { createTestShip, createTestGameState } from '../vitest/helpers/fixtures.js';

describe('progression xp helpers', () => {
  const createShip = (): ShipComponent => {
    const entity = createTestShip(11, 'blue', new Vector3());
    const ship = entity.ship as ShipComponent;
    ship.levelBonuses = createLevelBonusState();
    ship.xp = 0;
    ship.level = 1;
    ship.xpToNext = 20;
    return ship;
  };

  it('awards damage xp and records an event', () => {
    const ship = createShip();
    const state = { progressionEvents: new Map() } as unknown as GameState;

    awardDamageXp(ship, 50, state, 11, 'laser', 'beam');

    // damageDealt (50) * multiplier (0.5) = 25 XP
    // ship.xpToNext is 20, so it levels up.
    // Remaining XP should be 25 - 20 = 5
    expect(ship.xp).toBeCloseTo(5);
    expect(ship.level).toBe(2);
    expect(state.progressionEvents.get(11)).toHaveLength(2); // damage + levelup
    expect(state.progressionEvents.get(11)?.[0]).toMatchObject({
      type: 'damage',
      deltaXp: 25,
      details: '50.0 damage dealt with laser [beam]',
    });
  });

  it('awards kill xp and triggers level up when threshold is met', () => {
    const ship = createShip();
    ship.xpToNext = 10;
    const state = { progressionEvents: new Map() } as unknown as GameState;

    awardKillXp(ship, 30, state, 11);

    expect(ship.level).toBeGreaterThan(1);
    expect(ship.xp).toBeGreaterThanOrEqual(0);
    expect(state.progressionEvents.get(11)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'kill' }),
        expect.objectContaining({ type: 'levelup' }),
      ]),
    );
  });

  it('updates canonical ship in GameState when ship component copy is passed', () => {
    const entity = createTestShip(123, 'blue', new Vector3());
    const state = createTestGameState({ queries: { ships: { entities: [entity] } } as any });

    const copy = { ...entity.ship } as ShipComponent;
    expect(copy.xp).toBe(0);

    awardDamageXp(copy, 20, state, entity.id);

    const expected = 20 * XP_CONFIG.damageXpMultiplier;
    const registered = state.shipById.get(entity.id)!;
    expect(registered.ship.xp).toBeCloseTo(expected);
    // copy should remain unchanged because we update the canonical state entry
    expect(copy.xp).toBe(0);
  });
});
