import { describe, expect, it, vi } from 'vitest';
import { applyDamageResultToShip } from '../../src/game/combat/damage.js';
import type { GameState, ShipEntity } from '../../src/types/index.js';
import { Vector3 } from 'three';

/**
 * Test for preventing duplicate kill side-effects when multiple projectiles
 * hit the same ship in the same frame (before entity removal).
 */
describe('Duplicate kill side-effects prevention', () => {
  it('should trigger onKill only once when multiple projectiles destroy a ship', () => {
    // Create a minimal game state
    const state: Partial<GameState> = {
      time: 0,
    };

    // Create a ship with 100 HP
    const ship = {
      id: 1,
      transform: {
        position: new Vector3(0, 0, 0),
        rotation: new Vector3(0, 0, 0),
        scale: 1,
      },
      ship: {
        team: 1,
        hull: 'fighter' as any,
        hp: 100,
        maxHp: 100,
        shield: 0,
        maxShield: 0,
        armor: 0,
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

    // Create mock callbacks
    const onKillSpy = vi.fn();
    const onDamageAppliedSpy = vi.fn();

    const callbacks = {
      onKill: onKillSpy,
      onDamageApplied: onDamageAppliedSpy,
    };

    // Simulate first projectile dealing 60 damage
    const firstResult = applyDamageResultToShip({
      state: state as GameState,
      ship,
      damageResult: {
        shieldDamage: 0,
        armorDamage: 0,
        hullDamage: 60,
      },
      callbacks,
    });

    // Ship should still be alive
    expect(ship.ship.hp).toBe(40);
    expect(firstResult.destroyed).toBe(false);
    expect(onKillSpy).not.toHaveBeenCalled();
    expect(onDamageAppliedSpy).toHaveBeenCalledTimes(1);

    // Simulate second projectile dealing 50 damage (killing blow)
    const secondResult = applyDamageResultToShip({
      state: state as GameState,
      ship,
      damageResult: {
        shieldDamage: 0,
        armorDamage: 0,
        hullDamage: 50,
      },
      callbacks,
    });

    // Ship should now be dead
    expect(ship.ship.hp).toBe(0);
    expect(secondResult.destroyed).toBe(true);
    // onKill should have been called exactly once (on the transition to dead)
    expect(onKillSpy).toHaveBeenCalledTimes(1);
    expect(onDamageAppliedSpy).toHaveBeenCalledTimes(2);

    // Simulate third projectile hitting the already-dead ship (overkill)
    const thirdResult = applyDamageResultToShip({
      state: state as GameState,
      ship,
      damageResult: {
        shieldDamage: 0,
        armorDamage: 0,
        hullDamage: 30,
      },
      callbacks,
    });

    // Ship HP should be clamped at 0 (not negative)
    expect(ship.ship.hp).toBe(0);
    expect(thirdResult.destroyed).toBe(true);
    // onKill should STILL have been called only once
    expect(onKillSpy).toHaveBeenCalledTimes(1);
    expect(onDamageAppliedSpy).toHaveBeenCalledTimes(3);
  });

  it('should handle edge case of ship with exactly 0 HP being hit again', () => {
    const state: Partial<GameState> = {
      time: 0,
    };

    const ship = {
      id: 2,
      transform: {
        position: new Vector3(0, 0, 0),
        rotation: new Vector3(0, 0, 0),
        scale: 1,
      },
      ship: {
        team: 1,
        hull: 'fighter' as any,
        hp: 0, // Already dead
        maxHp: 100,
        shield: 0,
        maxShield: 0,
        armor: 0,
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

    const onKillSpy = vi.fn();

    // Hit an already-dead ship
    const result = applyDamageResultToShip({
      state: state as GameState,
      ship,
      damageResult: {
        shieldDamage: 0,
        armorDamage: 0,
        hullDamage: 50,
      },
      callbacks: {
        onKill: onKillSpy,
      },
    });

    expect(result.destroyed).toBe(true);
    // onKill should NOT be called since ship was already dead
    expect(onKillSpy).not.toHaveBeenCalled();
  });

  it('should trigger onKill when ship goes from positive HP to zero', () => {
    const state: Partial<GameState> = {
      time: 0,
    };

    const ship = {
      id: 3,
      transform: {
        position: new Vector3(0, 0, 0),
        rotation: new Vector3(0, 0, 0),
        scale: 1,
      },
      ship: {
        team: 1,
        hull: 'fighter' as any,
        hp: 50,
        maxHp: 100,
        shield: 0,
        maxShield: 0,
        armor: 0,
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

    const onKillSpy = vi.fn();

    // Deal exactly lethal damage
    const result = applyDamageResultToShip({
      state: state as GameState,
      ship,
      damageResult: {
        shieldDamage: 0,
        armorDamage: 0,
        hullDamage: 50,
      },
      callbacks: {
        onKill: onKillSpy,
      },
    });

    expect(ship.ship.hp).toBe(0);
    expect(result.destroyed).toBe(true);
    // onKill should be called on the transition
    expect(onKillSpy).toHaveBeenCalledTimes(1);
  });
});
