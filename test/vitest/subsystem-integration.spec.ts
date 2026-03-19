import { describe, it, expect } from 'vite-plus/test';
import { Vector3 } from 'three';
import type { ShipComponent } from '../../src/types/index.js';
import {
  getEffectiveStats,
  applySubsystemDamage,
  createLevelBonusState,
} from '../../src/game/progression.js';
import { SeededRng } from '../../src/utils/rng.js';

describe('Subsystem Integration Tests', () => {
  it('should apply subsystem damage effects to ship stats', () => {
    // Create a test ship with subsystem damage
    const testShip: ShipComponent = {
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
      xp: 0,
      level: 1,
      xpToNext: 100,
      damageType: 'kinetic',
      levelBonuses: createLevelBonusState(),
      captain: undefined,
      subsystems: {
        engine: { hp: 12, maxHp: 12, status: 'online', repairRate: 1.2 },
        weapons: { hp: 12, maxHp: 12, status: 'online', repairRate: 1.2 },
        shields: { hp: 12, maxHp: 12, status: 'online', repairRate: 1.2 },
      },
      armor: 5,
    };

    // Test baseline - all systems online
    let stats = getEffectiveStats(testShip);
    expect(stats.speedMultiplier).toBe(1.0);
    expect(stats.damageMultiplier).toBe(1.0);
    expect(stats.shieldRegenMultiplier).toBe(1.0);

    // Damage engine to 40% HP (below 50% = damaged)
    testShip.subsystems.engine.hp = 4.8; // 40% of 12
    testShip.subsystems.engine.status = 'damaged';

    stats = getEffectiveStats(testShip);
    expect(stats.speedMultiplier).toBe(0.75); // -25% speed

    // Damage weapons to 20% HP (below 25% = offline)
    testShip.subsystems.weapons.hp = 2.4; // 20% of 12
    testShip.subsystems.weapons.status = 'offline';

    stats = getEffectiveStats(testShip);
    expect(stats.damageMultiplier).toBe(0.4); // -60% damage

    // Damage shields to 10% HP (below 25% = offline)
    testShip.subsystems.shields.hp = 1.2; // 10% of 12
    testShip.subsystems.shields.status = 'offline';

    stats = getEffectiveStats(testShip);
    expect(stats.shieldRegenMultiplier).toBe(0.0); // No shield regen
  });

  it('should apply subsystem critical hits correctly', () => {
    const testShip: ShipComponent = {
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
      xp: 0,
      level: 1,
      xpToNext: 100,
      damageType: 'kinetic',
      levelBonuses: createLevelBonusState(),
      captain: undefined,
      subsystems: {
        engine: { hp: 12, maxHp: 12, status: 'online', repairRate: 1.2 },
        weapons: { hp: 12, maxHp: 12, status: 'online', repairRate: 1.2 },
        shields: { hp: 12, maxHp: 12, status: 'online', repairRate: 1.2 },
      },
      armor: 5,
    };

    const initialSubsystemHp = {
      engine: testShip.subsystems.engine.hp,
      weapons: testShip.subsystems.weapons.hp,
      shields: testShip.subsystems.shields.hp,
    };

    // Apply large amount of damage to force critical hits
    const rng = new SeededRng(12345);
    for (let i = 0; i < 100; i++) {
      applySubsystemDamage(testShip, 10, rng);
    }

    // At least one subsystem should have taken damage
    const hasSubsystemDamage =
      testShip.subsystems.engine.hp < initialSubsystemHp.engine ||
      testShip.subsystems.weapons.hp < initialSubsystemHp.weapons ||
      testShip.subsystems.shields.hp < initialSubsystemHp.shields;

    expect(hasSubsystemDamage).toBe(true);

    // At least one subsystem should have non-online status
    const hasStatusEffect =
      testShip.subsystems.engine.status !== 'online' ||
      testShip.subsystems.weapons.status !== 'online' ||
      testShip.subsystems.shields.status !== 'online';

    expect(hasStatusEffect).toBe(true);
  });

  it('should demonstrate subsystem effects impact ship performance', () => {
    // Create ships with different subsystem damage states
    const healthyShip: ShipComponent = {
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
      xp: 0,
      level: 1,
      xpToNext: 100,
      damageType: 'kinetic',
      levelBonuses: createLevelBonusState(),
      captain: undefined,
      subsystems: {
        engine: { hp: 12, maxHp: 12, status: 'online', repairRate: 1.2 },
        weapons: { hp: 12, maxHp: 12, status: 'online', repairRate: 1.2 },
        shields: { hp: 12, maxHp: 12, status: 'online', repairRate: 1.2 },
      },
      armor: 5,
    };

    const damagedShip: ShipComponent = {
      ...healthyShip,
      subsystems: {
        engine: { hp: 6, maxHp: 12, status: 'damaged', repairRate: 1.2 }, // 50% = damaged
        weapons: { hp: 2, maxHp: 12, status: 'offline', repairRate: 1.2 }, // <25% = offline
        shields: { hp: 3, maxHp: 12, status: 'offline', repairRate: 1.2 }, // <25% = offline
      },
    };

    const healthyStats = getEffectiveStats(healthyShip);
    const damagedStats = getEffectiveStats(damagedShip);

    // Healthy ship should have full performance
    expect(healthyStats.speedMultiplier).toBe(1.0);
    expect(healthyStats.damageMultiplier).toBe(1.0);
    expect(healthyStats.shieldRegenMultiplier).toBe(1.0);

    // Damaged ship should have reduced performance
    expect(damagedStats.speedMultiplier).toBe(0.75); // Engine damaged: -25%
    expect(damagedStats.damageMultiplier).toBe(0.4); // Weapons offline: -60%
    expect(damagedStats.shieldRegenMultiplier).toBe(0.0); // Shields offline: no regen

    // Demonstrate the performance difference
    const healthyDamageOutput = 10 * healthyStats.damageMultiplier;
    const damagedDamageOutput = 10 * damagedStats.damageMultiplier;

    expect(healthyDamageOutput).toBe(10);
    expect(damagedDamageOutput).toBe(4); // 60% reduction

    const healthyMaxSpeed = 40 * healthyStats.speedMultiplier;
    const damagedMaxSpeed = 40 * damagedStats.speedMultiplier;

    expect(healthyMaxSpeed).toBe(40);
    expect(damagedMaxSpeed).toBe(30); // 25% reduction

    const healthyShieldRegen = 4.0 * healthyStats.shieldRegenMultiplier;
    const damagedShieldRegen = 4.0 * damagedStats.shieldRegenMultiplier;

    expect(healthyShieldRegen).toBe(4.0);
    expect(damagedShieldRegen).toBe(0.0); // No regen
  });
});
