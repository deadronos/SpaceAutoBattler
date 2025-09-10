import { describe, it, expect, beforeEach } from 'vitest';
import {
  SpawnSystem,
  SpawnIntent,
  SpawnResult,
  SpawnEvent,
} from '../../src/core/systems/spawnSystem.js';
import {
  NoopPhysicsAdapter,
  NoopRendererAdapter,
  NoopSpatialIndex,
} from '../../src/core/adapters/index.js';
import { createMockGameState } from './setupTests.js';
import type { GameState, Team, ShipClass } from '../../src/types/index.js';

// Re-export adapters for convenience
export { NoopPhysicsAdapter } from '../../src/core/adapters/physicsAdapter.js';
export { NoopRendererAdapter } from '../../src/core/adapters/rendererAdapter.js';
export { NoopSpatialIndex } from '../../src/core/spatialIndex.js';

describe('SpawnSystem', () => {
  let gameState: GameState;
  let spawnSystem: SpawnSystem;
  let physicsAdapter: NoopPhysicsAdapter;
  let rendererAdapter: NoopRendererAdapter;
  let spatialIndex: NoopSpatialIndex;

  beforeEach(() => {
    gameState = createMockGameState();
    physicsAdapter = new NoopPhysicsAdapter();
    rendererAdapter = new NoopRendererAdapter();
    spatialIndex = new NoopSpatialIndex();

    spawnSystem = new SpawnSystem(gameState, {
      physics: physicsAdapter,
      renderer: rendererAdapter,
      spatial: spatialIndex,
    });
  });

  describe('Ship Spawning', () => {
    it('should spawn a ship successfully', () => {
      const intent: SpawnIntent = {
        type: 'ship',
        team: 'red',
        class: 'fighter',
      };

      const result = spawnSystem.spawnShip(intent);

      expect(result.success).toBe(true);
      expect(result.entityId).toBeGreaterThan(0);
      expect(result.spawnedEntity).toBeDefined();
      expect(result.spawnedEntity!.team).toBe('red');
      expect(result.spawnedEntity!.class).toBe('fighter');

      // Check that ship was added to game state
      expect(gameState.ships).toHaveLength(1);
      expect(gameState.ships[0].id).toBe(result.entityId);
      expect(gameState.shipIndex?.has(result.entityId)).toBe(true);
    });

    it('should spawn ship with custom position', () => {
      const customPos = { x: 100, y: 200, z: 300 };
      const intent: SpawnIntent = {
        type: 'ship',
        team: 'blue',
        class: 'destroyer',
        position: customPos,
      };

      const result = spawnSystem.spawnShip(intent);

      expect(result.success).toBe(true);
      expect(result.spawnedEntity!.pos).toEqual(customPos);
    });

    it('should spawn ship with custom orientation and velocity', () => {
      const customOrientation = { pitch: 0.1, yaw: 1.5, roll: 0.2 };
      const customVelocity = { x: 10, y: 20, z: 30 };
      const intent: SpawnIntent = {
        type: 'ship',
        team: 'red',
        class: 'corvette',
        initialOrientation: customOrientation,
        initialVelocity: customVelocity,
      };

      const result = spawnSystem.spawnShip(intent);

      expect(result.success).toBe(true);
      expect(result.spawnedEntity!.orientation).toEqual(customOrientation);
      expect(result.spawnedEntity!.vel).toEqual(customVelocity);
    });

    it('should spawn carrier with correct initial state', () => {
      const intent: SpawnIntent = {
        type: 'ship',
        team: 'blue',
        class: 'carrier',
      };

      const result = spawnSystem.spawnShip(intent);

      expect(result.success).toBe(true);
      expect(result.spawnedEntity!.spawnedFighters).toBe(0);
      expect(result.spawnedEntity!.fighterSpawnCdLeft).toBeGreaterThan(0);
    });

    it('should fail to spawn invalid ship intent', () => {
      const invalidIntent: SpawnIntent = {
        type: 'ship',
        team: 'red',
        // Missing class
      };

      const result = spawnSystem.spawnShip(invalidIntent);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid ship spawn intent');
      expect(gameState.ships).toHaveLength(0);
    });

    it('should fail to spawn non-ship intent', () => {
      const invalidIntent: SpawnIntent = {
        type: 'bullet',
        team: 'red',
        class: 'fighter',
      };

      const result = spawnSystem.spawnShip(invalidIntent);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid ship spawn intent');
    });
  });

  describe('Fleet Spawning', () => {
    it('should spawn multiple ships for a fleet', () => {
      const results = spawnSystem.spawnFleet('red', 3);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(gameState.ships).toHaveLength(3);
      expect(gameState.ships.every((s) => s.team === 'red')).toBe(true);
    });

    it('should spawn fleet with specific ship classes', () => {
      const classes: ShipClass[] = ['fighter', 'destroyer'];
      const results = spawnSystem.spawnFleet('blue', 4, { classes });

      expect(results).toHaveLength(4);
      expect(results.every((r) => r.success)).toBe(true);
      expect(gameState.ships.every((s) => classes.includes(s.class))).toBe(true);
    });

    it('should spawn fleet in line formation', () => {
      const results = spawnSystem.spawnFleet('red', 3, { formation: 'line' });

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);

      // Check that ships are positioned in a line (same x and z, different y)
      const ships = gameState.ships;
      expect(ships[0].pos.x).toBeCloseTo(ships[1].pos.x, 1);
      expect(ships[0].pos.x).toBeCloseTo(ships[2].pos.x, 1);
      expect(ships[0].pos.z).toBeCloseTo(ships[1].pos.z, 1);
      expect(ships[0].pos.z).toBeCloseTo(ships[2].pos.z, 1);
      // Y positions should be different
      expect(Math.abs(ships[0].pos.y - ships[1].pos.y)).toBeGreaterThan(10);
    });

    it('should spawn fleet in wedge formation', () => {
      const results = spawnSystem.spawnFleet('blue', 5, { formation: 'wedge' });

      expect(results).toHaveLength(5);
      expect(results.every((r) => r.success)).toBe(true);

      // Wedge formation should have varying x and y positions
      const ships = gameState.ships;
      const xPositions = ships.map((s) => s.pos.x);
      const yPositions = ships.map((s) => s.pos.y);

      // Should have at least some variation in both x and y
      expect(Math.max(...xPositions) - Math.min(...xPositions)).toBeGreaterThan(10);
      expect(Math.max(...yPositions) - Math.min(...yPositions)).toBeGreaterThan(10);
    });
  });

  describe('Ship Removal', () => {
    it('should remove ship successfully', () => {
      const intent: SpawnIntent = {
        type: 'ship',
        team: 'red',
        class: 'fighter',
      };
      const result = spawnSystem.spawnShip(intent);
      expect(gameState.ships).toHaveLength(1);

      const removed = spawnSystem.removeShip(result.entityId);

      expect(removed).toBe(true);
      expect(gameState.ships).toHaveLength(0);
      expect(gameState.shipIndex?.has(result.entityId)).toBe(false);
    });

    it('should fail to remove non-existent ship', () => {
      const removed = spawnSystem.removeShip(999);
      expect(removed).toBe(false);
    });
  });

  describe('Event System', () => {
    it('should emit spawn events', () => {
      const events: SpawnEvent[] = [];
      spawnSystem.onSpawnEvent((event) => events.push(event));

      const intent: SpawnIntent = {
        type: 'ship',
        team: 'red',
        class: 'fighter',
      };
      spawnSystem.spawnShip(intent);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('spawned');
      expect(events[0].intent).toEqual(intent);
      expect(events[0].result.success).toBe(true);
    });

    it('should emit failure events', () => {
      const events: SpawnEvent[] = [];
      spawnSystem.onSpawnEvent((event) => events.push(event));

      const invalidIntent: SpawnIntent = {
        type: 'ship',
        team: 'red',
        // Missing class
      };
      spawnSystem.spawnShip(invalidIntent);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('failed');
      expect(events[0].result.success).toBe(false);
    });

    it('should unsubscribe from events', () => {
      const events: SpawnEvent[] = [];
      const unsubscribe = spawnSystem.onSpawnEvent((event) => events.push(event));

      unsubscribe();

      const intent: SpawnIntent = {
        type: 'ship',
        team: 'red',
        class: 'fighter',
      };
      spawnSystem.spawnShip(intent);

      expect(events).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      // Spawn some ships
      spawnSystem.spawnShip({ type: 'ship', team: 'red', class: 'fighter' });
      spawnSystem.spawnShip({ type: 'ship', team: 'red', class: 'destroyer' });
      spawnSystem.spawnShip({ type: 'ship', team: 'blue', class: 'fighter' });

      const stats = spawnSystem.getStats();

      expect(stats.totalShips).toBe(3);
      expect(stats.shipsByTeam.red).toBe(2);
      expect(stats.shipsByTeam.blue).toBe(1);
      expect(stats.shipsByClass.fighter).toBe(2);
      expect(stats.shipsByClass.destroyer).toBe(1);
      expect(stats.shipsByClass.corvette).toBe(0);
      expect(stats.nextId).toBe(gameState.nextId);
    });

    it('should handle empty state statistics', () => {
      const stats = spawnSystem.getStats();

      expect(stats.totalShips).toBe(0);
      expect(stats.shipsByTeam.red).toBe(0);
      expect(stats.shipsByTeam.blue).toBe(0);
      expect(Object.values(stats.shipsByClass).every((count) => count === 0)).toBe(true);
    });
  });

  describe('Spawn Jitter', () => {
    it('should apply spawn jitter when enabled', () => {
      // Enable spawn jitter
      gameState.behaviorConfig.globalSettings.enableSpawnJitter = true;

      const intent: SpawnIntent = {
        type: 'ship',
        team: 'red',
        class: 'fighter',
        initialVelocity: { x: 0, y: 0, z: 0 },
      };

      const result = spawnSystem.spawnShip(intent);

      expect(result.success).toBe(true);
      // Velocity should have been modified by jitter
      const vel = result.spawnedEntity!.vel;
      const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
      expect(speed).toBeGreaterThan(0);
    });

    it('should not apply spawn jitter when disabled', () => {
      // Disable spawn jitter
      gameState.behaviorConfig.globalSettings.enableSpawnJitter = false;

      const initialVel = { x: 0, y: 0, z: 0 };
      const intent: SpawnIntent = {
        type: 'ship',
        team: 'red',
        class: 'fighter',
        initialVelocity: initialVel,
      };

      const result = spawnSystem.spawnShip(intent);

      expect(result.success).toBe(true);
      expect(result.spawnedEntity!.vel).toEqual(initialVel);
    });
  });

  describe('Adapter Integration', () => {
    it('should work without adapters', () => {
      const spawnSystemNoAdapters = new SpawnSystem(gameState);

      const intent: SpawnIntent = {
        type: 'ship',
        team: 'red',
        class: 'fighter',
      };

      const result = spawnSystemNoAdapters.spawnShip(intent);

      expect(result.success).toBe(true);
      expect(gameState.ships).toHaveLength(1);
    });

    it('should handle adapter errors gracefully', () => {
      // Create an adapter that throws errors
      const errorAdapter = {
        ...rendererAdapter,
        ensureMeshForShip: () => {
          throw new Error('Renderer error');
        },
      };

      const spawnSystemWithErrorAdapter = new SpawnSystem(gameState, {
        renderer: errorAdapter as any,
      });

      const intent: SpawnIntent = {
        type: 'ship',
        team: 'red',
        class: 'fighter',
      };

      // Should still succeed even with adapter errors
      const result = spawnSystemWithErrorAdapter.spawnShip(intent);
      expect(result.success).toBe(true);
    });
  });

  describe('Parent-Child Relationships', () => {
    it('should spawn fighter with parent carrier', () => {
      const carrierIntent: SpawnIntent = {
        type: 'ship',
        team: 'red',
        class: 'carrier',
      };
      const carrierResult = spawnSystem.spawnShip(carrierIntent);

      const fighterIntent: SpawnIntent = {
        type: 'ship',
        team: 'red',
        class: 'fighter',
        parentId: carrierResult.entityId,
      };
      const fighterResult = spawnSystem.spawnShip(fighterIntent);

      expect(fighterResult.success).toBe(true);
      expect(fighterResult.spawnedEntity!.parentCarrierId).toBe(carrierResult.entityId);
    });
  });
});
