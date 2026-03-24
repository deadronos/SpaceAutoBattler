import { describe, expect, it, vi } from 'vite-plus/test';
import { applyDamageResultToShip } from '../../src/game/combat/damage.js';
import type { GameState, ShipEntity } from '../../src/types/index.js';
import { Vector3 } from 'three';

function createShip({
  id,
  hp,
  shield = 0,
  armor = 0,
  maxHp = 100,
  maxShield = 0,
}: {
  id: number;
  hp: number;
  shield?: number;
  armor?: number;
  maxHp?: number;
  maxShield?: number;
}): ShipEntity {
  return {
    id,
    transform: {
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      scale: 1,
    },
    ship: {
      team: 1,
      hull: 'fighter' as any,
      hp,
      maxHp,
      shield,
      maxShield,
      armor,
      cooldown: 0,
      fireRate: 1,
      damage: 10,
      projectileSpeed: 100,
      range: 100,
      speed: 10,
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: {
        maxSpeed: 10,
        acceleration: 5,
        deceleration: 5,
        turnRate: 1,
        mass: 1,
      },
      sensor: {
        detectionRange: 100,
        trackingRange: 100,
        lockTime: 0,
      },
      xp: 0,
      level: 1,
      xpToNext: 100,
      damageType: 'kinetic',
      levelBonuses: {
        damage: 0,
        hp: 0,
        shield: 0,
        speed: 0,
        range: 0,
        fireRate: 0,
      },
    },
  } as unknown as ShipEntity;
}

describe('Duplicate kill side-effects prevention', () => {
  it('should trigger onKill only once when multiple projectiles destroy a ship', () => {
    const state: Partial<GameState> = { time: 0 };
    const ship = createShip({ id: 1, hp: 100, maxShield: 100 });

    const onKillSpy = vi.fn();
    const callbacks = { onKill: onKillSpy };

    applyDamageResultToShip({
      state: state as GameState,
      ship,
      damageResult: { shieldDamage: 0, armorDamage: 0, hullDamage: 60 },
      callbacks,
    });
    expect(ship.ship.hp).toBe(40);
    expect(onKillSpy).not.toHaveBeenCalled();

    applyDamageResultToShip({
      state: state as GameState,
      ship,
      damageResult: { shieldDamage: 0, armorDamage: 0, hullDamage: 50 },
      callbacks,
    });
    expect(ship.ship.hp).toBe(0);
    expect(onKillSpy).toHaveBeenCalledTimes(1);

    applyDamageResultToShip({
      state: state as GameState,
      ship,
      damageResult: { shieldDamage: 0, armorDamage: 0, hullDamage: 30 },
      callbacks,
    });
    expect(ship.ship.hp).toBe(0);
    expect(onKillSpy).toHaveBeenCalledTimes(1);
  });

  it('should trigger onKill when ship goes from positive HP to zero', () => {
    const state: Partial<GameState> = { time: 0 };
    const ship = createShip({ id: 2, hp: 50, maxShield: 100 });

    const onKillSpy = vi.fn();

    applyDamageResultToShip({
      state: state as GameState,
      ship,
      damageResult: { shieldDamage: 0, armorDamage: 0, hullDamage: 50 },
      callbacks: { onKill: onKillSpy },
    });

    expect(ship.ship.hp).toBe(0);
    expect(onKillSpy).toHaveBeenCalledTimes(1);
  });

  it('should not trigger onKill when dealing non-hull damage to already-dead ship', () => {
    const state: Partial<GameState> = { time: 0 };
    const ship = createShip({ id: 3, hp: 0, shield: 10, maxShield: 100 });

    const onKillSpy = vi.fn();

    applyDamageResultToShip({
      state: state as GameState,
      ship,
      damageResult: { shieldDamage: 5, armorDamage: 0, hullDamage: 0 },
      callbacks: { onKill: onKillSpy },
    });

    expect(ship.ship.hp).toBe(0);
    expect(onKillSpy).not.toHaveBeenCalled();
  });
});
