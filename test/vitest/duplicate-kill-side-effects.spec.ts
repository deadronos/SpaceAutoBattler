import { describe, expect, it, vi } from 'vite-plus/test';
import { applyDamageResultToShip } from '../../src/game/combat/damage.js';
import type { GameState, ShipEntity } from '../../src/types/index.js';
import { Vector3 } from 'three';

describe('Duplicate kill side-effects prevention', () => {
  it('should trigger onKill only once when multiple projectiles destroy a ship', () => {
    const state: Partial<GameState> = { time: 0 };
    const ship = {
      id: 1,
      transform: { position: new Vector3(0, 0, 0), rotation: new Vector3(0, 0, 0), scale: 1 },
      ship: {
        hp: 100, maxHp: 100, shield: 0, armor: 0,
        motion: { mass: 1 },
        levelBonuses: { damage: 0, hp: 0, shield: 0, speed: 0, range: 0, fireRate: 0 },
      },
    } as unknown as ShipEntity;

    const onKillSpy = vi.fn();
    const callbacks = { onKill: onKillSpy };

    applyDamageResultToShip({ state: state as GameState, ship, damageResult: { shieldDamage: 0, armorDamage: 0, hullDamage: 60 }, callbacks });
    expect(ship.ship.hp).toBe(40);
    expect(onKillSpy).not.toHaveBeenCalled();

    applyDamageResultToShip({ state: state as GameState, ship, damageResult: { shieldDamage: 0, armorDamage: 0, hullDamage: 50 }, callbacks });
    expect(ship.ship.hp).toBe(0);
    expect(onKillSpy).toHaveBeenCalledTimes(1);

    applyDamageResultToShip({ state: state as GameState, ship, damageResult: { shieldDamage: 0, armorDamage: 0, hullDamage: 30 }, callbacks });
    expect(ship.ship.hp).toBe(0);
    expect(onKillSpy).toHaveBeenCalledTimes(1);
  });
});
