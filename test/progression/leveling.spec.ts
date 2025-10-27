import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  applyLevelUpBonuses,
  checkLevelUp,
  createLevelBonusState,
} from '../../src/game/progression/leveling.js';
import type { GameState, ShipComponent } from '../../src/types/index.js';
import { createTestShip } from '../vitest/helpers/fixtures.js';

describe('progression leveling helpers', () => {
  const createShip = (): ShipComponent => {
    const entity = createTestShip(21, 'red', new Vector3());
    const ship = entity.ship as ShipComponent;
    ship.levelBonuses = createLevelBonusState();
    ship.level = 1;
    ship.xp = 0;
    ship.xpToNext = 10;
    return ship;
  };

  it('creates level bonus state with zeroed fields', () => {
    expect(createLevelBonusState()).toEqual({
      hull: 0,
      shield: 0,
      damage: 0,
      shieldRegen: 0,
      repairRate: 0,
      fireRate: 0,
    });
  });

  it('applies stat bonuses when leveling up', () => {
    const ship = createShip();
    const prevHp = ship.maxHp;
    const prevDamage = ship.damage;
    const prevRepairRate = ship.subsystems.engine.repairRate;

    ship.level = 2;
    applyLevelUpBonuses(ship);

    expect(ship.maxHp).toBeGreaterThan(prevHp);
    expect(ship.damage).toBeGreaterThan(prevDamage);
    expect(ship.subsystems.engine.repairRate).toBeGreaterThan(prevRepairRate);
    expect(ship.levelBonuses.hull).toBeGreaterThanOrEqual(0);
  });

  it('levels up ships and logs events when xp threshold is reached', () => {
    const ship = createShip();
    ship.xp = 15;
    const state = { progressionEvents: new Map() } as unknown as GameState;

    const leveled = checkLevelUp(ship, state, 21);

    expect(leveled).toBe(true);
    expect(ship.level).toBeGreaterThan(1);
    expect(ship.xp).toBeLessThan(15);
    expect(state.progressionEvents.get(21)).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'levelup' })]),
    );
  });
});
