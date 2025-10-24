import { describe, it, expect, beforeEach } from 'vitest';
import { Vector3 } from 'three';
import type { ShipComponent } from '../../src/types/index.js';
import {
  awardDamageXp,
  awardKillXp,
  checkLevelUp,
  generateCaptain,
  createSubsystems,
  applySubsystemDamage,
  repairSubsystems,
  updateCaptainAbilities,
  activateMoraleAbility,
  calculateEffectiveDamage,
  getEffectiveStats,
  createProgressionDefaults,
  updateSubsystemStatus,
} from '../../src/game/progression.js';
import { SeededRng } from '../../src/utils/rng.js';
import { calculateXpForLevel, LEVEL_BONUSES } from '../../src/config/progression.js';

describe('Ship Progression System', () => {
  let testShip: ShipComponent;

  beforeEach(() => {
    const progressionDefaults = createProgressionDefaults('fighter');
    testShip = {
      team: 'blue',
      hull: 'fighter',
      hp: 40,
      maxHp: 40,
      shield: 24,
      maxShield: 24,
      shieldRegen: 4.0,
      cooldown: 0,
      fireRate: 0.9,
      damage: 8,
      projectileSpeed: 80,
      range: 220,
      speed: 40,
      bulletType: 'bullet:laser',
      parentCarrierId: undefined,
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      lateralAcceleration: 0,
      motion: {
        mass: 1.0,
        maxSpeed: 40,
        maxReverseSpeed: 5,
        linearAcceleration: 34,
        linearDamping: 3.0,
        maxTurnRate: Math.PI * 1.5,
        angularAcceleration: Math.PI * 4,
        angularDamping: 8.0,
        maxLateralAcceleration: 12,
        visualBankFactor: 20,
        maxBankDeg: 35,
        smoothing: {
          positionLerp: 0.2,
          rotationSlerp: 0.28,
          bankLerp: 0.2,
          teleportDistance: 42,
        },
      },
      sensor: { detectionRange: 600, trackingRange: 720, coneAngle: Math.PI * 0.8, falloff: 0.6 },
      stealth: 0,
      sensorSignature: 1,
      effects: undefined,
      ...progressionDefaults,
    };
  });

  describe('XP System', () => {
    it('should award XP for damage dealt', () => {
      const initialXp = testShip.xp;
      awardDamageXp(testShip, 20);

      expect(testShip.xp).toBe(initialXp + 2); // 20 * 0.1 = 2 XP
    });

    it('should award XP for kills', () => {
      const initialXp = testShip.xp;
      awardKillXp(testShip, 100); // Enemy with 100 max HP

      expect(testShip.xp).toBe(initialXp + 50); // 100 * 0.5 = 50 XP
    });

    it('should level up when enough XP is gained', () => {
      expect(testShip.level).toBe(1);

      // Award enough XP to level up (need 100 XP for level 2)
      awardDamageXp(testShip, 1000); // 100 XP

      expect(testShip.level).toBe(2);
      expect(testShip.xp).toBe(0); // Should reset to 0 after level up
      expect(testShip.maxHp).toBeGreaterThan(40); // Should have bonus from level up
    });

    it('should calculate correct XP requirements for levels', () => {
      expect(calculateXpForLevel(1)).toBe(0);
      expect(calculateXpForLevel(2)).toBe(100);
      expect(calculateXpForLevel(3)).toBeGreaterThan(100);
    });
  });

  describe('Captain System', () => {
    it('should generate captains for destroyers and carriers', () => {
      const destroyerCaptain = generateCaptain('destroyer', 12345);
      const carrierCaptain = generateCaptain('carrier', 12345);
      const fighterCaptain = generateCaptain('fighter', 12345);

      expect(destroyerCaptain).toBeDefined();
      expect(carrierCaptain).toBeDefined();
      expect(fighterCaptain).toBeUndefined(); // Fighters don't get captains
    });

    it('should generate captains with valid traits', () => {
      const captain = generateCaptain('carrier', 12345);
      expect(captain).toBeDefined();

      if (captain) {
        expect(captain.accuracy).toBeGreaterThan(0.8);
        expect(captain.accuracy).toBeLessThan(1.2);
        expect(captain.repairSpeed).toBeGreaterThan(0.8);
        expect(captain.repairSpeed).toBeLessThan(1.2);
      }
    });

    it('should handle morale abilities correctly', () => {
      const captain = generateCaptain('carrier', 12345);
      if (captain?.moraleAbility) {
        testShip.captain = captain;

        const activated = activateMoraleAbility(testShip, 0);
        expect(activated).toBe(true);
        expect(captain.moraleAbility.isActive).toBe(true);
        expect(captain.moraleAbility.cooldownRemaining).toBeGreaterThan(0);

        // Can't activate again while on cooldown
        const activatedAgain = activateMoraleAbility(testShip, 0);
        expect(activatedAgain).toBe(false);
      }
    });

    it('should update captain abilities over time', () => {
      const captain = generateCaptain('carrier', 12345);
      if (captain?.moraleAbility) {
        testShip.captain = captain;
        captain.moraleAbility.cooldownRemaining = 10;
        captain.moraleAbility.isActive = true;
        captain.moraleAbility.activeUntil = 5;

        // Update with time=6 (past activeUntil)
        updateCaptainAbilities(testShip, 6, 1);

        expect(captain.moraleAbility.isActive).toBe(false);
        expect(captain.moraleAbility.cooldownRemaining).toBeLessThan(10);
      }
    });
  });

  describe('Damage Type System', () => {
    it('should calculate damage effectiveness correctly', () => {
      // Test kinetic vs shields (should be less effective)
      const result1 = calculateEffectiveDamage(100, 'kinetic', 200, 10);
      expect(result1.shieldDamage).toBeLessThan(100); // Kinetic is 0.8x vs shields

      // Test ion vs shields (should be more effective) - use smaller damage so we can see the multiplier
      const result2 = calculateEffectiveDamage(50, 'ion', 200, 10);
      expect(result2.shieldDamage).toBeGreaterThan(50); // Ion is 1.4x vs shields

      // Test plasma vs armor (should be more effective)
      const result3 = calculateEffectiveDamage(100, 'plasma', 0, 20);
      expect(result3.hullDamage).toBeGreaterThan(50); // Plasma is 1.3x vs armor, 1.1x vs hull
    });

    it('should handle shield-first damage correctly', () => {
      const result = calculateEffectiveDamage(50, 'kinetic', 30, 10);

      // Should damage shields first
      expect(result.shieldDamage).toBeGreaterThan(0);
      // Should have some hull damage if shields break
      if (result.shieldDamage >= 30) {
        expect(result.hullDamage).toBeGreaterThan(0);
      }
    });
  });

  describe('Subsystem System', () => {
    it('should create subsystems with correct HP', () => {
      const subsystems = createSubsystems(100);

      expect(subsystems.engine.maxHp).toBe(30); // 30% of ship HP
      expect(subsystems.weapons.maxHp).toBe(30);
      expect(subsystems.shields.maxHp).toBe(30);
      expect(subsystems.engine.status).toBe('online');
    });

    it('should apply subsystem damage on critical hits', () => {
      const rng = new SeededRng(12345);

      // Apply damage multiple times to try to trigger critical hit
      for (let i = 0; i < 20; i++) {
        applySubsystemDamage(testShip, 20, rng);
      }

      // At least one subsystem should have taken damage (15% chance per hit)
      const anyDamaged = Object.values(testShip.subsystems).some((s) => s.hp < s.maxHp);
      expect(anyDamaged).toBe(true);
    });

    it('should repair subsystems over time', () => {
      // Damage a subsystem
      testShip.subsystems.weapons.hp = 15; // Half health
      testShip.subsystems.weapons.status = 'damaged';

      const initialHp = testShip.subsystems.weapons.hp;
      repairSubsystems(testShip, 1.0); // 1 second of repairs

      expect(testShip.subsystems.weapons.hp).toBeGreaterThan(initialHp);
    });

    it('should apply subsystem status effects to actual ship performance', () => {
      // Test shield regen multiplier
      testShip.subsystems.shields.hp = 10; // Low HP = damaged status
      testShip.subsystems.shields.status = 'damaged';

      const stats = getEffectiveStats(testShip);
      expect(stats.shieldRegenMultiplier).toBe(0.7); // Should be reduced

      // Test weapon damage multiplier
      testShip.subsystems.weapons.hp = 5; // Very low HP = offline status
      testShip.subsystems.weapons.status = 'offline';

      const stats2 = getEffectiveStats(testShip);
      expect(stats2.damageMultiplier).toBe(0.4); // Should be severely reduced

      // Test engine speed multiplier
      testShip.subsystems.engine.hp = 15; // Moderate HP = damaged status
      testShip.subsystems.engine.status = 'damaged';

      const stats3 = getEffectiveStats(testShip);
      expect(stats3.speedMultiplier).toBe(0.75); // Should be reduced
    });

    it('should apply subsystem status effects', () => {
      // Damage engine to test speed reduction
      testShip.subsystems.engine.hp = 10; // Low HP
      testShip.subsystems.engine.status = 'damaged';

      const stats = getEffectiveStats(testShip);
      expect(stats.speedMultiplier).toBeLessThan(1.0); // Should be reduced

      // Damage weapons to test damage reduction
      testShip.subsystems.weapons.hp = 5;
      testShip.subsystems.weapons.status = 'offline';

      const stats2 = getEffectiveStats(testShip);
      expect(stats2.damageMultiplier).toBeLessThan(0.5); // Should be significantly reduced
    });

    it('should update subsystem status based on HP', () => {
      const subsystem = testShip.subsystems.engine;

      // Full health = online
      subsystem.hp = subsystem.maxHp;
      updateSubsystemStatus(subsystem);
      expect(subsystem.status).toBe('online');

      // Damaged threshold
      subsystem.hp = subsystem.maxHp * 0.4; // Below 50% = damaged
      updateSubsystemStatus(subsystem);
      expect(subsystem.status).toBe('damaged');

      // Offline threshold
      subsystem.hp = subsystem.maxHp * 0.1; // Below 25% = offline
      updateSubsystemStatus(subsystem);
      expect(subsystem.status).toBe('offline');
    });
  });

  describe('Level bonus caps', () => {
    const levelAfterCap = 11;

    const levelShipTo = (ship: ShipComponent, targetLevel: number): void => {
      while (ship.level < targetLevel) {
        ship.xp = ship.xpToNext;
        checkLevelUp(ship);
      }
    };

    it('caps stat multipliers at configured limits', () => {
      const baseMaxHp = testShip.maxHp;
      const baseMaxShield = testShip.maxShield;
      const baseDamage = testShip.damage;
      const baseShieldRegen = testShip.shieldRegen ?? 0;
      const baseRepairRate = testShip.subsystems.engine.repairRate;

      levelShipTo(testShip, levelAfterCap);

      expect(testShip.maxHp).toBeCloseTo(baseMaxHp * (1 + LEVEL_BONUSES.hull.cap));
      expect(testShip.hp).toBeCloseTo(testShip.maxHp);
      expect(testShip.maxShield).toBeCloseTo(baseMaxShield * (1 + LEVEL_BONUSES.shield.cap));
      expect(testShip.damage).toBeCloseTo(baseDamage * (1 + LEVEL_BONUSES.damage.cap));
      expect(testShip.shieldRegen ?? 0).toBeCloseTo(
        baseShieldRegen * (1 + LEVEL_BONUSES.shieldRegen.cap),
      );
      expect(testShip.subsystems.engine.repairRate).toBeCloseTo(
        baseRepairRate * (1 + LEVEL_BONUSES.repairRate.cap),
      );
      expect(testShip.levelBonuses.hull).toBeCloseTo(LEVEL_BONUSES.hull.cap);
      expect(testShip.levelBonuses.fireRate).toBeCloseTo(LEVEL_BONUSES.fireRate.cap);
    });

    it('stops increasing fire rate beyond its cap', () => {
      const baseFireRate = testShip.fireRate;

      levelShipTo(testShip, LEVEL_BONUSES.fireRate.maxLevel + 1);
      const cappedFireRate = testShip.fireRate;

      expect(cappedFireRate).toBeCloseTo(baseFireRate * (1 + LEVEL_BONUSES.fireRate.cap));

      levelShipTo(testShip, LEVEL_BONUSES.fireRate.maxLevel + 5);
      expect(testShip.fireRate).toBeCloseTo(cappedFireRate);
      expect(testShip.levelBonuses.fireRate).toBeCloseTo(LEVEL_BONUSES.fireRate.cap);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete progression cycle', () => {
      // Start with level 1 ship
      expect(testShip.level).toBe(1);

      // Award damage XP
      awardDamageXp(testShip, 500); // 50 XP

      // Award kill XP
      awardKillXp(testShip, 100); // 50 XP = 100 total, should level up

      expect(testShip.level).toBe(2);
      expect(testShip.maxHp).toBeGreaterThan(40); // Level bonus applied

      // Damage subsystems
      const rng = new SeededRng(12345);
      for (let i = 0; i < 50; i++) {
        applySubsystemDamage(testShip, 10, rng);
      }

      // Some subsystem should be damaged
      const totalSubsystemHp = Object.values(testShip.subsystems).reduce((sum, s) => sum + s.hp, 0);
      const totalMaxHp = Object.values(testShip.subsystems).reduce((sum, s) => sum + s.maxHp, 0);
      expect(totalSubsystemHp).toBeLessThan(totalMaxHp);

      // Repair over time
      const initialTotalHp = totalSubsystemHp;
      repairSubsystems(testShip, 5.0); // 5 seconds of repairs

      const newTotalHp = Object.values(testShip.subsystems).reduce((sum, s) => sum + s.hp, 0);
      expect(newTotalHp).toBeGreaterThan(initialTotalHp);
    });
  });
});

describe('Progression Configuration', () => {
  it('should create valid defaults for all hull types', () => {
    const hulls = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];

    for (const hull of hulls) {
      const defaults = createProgressionDefaults(hull);

      expect(defaults.xp).toBe(0);
      expect(defaults.level).toBe(1);
      expect(defaults.xpToNext).toBeGreaterThan(0);
      expect(defaults.damageType).toBeDefined();
      expect(defaults.armor).toBeGreaterThan(0);
      expect(defaults.subsystems).toBeDefined();
      expect(Object.keys(defaults.subsystems)).toEqual(['engine', 'weapons', 'shields']);
    }
  });
});
