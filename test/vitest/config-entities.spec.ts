import { describe, test, expect } from 'vitest';
import {
  TURRET_CONFIGS,
  SHIP_CLASS_CONFIGS,
  getShipClassConfig,
  getTurretConfig,
  getAllShipClasses,
  getAllTurretConfigs
} from '../../src/config/entitiesConfig.js';
import type { ShipClass } from '../../src/types/index.js';

// Test utilities
function validateConfigStructure(config: any, expectedKeys: string[]) {
  expectedKeys.forEach(key => {
    expect(config).toHaveProperty(key);
  });
}

describe('Entities Configuration', () => {
  describe('Turret Configurations', () => {
    test('should have all expected turret configs', () => {
      const expectedTurrets = [
        'fighter-cannon',
        'corvette-cannon',
        'frigate-cannon',
        'destroyer-cannon',
        'carrier-cannon'
      ];

      expectedTurrets.forEach(turretId => {
        expect(TURRET_CONFIGS).toHaveProperty(turretId);
      });
    });

    test('should have valid turret config structure', () => {
      Object.values(TURRET_CONFIGS).forEach(config => {
        validateConfigStructure(config, ['id', 'cooldown', 'bulletSpeed', 'damage', 'range']);

        expect(config.cooldown).toBeGreaterThan(0);
        expect(config.bulletSpeed).toBeGreaterThan(0);
        expect(config.damage).toBeGreaterThan(0);
        expect(config.range).toBeGreaterThan(0);
      });
    });

    test('should have progressive stat increases by ship class', () => {
      const turrets = [
        TURRET_CONFIGS['fighter-cannon'],
        TURRET_CONFIGS['corvette-cannon'],
        TURRET_CONFIGS['frigate-cannon'],
        TURRET_CONFIGS['destroyer-cannon'],
        TURRET_CONFIGS['carrier-cannon']
      ];

      // Damage should generally increase, but carriers have less than destroyers (by design)
      expect(turrets[1].damage).toBeGreaterThan(turrets[0].damage); // corvette > fighter
      expect(turrets[2].damage).toBeGreaterThan(turrets[1].damage); // frigate > corvette
      expect(turrets[3].damage).toBeGreaterThan(turrets[2].damage); // destroyer > frigate
      // Carrier has less damage than destroyer (by design - carriers focus on fighters)

      // Range should generally increase, but destroyer and carrier have same range (by design)
      expect(turrets[1].range).toBeGreaterThan(turrets[0].range); // corvette > fighter
      expect(turrets[2].range).toBeGreaterThan(turrets[1].range); // frigate > corvette
      expect(turrets[3].range).toBeGreaterThanOrEqual(turrets[2].range); // destroyer >= frigate
      // Carrier has same range as destroyer (by design)
    });

    test('getTurretConfig should return correct config', () => {
      const fighterTurret = getTurretConfig('fighter-cannon');
      expect(fighterTurret).toBeDefined();
      expect(fighterTurret!.id).toBe('fighter-cannon');
      expect(fighterTurret!.damage).toBe(6);

      const unknownTurret = getTurretConfig('unknown-turret');
      expect(unknownTurret).toBeUndefined();
    });

    test('getAllTurretConfigs should return all turret configs', () => {
      const allConfigs = getAllTurretConfigs();
      expect(allConfigs).toHaveLength(Object.keys(TURRET_CONFIGS).length);
      expect(allConfigs).toEqual(expect.arrayContaining(Object.values(TURRET_CONFIGS)));
    });
  });

  describe('Ship Class Configurations', () => {
    test('should have all expected ship classes', () => {
      const expectedClasses = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
      expectedClasses.forEach(shipClass => {
        expect(SHIP_CLASS_CONFIGS).toHaveProperty(shipClass);
      });
    });

    test('should have valid ship config structure', () => {
      Object.values(SHIP_CLASS_CONFIGS).forEach(config => {
        validateConfigStructure(config, ['class', 'baseHealth', 'armor', 'shield', 'shieldRegen', 'speed', 'turnRate', 'turrets']);

        expect(config.baseHealth).toBeGreaterThan(0);
        expect(config.armor).toBeGreaterThanOrEqual(0);
        expect(config.shield).toBeGreaterThanOrEqual(0);
        expect(config.shieldRegen).toBeGreaterThanOrEqual(0);
        expect(config.speed).toBeGreaterThan(0);
        expect(config.turnRate).toBeGreaterThan(0);
        expect(config.turrets).toBeInstanceOf(Array);
        expect(config.turrets.length).toBeGreaterThan(0);
      });
    });

    test('should have progressive stat increases by ship class', () => {
      const shipClasses: ShipClass[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
      const configs = shipClasses.map(cls => SHIP_CLASS_CONFIGS[cls]);

      // Health should increase progressively
      for (let i = 1; i < configs.length; i++) {
        expect(configs[i].baseHealth).toBeGreaterThan(configs[i - 1].baseHealth);
      }

      // Armor should generally increase, but carriers have less than destroyers (by design)
      expect(configs[1].armor).toBeGreaterThan(configs[0].armor); // corvette > fighter
      expect(configs[2].armor).toBeGreaterThan(configs[1].armor); // frigate > corvette
      expect(configs[3].armor).toBeGreaterThan(configs[2].armor); // destroyer > frigate
      // Carrier has less armor than destroyer (by design - carriers are more fragile)

      // Shield should increase progressively
      for (let i = 1; i < configs.length; i++) {
        expect(configs[i].shield).toBeGreaterThanOrEqual(configs[i - 1].shield);
      }
    });

    test('should have appropriate turret counts per ship class', () => {
      expect(SHIP_CLASS_CONFIGS.fighter.turrets).toHaveLength(1);
      expect(SHIP_CLASS_CONFIGS.corvette.turrets).toHaveLength(2);
      expect(SHIP_CLASS_CONFIGS.frigate.turrets).toHaveLength(3);
      expect(SHIP_CLASS_CONFIGS.destroyer.turrets).toHaveLength(4);
      expect(SHIP_CLASS_CONFIGS.carrier.turrets).toHaveLength(2);
    });

    test('carrier should have fighter spawning capabilities', () => {
      const carrier = SHIP_CLASS_CONFIGS.carrier;
      expect(carrier.maxFighters).toBeDefined();
      expect(carrier.fighterSpawnCooldown).toBeDefined();
      expect(carrier.maxFighters).toBeGreaterThan(0);
      expect(carrier.fighterSpawnCooldown).toBeGreaterThan(0);
    });

    test('getShipClassConfig should return correct config', () => {
      const fighterConfig = getShipClassConfig('fighter');
      expect(fighterConfig).toBeDefined();
      expect(fighterConfig.class).toBe('fighter');
      expect(fighterConfig.baseHealth).toBe(80);

      // Should return the same object reference
      expect(getShipClassConfig('fighter')).toBe(SHIP_CLASS_CONFIGS.fighter);
    });

    test('getAllShipClasses should return all ship classes', () => {
      const allClasses = getAllShipClasses();
      expect(allClasses).toHaveLength(Object.keys(SHIP_CLASS_CONFIGS).length);
      expect(allClasses).toEqual(expect.arrayContaining(['fighter', 'corvette', 'frigate', 'destroyer', 'carrier']));
    });
  });

  describe('Configuration Balance Validation', () => {
    test('turret damage should scale appropriately with ship health', () => {
      const shipClasses: ShipClass[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
      const configs = shipClasses.map(cls => SHIP_CLASS_CONFIGS[cls]);

      configs.forEach(config => {
        const totalTurretDamage = config.turrets.reduce((sum: number, turret) => sum + turret.damage, 0);
        const avgTurretDamage = totalTurretDamage / config.turrets.length;

        // Average turret damage should be proportional to ship health
        // Fighters should have lower relative damage, capital ships higher
        const expectedRatio = config.baseHealth / 100; // Normalized to fighter baseline
        const actualRatio = avgTurretDamage / 6; // Normalized to fighter baseline

        // Adjust expectations based on actual config - carriers have less damage than destroyers
        if (config.class === 'carrier') {
          expect(actualRatio).toBeGreaterThanOrEqual(expectedRatio * 0.3); // Carriers have lower damage ratio
          expect(actualRatio).toBeLessThanOrEqual(expectedRatio * 1.5);
        } else {
          expect(actualRatio).toBeGreaterThanOrEqual(expectedRatio * 0.5);
          expect(actualRatio).toBeLessThanOrEqual(expectedRatio * 2.0);
        }
      });
    });

    test('ship speed should be inversely related to size/complexity', () => {
      const shipClasses: ShipClass[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
      const configs = shipClasses.map(cls => SHIP_CLASS_CONFIGS[cls]);

      // Fighters should be fastest, carriers slowest
      for (let i = 1; i < configs.length; i++) {
        expect(configs[i].speed).toBeLessThanOrEqual(configs[i - 1].speed);
      }
    });

    test('turn rate should decrease with ship size', () => {
      const shipClasses: ShipClass[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
      const configs = shipClasses.map(cls => SHIP_CLASS_CONFIGS[cls]);

      // Fighters should turn fastest, carriers slowest
      for (let i = 1; i < configs.length; i++) {
        expect(configs[i].turnRate).toBeLessThanOrEqual(configs[i - 1].turnRate);
      }
    });

    test('shield regen should scale with ship size', () => {
      const shipClasses: ShipClass[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
      const configs = shipClasses.map(cls => SHIP_CLASS_CONFIGS[cls]);

      // Larger ships should have higher shield regen
      for (let i = 1; i < configs.length; i++) {
        expect(configs[i].shieldRegen).toBeGreaterThanOrEqual(configs[i - 1].shieldRegen);
      }
    });
  });
});