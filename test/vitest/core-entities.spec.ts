import { describe, test, expect, beforeEach } from 'vitest';
import {
  createInitialState,
  resetState,
  spawnShip,
  spawnFleet,
  simulateStep
} from '../../src/core/gameState.js';
import { getShipClassConfig } from '../../src/config/entitiesConfig.js';
import type { GameState, Ship, ShipClass, Team } from '../../src/types/index.js';

// Test utilities
function createMockGameState(overrides = {}) {
  const baseState = {
    time: 0,
    tick: 0,
    running: false,
    speedMultiplier: 1,
    rng: {
      seed: 'test-seed',
      next: () => 0.5,
      int: (min: number, max: number) => Math.floor((min + max) / 2),
      pick: <T>(arr: T[]) => arr[0],
    },
    nextId: 1,
    simConfig: {
      simBounds: { width: 1000, height: 800, depth: 600 },
      tickRate: 60,
      maxEntities: 1000,
      bulletLifetime: 3,
      maxSimulationSteps: 100,
      targetUpdateRate: 1,
      boundaryBehavior: {
        ships: 'bounce' as const,
        bullets: 'remove' as const,
      },
      seed: 'test-seed',
      useTimeBasedSeed: false,
    },
    ships: [],
    bullets: [],
    score: { red: 0, blue: 0 },
    behaviorConfig: undefined,
  };

  return { ...baseState, ...overrides };
}

function createMockShip(overrides = {}) {
  const baseShip = {
    id: 1,
    team: 'red' as const,
    class: 'fighter' as const,
    pos: { x: 100, y: 100, z: 100 },
    vel: { x: 0, y: 0, z: 0 },
    dir: 0,
    targetId: null,
    health: 80,
    maxHealth: 80,
    armor: 2,
    shield: 40,
    maxShield: 40,
    shieldRegen: 5,
    speed: 140,
    turnRate: Math.PI,
    turrets: [{ id: 'fighter-cannon-0', cooldownLeft: 0 }],
    kills: 0,
    level: { level: 1, xp: 0, nextLevelXp: 50 },
  };

  return { ...baseShip, ...overrides };
}

describe('Entity Mechanics', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = createInitialState('test-seed');
  });

  describe('Game State Creation', () => {
    test('should create initial state with default config', () => {
      const state = createInitialState();

      expect(state.time).toBe(0);
      expect(state.tick).toBe(0);
      expect(state.running).toBe(false);
      expect(state.speedMultiplier).toBe(1);
      expect(state.nextId).toBe(1);
      expect(state.ships).toEqual([]);
      expect(state.bullets).toEqual([]);
      expect(state.score).toEqual({ red: 0, blue: 0 });
      expect(state.behaviorConfig).toBeDefined();
    });

    test('should create state with custom seed', () => {
      const state = createInitialState('custom-seed');
      expect(state.rng.seed).toBe('custom-seed');
    });

    test('should create state with time-based seed when specified', () => {
      const state = createInitialState();
      // Should use time-based seed since useTimeBasedSeed is true by default
      expect(state.rng.seed).toMatch(/^SPACE-/);
    });
  });

  describe('State Reset', () => {
    test('should reset state to initial values', () => {
      // Modify state
      gameState.time = 100;
      gameState.tick = 50;
      gameState.running = true;
      gameState.ships.push(createMockShip());
      gameState.score.red = 5;

      resetState(gameState, 'reset-seed');

      expect(gameState.time).toBe(0);
      expect(gameState.tick).toBe(0);
      expect(gameState.running).toBe(false);
      expect(gameState.ships).toEqual([]);
      expect(gameState.score).toEqual({ red: 0, blue: 0 });
      expect(gameState.rng.seed).toBe('reset-seed');
    });

    test('should preserve behavior config on reset', () => {
      const originalConfig = gameState.behaviorConfig;
      resetState(gameState);

      expect(gameState.behaviorConfig).toStrictEqual(originalConfig);
    });
  });

  describe('Ship Spawning', () => {
    test('should spawn ship with correct properties', () => {
      const ship = spawnShip(gameState, 'red', 'fighter');

      expect(ship.id).toBe(1);
      expect(ship.team).toBe('red');
      expect(ship.class).toBe('fighter');
      expect(ship.health).toBeGreaterThan(0);
      expect(ship.maxHealth).toBeGreaterThan(0);
      expect(ship.shield).toBeGreaterThan(0);
      expect(ship.maxShield).toBeGreaterThan(0);
      expect(ship.speed).toBeGreaterThan(0);
      expect(ship.turnRate).toBeGreaterThan(0);
      expect(ship.turrets).toHaveLength(1);
      expect(ship.kills).toBe(0);
      expect(ship.level.level).toBe(1);
    });

    test('should assign unique IDs', () => {
      const ship1 = spawnShip(gameState, 'red', 'fighter');
      const ship2 = spawnShip(gameState, 'blue', 'corvette');

      expect(ship1.id).not.toBe(ship2.id);
      expect(gameState.nextId).toBe(3); // Next available ID
    });

    test('should add ship to game state', () => {
      const ship = spawnShip(gameState, 'red', 'fighter');

      expect(gameState.ships).toContain(ship);
      expect(gameState.ships).toHaveLength(1);
    });

    test('should apply level scaling to stats', () => {
      const baseConfig = getShipClassConfig('fighter');

      const ship = spawnShip(gameState, 'red', 'fighter');

      // Health should be scaled by level (level 1 = base value)
      expect(ship.maxHealth).toBe(baseConfig.baseHealth);
      expect(ship.maxShield).toBe(baseConfig.shield);
    });

    test('should spawn different ship classes with correct turret counts', () => {
      const testCases: Array<{ shipClass: ShipClass; expectedTurrets: number }> = [
        { shipClass: 'fighter', expectedTurrets: 1 },
        { shipClass: 'corvette', expectedTurrets: 2 },
        { shipClass: 'frigate', expectedTurrets: 3 },
        { shipClass: 'destroyer', expectedTurrets: 4 },
        { shipClass: 'carrier', expectedTurrets: 2 }
      ];

      testCases.forEach(({ shipClass, expectedTurrets }) => {
        const ship = spawnShip(gameState, 'red', shipClass);
        expect(ship.turrets).toHaveLength(expectedTurrets);
      });
    });

    test('should spawn carrier with fighter spawning capabilities', () => {
      const carrier = spawnShip(gameState, 'red', 'carrier');

      expect(carrier.class).toBe('carrier');
      expect(carrier.spawnedFighters).toBe(0);
      expect(carrier.fighterSpawnCdLeft).toBe(1.0);

      // maxFighters comes from config, not ship object
      const carrierConfig = getShipClassConfig('carrier');
      expect(carrierConfig.maxFighters).toBeDefined();
      expect(carrierConfig.maxFighters).toBeGreaterThan(0);
    });

    test('should spawn ship at specified position', () => {
      const position = { x: 100, y: 200, z: 50 };
      const ship = spawnShip(gameState, 'red', 'fighter', position);

      expect(ship.pos).toEqual(position);
    });

    test('should spawn ship with parent carrier reference', () => {
      const carrier = spawnShip(gameState, 'red', 'carrier');
      const fighter = spawnShip(gameState, 'red', 'fighter', undefined, carrier.id);

      expect(fighter.parentCarrierId).toBe(carrier.id);
    });
  });

  describe('Fleet Spawning', () => {
    test('should spawn fleet with specified count', () => {
      spawnFleet(gameState, 'red', 5);

      expect(gameState.ships).toHaveLength(5);
      gameState.ships.forEach(ship => {
        expect(ship.team).toBe('red');
      });
    });

    test('should spawn fleet with random ship classes', () => {
      spawnFleet(gameState, 'blue', 10);

      expect(gameState.ships).toHaveLength(10);
      const shipClasses = gameState.ships.map(ship => ship.class);
      const uniqueClasses = new Set(shipClasses);

      // Should have some variety (not all the same class)
      expect(uniqueClasses.size).toBeGreaterThan(1);
    });

    test('should spawn fleet with valid ship classes only', () => {
      spawnFleet(gameState, 'red', 20);

      const validClasses: ShipClass[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];

      gameState.ships.forEach(ship => {
        expect(validClasses).toContain(ship.class);
      });
    });
  });

  describe('Ship Stats Validation', () => {
    test('should have balanced stats across ship classes', () => {
      const shipClasses: ShipClass[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];

      shipClasses.forEach(shipClass => {
        const ship = spawnShip(gameState, 'red', shipClass);
        const config = getShipClassConfig(shipClass);

        // Basic validation
        expect(ship.health).toBe(config.baseHealth);
        expect(ship.maxHealth).toBe(config.baseHealth);
        expect(ship.shield).toBe(config.shield);
        expect(ship.maxShield).toBe(config.shield);
        expect(ship.speed).toBe(config.speed);
        expect(ship.turnRate).toBe(config.turnRate);

        // Health should be positive
        expect(ship.health).toBeGreaterThan(0);
        expect(ship.maxHealth).toBeGreaterThan(0);

        // Shield should be reasonable
        expect(ship.shield).toBeGreaterThanOrEqual(0);
        expect(ship.maxShield).toBeGreaterThanOrEqual(0);

        // Movement stats should be positive
        expect(ship.speed).toBeGreaterThan(0);
        expect(ship.turnRate).toBeGreaterThan(0);
      });
    });

    test('should have progressive stat increases', () => {
      const shipClasses: ShipClass[] = ['fighter', 'corvette', 'frigate', 'destroyer', 'carrier'];
      const ships = shipClasses.map(cls => spawnShip(gameState, 'red', cls));

      // Health should increase progressively
      for (let i = 1; i < ships.length; i++) {
        expect(ships[i].maxHealth).toBeGreaterThan(ships[i - 1].maxHealth);
      }

      // Armor should generally increase, but carriers have less than destroyers (by design)
      expect(ships[1].armor).toBeGreaterThan(ships[0].armor); // corvette > fighter
      expect(ships[2].armor).toBeGreaterThan(ships[1].armor); // frigate > corvette
      expect(ships[3].armor).toBeGreaterThan(ships[2].armor); // destroyer > frigate
      // Carrier has less armor than destroyer (by design - carriers are more fragile)
    });

    test('fighters should have best maneuverability', () => {
      const fighter = spawnShip(gameState, 'red', 'fighter');
      const destroyer = spawnShip(gameState, 'red', 'destroyer');

      // Fighters should turn faster
      expect(fighter.turnRate).toBeGreaterThan(destroyer.turnRate);
    });

    test('carriers should have lowest speed', () => {
      const carrier = spawnShip(gameState, 'red', 'carrier');
      const fighter = spawnShip(gameState, 'red', 'fighter');

      // Carriers should be slower
      expect(carrier.speed).toBeLessThan(fighter.speed);
    });
  });

  describe('Turret Configuration', () => {
    test('should initialize turrets with correct config', () => {
      const ship = spawnShip(gameState, 'red', 'frigate');
      const config = getShipClassConfig('frigate');

      expect(ship.turrets).toHaveLength(3);

      ship.turrets.forEach((turret, index) => {
        const turretConfig = config.turrets[index % config.turrets.length];
        expect(turret.id).toBe(`${turretConfig.id}-${index}`);
        expect(turret.cooldownLeft).toBe(0); // Ready to fire
      });
    });

    test('should have unique turret IDs', () => {
      const ship = spawnShip(gameState, 'red', 'destroyer'); // Has 4 turrets

      const turretIds = ship.turrets.map(t => t.id);
      const uniqueIds = new Set(turretIds);

      expect(uniqueIds.size).toBe(ship.turrets.length);
    });

    test('should initialize turret AI state', () => {
      const ship = spawnShip(gameState, 'red', 'fighter');

      ship.turrets.forEach(turret => {
        expect(turret.cooldownLeft).toBe(0);
        // AI state should be undefined initially (will be set by AI controller)
        expect(turret.aiState).toBeUndefined();
      });
    });
  });

  describe('Simulation Integration', () => {
    test('should integrate with simulateStep', () => {
      const ship = spawnShip(gameState, 'red', 'fighter');
      const initialHealth = ship.health;

      // Run a few simulation steps
      for (let i = 0; i < 10; i++) {
        simulateStep(gameState, 0.016); // ~60fps
      }

      // Ship should still exist and have valid health
      expect(gameState.ships).toContain(ship);
      expect(ship.health).toBe(initialHealth); // No damage taken
    });

    test('should handle multiple ships in simulation', () => {
      spawnFleet(gameState, 'red', 3);
      spawnFleet(gameState, 'blue', 3);

      const initialShipCount = gameState.ships.length;

      // Run simulation
      for (let i = 0; i < 60; i++) { // 1 second at 60fps
        simulateStep(gameState, 0.016);
      }

      // Should still have same number of ships (no deaths yet)
      expect(gameState.ships).toHaveLength(initialShipCount);
    });
  });

  describe('Edge Cases', () => {
    test('should handle spawning at boundary positions', () => {
      const boundaryPos = { x: 0, y: 0, z: 0 };
      const ship = spawnShip(gameState, 'red', 'fighter', boundaryPos);

      expect(ship.pos).toEqual(boundaryPos);
    });

    test('should handle spawning with invalid positions', () => {
      const invalidPos = { x: NaN, y: Infinity, z: -Infinity };
      expect(() => spawnShip(gameState, 'red', 'fighter', invalidPos)).not.toThrow();
    });

    test('should handle empty fleet spawning', () => {
      spawnFleet(gameState, 'red', 0);
      expect(gameState.ships).toHaveLength(0);
    });

    test('should handle large fleet spawning', () => {
      const largeCount = 100;
      spawnFleet(gameState, 'red', largeCount);

      expect(gameState.ships).toHaveLength(largeCount);
      gameState.ships.forEach(ship => {
        expect(ship.team).toBe('red');
      });
    });
  });
});