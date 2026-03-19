import { describe, expect, it } from 'vite-plus/test';
import { Vector3 } from 'three';
import { SeededRng } from '../../src/utils/rng.js';
import {
  applySubsystemDamage,
  createSubsystems,
  getSubsystemMultiplier,
  repairSubsystems,
  updateSubsystemStatus,
} from '../../src/game/subsystems.js';
import type { ShipComponent, Subsystem } from '../../src/types/index.js';
import { createTestShip } from '../vitest/helpers/fixtures.js';

describe('subsystems helpers', () => {
  it('creates subsystems with consistent base values', () => {
    const subsystems = createSubsystems(200);
    expect(subsystems.engine).toMatchObject({ hp: 60, maxHp: 60, status: 'online' });
    expect(subsystems.weapons).toMatchObject({ hp: 60, maxHp: 60, status: 'online' });
    expect(subsystems.shields.repairRate).toBeCloseTo(6);
  });

  it('updates subsystem status based on hp ratio thresholds', () => {
    const subsystem = { hp: 10, maxHp: 40, status: 'online', repairRate: 1 } as const;
    const mutable: Subsystem = { ...subsystem };

    mutable.hp = 9; // 0.225 ratio => offline
    updateSubsystemStatus(mutable);
    expect(mutable.status).toBe('offline');

    mutable.hp = 16; // 0.4 ratio => damaged
    updateSubsystemStatus(mutable);
    expect(mutable.status).toBe('damaged');

    mutable.hp = 32; // 0.8 ratio => online
    updateSubsystemStatus(mutable);
    expect(mutable.status).toBe('online');
  });

  it('repairs subsystems in priority order with morale boosts', () => {
    const shipEntity = createTestShip(1, 'blue', new Vector3());
    const ship = shipEntity.ship as ShipComponent;
    ship.subsystems.shields.hp = 0;
    const initialWeaponHp = ship.subsystems.weapons.maxHp / 2;
    ship.subsystems.weapons.hp = initialWeaponHp;
    ship.captain = {
      accuracy: 1,
      repairSpeed: 1.5,
      moraleAbility: {
        cooldownRemaining: 0,
        maxCooldown: 10,
        duration: 5,
        effect: 'repair_boost',
        isActive: true,
        activeUntil: 10,
      },
    };

    repairSubsystems(ship, 1);

    expect(ship.subsystems.shields.hp).toBeGreaterThan(0);
    expect(ship.subsystems.shields.status).toBe('damaged');
    expect(ship.subsystems.weapons.hp).toBeGreaterThan(initialWeaponHp);
    expect(ship.subsystems.weapons.status).toBe('online');
    expect(ship.subsystems.engine.hp).toBe(ship.subsystems.engine.maxHp);
  });

  it('applies subsystem damage deterministically based on rng seed', () => {
    const shipEntity = createTestShip(2, 'red', new Vector3());
    const ship = shipEntity.ship as ShipComponent;
    const rng = new SeededRng(3);

    applySubsystemDamage(ship, 100, rng);

    expect(ship.subsystems.weapons.hp).toBeLessThan(ship.subsystems.weapons.maxHp);
    expect(ship.subsystems.weapons.status).toMatch(/damaged|offline/);
    expect(ship.subsystems.engine.hp).toBe(ship.subsystems.engine.maxHp);

    const multiplier = getSubsystemMultiplier('weapons', ship.subsystems.weapons.status);
    expect(multiplier).toBeLessThan(1);
  });
});
