import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { awardDamageXp, awardKillXp } from '../../src/game/progression/xp.js';
import { createLevelBonusState } from '../../src/game/progression/leveling.js';
import type { GameState, ShipComponent } from '../../src/types/index.js';
import { createTestShip } from '../vitest/helpers/fixtures.js';

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

    expect(ship.xp).toBeCloseTo(5); // 50 * 0.1
    expect(state.progressionEvents.get(11)).toHaveLength(1);
    expect(state.progressionEvents.get(11)?.[0]).toMatchObject({
      type: 'damage',
      deltaXp: 5,
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
});
